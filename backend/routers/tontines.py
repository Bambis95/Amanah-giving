"""Tontines: the digital ledger of each association (natt, savings groups). See models/tontine.py.

Who does what, inside one group:
- member    : sees their own payments, what they get back, their turn; nothing about the others
- treasurer : records the day's contributions, bank deposits and payouts, adds members
- president : the same, validates what the treasurer records (never their own), manages members
- club president / admin of SENJAPO: creates groups, sees and manages every group
Deposits and payouts count in the bank balance only once validated by another officer. Nothing is
deleted: an operation is cancelled with a reason. Every change goes to the sealed journal.
"""

import re
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional

from core.database import get_db
from dependencies.auth import client_ip, get_current_user, role_level
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from models.auth import User
from models.tontine import TontineDocument, TontineGroup, TontineMember, TontineOperation
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from routers.finance import MAX_DOCUMENT_BYTES, _prepare_document
from schemas.auth import UserResponse
from services import audit
from services import tontine as ledger_service
from services.audit import Actor
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/tontines", tags=["tontines"])

MAX_AMOUNT = 1_000_000_000
MONTH = r"^\d{4}-(0[1-9]|1[0-2])$"


def today() -> date:
    return datetime.now(timezone.utc).date()


def _actor(request: Request, user: UserResponse) -> Actor:
    return Actor(id=user.id, email=user.email, ip=client_ip(request))


def _platform_manager(user: UserResponse) -> bool:
    """The club's president and SENJAPO admins oversee every group."""
    return role_level(user.role) >= 2


# ---------- schemas ----------

class GroupIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    kind: Literal["savings", "rotating"]
    amount: int = Field(..., ge=25, le=MAX_AMOUNT)
    frequency: Literal["daily", "weekly", "monthly"]
    bank_name: Optional[str] = Field(None, max_length=120)
    bank_account: Optional[str] = Field(None, max_length=60)
    cash_alert_amount: int = Field(50_000, ge=0, le=MAX_AMOUNT)
    cash_alert_days: int = Field(7, ge=1, le=90)

    @field_validator("name", "bank_name", "bank_account")
    @classmethod
    def _trim(cls, value: Optional[str]) -> Optional[str]:
        return (value or "").strip() or None


class GroupCreate(GroupIn):
    president_name: str = Field(..., min_length=2, max_length=120)
    president_email: Optional[EmailStr] = None
    president_phone: Optional[str] = Field(None, max_length=30)


class MemberIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    phone: Optional[str] = Field(None, max_length=30)
    email: Optional[EmailStr] = None
    role: Literal["member", "treasurer", "president"] = "member"
    rotation_order: Optional[int] = Field(None, ge=1, le=1000)
    joined_at: Optional[date] = None
    left_at: Optional[date] = None

    @field_validator("name", "phone")
    @classmethod
    def _trim(cls, value: Optional[str]) -> Optional[str]:
        return (value or "").strip() or None


class OperationIn(BaseModel):
    kind: Literal["contribution", "deposit", "payout"]
    member_id: Optional[int] = None
    op_date: date
    amount: int = Field(..., ge=1, le=MAX_AMOUNT)
    method: Literal["cash", "wave", "orange_money", "free_money", "bank_transfer"] = "cash"
    source: Optional[Literal["cash", "bank"]] = None
    period: Optional[str] = Field(None, max_length=10)
    reference: Optional[str] = Field(None, max_length=100)
    document_id: Optional[str] = Field(None, max_length=32)

    @model_validator(mode="after")
    def _shape(self):
        if self.kind in ("contribution", "payout") and not self.member_id:
            raise ValueError("Choisissez le membre")
        if self.kind == "deposit":
            self.member_id = None
            self.source = None
        if self.kind == "payout" and not self.source:
            raise ValueError("Indiquez si le versement sort de la caisse ou de la banque")
        if self.kind != "payout":
            self.period = None
        return self


class DayIn(BaseModel):
    op_date: date
    method: Literal["cash", "wave", "orange_money", "free_money", "bank_transfer"] = "cash"
    member_ids: List[int] = Field(..., min_length=1, max_length=500)


class CancelIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)


# ---------- access ----------

async def _link_accounts(db: AsyncSession, user: UserResponse) -> None:
    """A member added with this person's email is attached to their account the first time they look."""
    rows = (await db.execute(
        select(TontineMember).where(TontineMember.user_id.is_(None), func.lower(TontineMember.email) == user.email.lower())
    )).scalars().all()
    for member in rows:
        member.user_id = user.id
    if rows:
        await db.commit()


async def _access(db: AsyncSession, group_id: int, user: UserResponse) -> tuple[TontineGroup, Optional[TontineMember], str]:
    """The group, the user's own member line (if any), and their role here: admin, president, treasurer or member."""
    group = await db.get(TontineGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Association introuvable")
    await _link_accounts(db, user)
    me = (await db.execute(
        select(TontineMember).where(TontineMember.group_id == group_id, TontineMember.user_id == user.id)
    )).scalars().first()
    if _platform_manager(user):
        return group, me, "admin"
    if not me:
        raise HTTPException(status_code=404, detail="Association introuvable")
    return group, me, me.role


def _officer(role: str) -> None:
    if role not in ("admin", "president", "treasurer"):
        raise HTTPException(status_code=403, detail="Réservé au trésorier et au président de l'association")


def _leader(role: str) -> None:
    if role not in ("admin", "president"):
        raise HTTPException(status_code=403, detail="Réservé au président de l'association")


async def _ledger(db: AsyncSession, group: TontineGroup) -> ledger_service.Ledger:
    members = (await db.execute(select(TontineMember).where(TontineMember.group_id == group.id))).scalars().all()
    operations = (await db.execute(
        select(TontineOperation).where(TontineOperation.group_id == group.id).order_by(TontineOperation.op_date, TontineOperation.id)
    )).scalars().all()
    return ledger_service.Ledger(group, list(members), list(operations))


def _group_out(group: TontineGroup) -> dict:
    account = group.bank_account
    return {
        "id": group.id,
        "name": group.name,
        "kind": group.kind,
        "kind_label": ledger_service.KINDS[group.kind],
        "amount": group.amount,
        "frequency": group.frequency,
        "frequency_label": ledger_service.FREQUENCIES[group.frequency],
        "bank_name": group.bank_name,
        # The full number stays with the officers' documents: four last characters are enough to recognise it
        "bank_account": f"•••• {account[-4:]}" if account and len(account) > 4 else account,
        "cash_alert_amount": group.cash_alert_amount,
        "cash_alert_days": group.cash_alert_days,
        "archived": bool(group.archived_at),
    }


async def _names(db: AsyncSession, ids: set) -> dict:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = (await db.execute(select(User.id, User.name, User.email).where(User.id.in_(ids)))).all()
    return {uid: name or email for uid, name, email in rows}


async def _operations_out(db: AsyncSession, operations: List[TontineOperation], members: dict) -> List[dict]:
    names = await _names(db, {o.recorded_by for o in operations} | {o.validated_by for o in operations})
    return [
        {
            "id": o.id,
            "kind": o.kind,
            "member_id": o.member_id,
            "member_name": members.get(o.member_id),
            "op_date": o.op_date,
            "amount": o.amount,
            "method": o.method,
            "method_label": ledger_service.METHODS.get(o.method, o.method),
            "source": o.source,
            "period": o.period,
            "reference": o.reference,
            "document_id": o.document_id,
            "recorded_by": o.recorded_by,
            "recorded_by_name": names.get(o.recorded_by),
            "created_at": o.created_at,
            "validated_at": o.validated_at,
            "validated_by_name": names.get(o.validated_by),
            "needs_validation": o.kind in ("deposit", "payout") and not o.validated_at and not o.cancelled_at,
            "cancelled_at": o.cancelled_at,
            "cancel_reason": o.cancel_reason,
        }
        for o in sorted(operations, key=lambda o: (o.op_date, o.id), reverse=True)
    ]


def _check_date(day: date) -> None:
    if day > today():
        raise HTTPException(status_code=400, detail="La date ne peut pas être dans le futur")
    if day < today() - timedelta(days=366):
        raise HTTPException(status_code=400, detail="Date trop ancienne (plus d'un an)")


# ---------- groups ----------

@router.get("")
async def my_groups(db: AsyncSession = Depends(get_db), user: UserResponse = Depends(get_current_user)):
    """The groups this person belongs to; every group for the club's president and admins."""
    await _link_accounts(db, user)
    mine = (await db.execute(select(TontineMember).where(TontineMember.user_id == user.id))).scalars().all()
    roles = {m.group_id: m.role for m in mine}
    query = select(TontineGroup).order_by(TontineGroup.name)
    if not _platform_manager(user):
        query = query.where(TontineGroup.id.in_(roles or {0}))
    groups = (await db.execute(query)).scalars().all()
    counts = dict((await db.execute(
        select(TontineMember.group_id, func.count()).where(TontineMember.left_at.is_(None)).group_by(TontineMember.group_id)
    )).all())
    return {
        "can_create": _platform_manager(user),
        "groups": [
            {**_group_out(g), "my_role": roles.get(g.id) or "admin", "members": counts.get(g.id, 0)}
            for g in groups
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(data: GroupCreate, request: Request, db: AsyncSession = Depends(get_db), user: UserResponse = Depends(get_current_user)):
    if not _platform_manager(user):
        raise HTTPException(status_code=403, detail="Les associations sont créées par le président du club ou un administrateur")
    group = TontineGroup(**data.model_dump(exclude={"president_name", "president_email", "president_phone"}), created_by=user.id)
    db.add(group)
    await db.flush()
    db.add(TontineMember(
        group_id=group.id, name=data.president_name, email=data.president_email, phone=data.president_phone,
        role="president", rotation_order=1 if data.kind == "rotating" else None, joined_at=today(),
    ))
    await db.commit()
    await audit.record(db, _actor(request, user), "tontine.group_create", f"Association créée : {group.name}",
                       "tontine_group", group.id, _group_out(group))
    return _group_out(group)


@router.put("/{group_id}")
async def update_group(group_id: int, data: GroupIn, request: Request, db: AsyncSession = Depends(get_db),
                       user: UserResponse = Depends(get_current_user)):
    group, _, role = await _access(db, group_id, user)
    _leader(role)
    before = _group_out(group)
    if data.kind != group.kind and (await db.execute(
        select(func.count()).select_from(TontineOperation).where(TontineOperation.group_id == group_id)
    )).scalar():
        raise HTTPException(status_code=409, detail="La formule ne change plus une fois des opérations enregistrées")
    for key, value in data.model_dump().items():
        setattr(group, key, value)
    await db.commit()
    after = _group_out(group)
    await audit.record(db, _actor(request, user), "tontine.group_update", f"Réglages modifiés : {group.name}",
                       "tontine_group", group.id, audit.diff(before, after))
    return after


@router.get("/{group_id}")
async def group_view(
    group_id: int,
    month: Optional[str] = Query(None, pattern=MONTH),
    db: AsyncSession = Depends(get_db),
    user: UserResponse = Depends(get_current_user),
):
    """Officers: the whole group for the month. A member: only their own line and turn."""
    group, me, role = await _access(db, group_id, user)
    month = month or today().strftime("%Y-%m")
    book = await _ledger(db, group)
    rows = book.member_rows(month, today())
    out = {"group": _group_out(group), "role": role, "month": month, "months": ledger_service.recent_months(today())}
    if role in ("admin", "president", "treasurer"):
        names = {m.id: m.name for m in book.members}
        start, end = ledger_service.month_bounds(month)
        return {
            **out,
            "summary": book.summary(month, today()),
            "members": rows,
            "operations": await _operations_out(db, [o for o in book.operations if start <= o.op_date <= end], names),
            "me_id": me.id if me else None,
        }
    mine = next((r for r in rows if r["id"] == me.id), None)
    rotation = book.rotation(today())
    my_ops = [o for o in book.operations if o.member_id == me.id and o.cancelled_at is None]
    return {
        **out,
        "me": mine,
        "my_operations": await _operations_out(db, my_ops, {me.id: me.name}),
        # A member sees the turn order of a natt (who is next), never the others' payments
        "rotation": rotation,
    }


# ---------- members ----------

@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(group_id: int, data: MemberIn, request: Request, db: AsyncSession = Depends(get_db),
                     user: UserResponse = Depends(get_current_user)):
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    if data.role != "member":
        _leader(role)
    if data.email and (await db.execute(select(TontineMember).where(
        TontineMember.group_id == group_id, func.lower(TontineMember.email) == data.email.lower()
    ))).scalars().first():
        raise HTTPException(status_code=409, detail="Un membre de l'association a déjà cet email")
    member = TontineMember(group_id=group_id, **{**data.model_dump(), "joined_at": data.joined_at or today()})
    if group.kind == "rotating" and member.rotation_order is None:
        last = (await db.execute(select(func.max(TontineMember.rotation_order)).where(TontineMember.group_id == group_id))).scalar()
        member.rotation_order = (last or 0) + 1
    db.add(member)
    await db.commit()
    await audit.record(db, _actor(request, user), "tontine.member_add", f"Membre ajouté à {group.name} : {member.name}",
                       "tontine_member", member.id, {"role": member.role, "rotation_order": member.rotation_order})
    return {"id": member.id}


@router.put("/{group_id}/members/{member_id}")
async def update_member(group_id: int, member_id: int, data: MemberIn, request: Request, db: AsyncSession = Depends(get_db),
                        user: UserResponse = Depends(get_current_user)):
    group, me, role = await _access(db, group_id, user)
    _officer(role)
    member = await db.get(TontineMember, member_id)
    if not member or member.group_id != group_id:
        raise HTTPException(status_code=404, detail="Membre introuvable")
    if data.role != member.role or member.role != "member":
        _leader(role)  # roles, and the officers' own lines, are the president's
    if me and me.id == member.id and data.role != member.role:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas changer votre propre rôle")
    before = {"name": member.name, "role": member.role, "rotation_order": member.rotation_order, "left_at": str(member.left_at)}
    for key, value in data.model_dump(exclude={"joined_at"}).items():
        setattr(member, key, value)
    if data.joined_at:
        member.joined_at = data.joined_at
    if member.email != (data.email or None):
        member.user_id = None  # a new email links to another account
    await db.commit()
    after = {"name": member.name, "role": member.role, "rotation_order": member.rotation_order, "left_at": str(member.left_at)}
    await audit.record(db, _actor(request, user), "tontine.member_update", f"Membre modifié dans {group.name} : {member.name}",
                       "tontine_member", member.id, audit.diff(before, after))
    return {"id": member.id}


# ---------- operations ----------

@router.post("/{group_id}/operations", status_code=status.HTTP_201_CREATED)
async def record_operation(group_id: int, data: OperationIn, request: Request, db: AsyncSession = Depends(get_db),
                           user: UserResponse = Depends(get_current_user)):
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    _check_date(data.op_date)
    if group.archived_at:
        raise HTTPException(status_code=409, detail="Association archivée")
    if data.member_id:
        member = await db.get(TontineMember, data.member_id)
        if not member or member.group_id != group_id:
            raise HTTPException(status_code=404, detail="Membre introuvable")
    if data.document_id:
        document = await db.get(TontineDocument, data.document_id)
        if not document or document.group_id != group_id:
            raise HTTPException(status_code=404, detail="Justificatif introuvable")
    if data.kind == "payout" and data.period and group.kind == "savings" and not re.match(MONTH, data.period):
        raise HTTPException(status_code=400, detail="Période attendue : AAAA-MM")
    operation = TontineOperation(group_id=group_id, recorded_by=user.id, **data.model_dump())
    if data.kind == "payout" and not operation.period:
        operation.period = data.op_date.strftime("%Y-%m") if group.kind == "savings" else None
    db.add(operation)
    await db.commit()
    label = {"contribution": "Cotisation", "deposit": "Dépôt à la banque", "payout": "Versement"}[data.kind]
    await audit.record(db, _actor(request, user), f"tontine.{data.kind}", f"{label} de {data.amount} F ({group.name})",
                       "tontine_operation", operation.id, data.model_dump(mode="json"))
    return {"id": operation.id}


@router.get("/{group_id}/day")
async def day_sheet(group_id: int, day: Optional[date] = None, db: AsyncSession = Depends(get_db),
                    user: UserResponse = Depends(get_current_user)):
    """The treasurer's daily sheet: every active member, and whether they already paid that day."""
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    day = day or today()
    book = await _ledger(db, group)
    paid = {}
    for o in book.live("contribution"):
        if o.op_date == day:
            paid[o.member_id] = paid.get(o.member_id, 0) + o.amount
    return {
        "day": day,
        "amount": group.amount,
        "members": [
            {"id": m.id, "name": m.name, "phone": m.phone, "paid": paid.get(m.id, 0)}
            for m in sorted(book.members, key=lambda m: m.name.lower()) if ledger_service.active(m, day)
        ],
    }


@router.post("/{group_id}/day", status_code=status.HTTP_201_CREATED)
async def record_day(group_id: int, data: DayIn, request: Request, db: AsyncSession = Depends(get_db),
                     user: UserResponse = Depends(get_current_user)):
    """Ticks: one contribution of the group's amount for each member listed who has not paid that day yet."""
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    _check_date(data.op_date)
    book = await _ledger(db, group)
    members = {m.id: m for m in book.members if ledger_service.active(m, data.op_date)}
    already = {o.member_id for o in book.live("contribution") if o.op_date == data.op_date}
    added = []
    for member_id in dict.fromkeys(data.member_ids):
        if member_id not in members:
            raise HTTPException(status_code=404, detail="Membre introuvable")
        if member_id in already:
            continue
        operation = TontineOperation(group_id=group_id, kind="contribution", member_id=member_id, op_date=data.op_date,
                                     amount=group.amount, method=data.method, recorded_by=user.id)
        db.add(operation)
        added.append(members[member_id].name)
    await db.commit()
    if added:
        await audit.record(db, _actor(request, user), "tontine.contribution",
                           f"{len(added)} cotisation(s) du {data.op_date:%d/%m/%Y} ({group.name})", "tontine_group", group.id,
                           {"membres": added, "montant": group.amount, "moyen": data.method})
    return {"added": len(added), "skipped": len(data.member_ids) - len(added)}


@router.post("/{group_id}/operations/{operation_id}/validate")
async def validate_operation(group_id: int, operation_id: int, request: Request, db: AsyncSession = Depends(get_db),
                             user: UserResponse = Depends(get_current_user)):
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    operation = await db.get(TontineOperation, operation_id)
    if not operation or operation.group_id != group_id:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    if operation.kind not in ("deposit", "payout") or operation.cancelled_at or operation.validated_at:
        raise HTTPException(status_code=409, detail="Cette opération n'est pas à valider")
    if operation.recorded_by == user.id:
        raise HTTPException(status_code=403, detail="Une autre personne que celle qui l'a saisie doit valider")
    operation.validated_at = datetime.now(timezone.utc)
    operation.validated_by = user.id
    await db.commit()
    await audit.record(db, _actor(request, user), "tontine.validate", f"Opération validée ({group.name}) : {operation.amount} F",
                       "tontine_operation", operation.id)
    return {"id": operation.id}


@router.post("/{group_id}/operations/{operation_id}/cancel")
async def cancel_operation(group_id: int, operation_id: int, data: CancelIn, request: Request, db: AsyncSession = Depends(get_db),
                           user: UserResponse = Depends(get_current_user)):
    group, _, role = await _access(db, group_id, user)
    _officer(role)
    operation = await db.get(TontineOperation, operation_id)
    if not operation or operation.group_id != group_id:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    if operation.cancelled_at:
        raise HTTPException(status_code=409, detail="Opération déjà annulée")
    if operation.validated_at or operation.recorded_by != user.id:
        _leader(role)  # a validated operation, or someone else's, is cancelled by the president only
    operation.cancelled_at = datetime.now(timezone.utc)
    operation.cancelled_by = user.id
    operation.cancel_reason = data.reason.strip()
    await db.commit()
    await audit.record(db, _actor(request, user), "tontine.cancel", f"Opération annulée ({group.name}) : {operation.cancel_reason}",
                       "tontine_operation", operation.id, {"montant": operation.amount, "type": operation.kind})
    return {"id": operation.id}


# ---------- documents (deposit slips) ----------

@router.post("/{group_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(group_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db),
                          user: UserResponse = Depends(get_current_user)):
    _, _, role = await _access(db, group_id, user)
    _officer(role)
    raw = await file.read(MAX_DOCUMENT_BYTES + 1)
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Fichier trop lourd (10 Mo au maximum).")
    if not raw:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")
    data, content_type = _prepare_document(raw)
    filename = (file.filename or "bordereau").replace("/", "_").replace("\\", "_")[:200]
    document = TontineDocument(id=secrets.token_hex(16), group_id=group_id, filename=filename, content_type=content_type,
                               data=data, size=len(data), uploaded_by=user.id)
    db.add(document)
    await db.commit()
    return {"id": document.id, "filename": filename}


@router.get("/{group_id}/documents/{document_id}")
async def get_document(group_id: int, document_id: str, db: AsyncSession = Depends(get_db),
                       user: UserResponse = Depends(get_current_user)):
    _, _, role = await _access(db, group_id, user)
    _officer(role)
    document = await db.get(TontineDocument, document_id)
    if not document or document.group_id != group_id:
        raise HTTPException(status_code=404, detail="Justificatif introuvable")
    safe_name = document.filename.encode("ascii", "ignore").decode() or "bordereau"
    return Response(content=document.data, media_type=document.content_type, headers={
        "Content-Disposition": f'inline; filename="{safe_name}"', "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    })
