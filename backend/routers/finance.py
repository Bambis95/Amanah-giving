"""Finances: the accounts of the platform, kept by the treasurer (and admins), read by the president.

- Entries: every income and expense outside online donations, with its supporting document.
  Never deleted: a wrong entry is cancelled with a reason, so the history stays complete.
- Budgets: planned spending of each campaign, compared with what is actually spent.
- Reconciliation: each paid online donation is ticked once found on the operator's statement.
- Summary: donations + other income - expenses, by month and by campaign.
Every change is written to the audit log (category "finance").
"""

import io
import logging
import secrets
from datetime import date, datetime, timezone
from typing import List, Literal, Optional

from core.database import get_db
from dependencies.auth import get_finance_actor, get_finance_reader
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from models.auth import User
from models.donations import Donations
from models.finance import FinanceDocument, FinanceEntry, ProjectBudgetLine
from models.projects import Projects
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from schemas.auth import UserResponse
from services import audit
from services.audit import Actor
from sqlalchemy import delete, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/finance", tags=["finance"])
logger = logging.getLogger(__name__)

INCOME_CATEGORIES = {
    "donation_offline": "Don hors plateforme (espèces, remise en main propre)",
    "grant": "Subvention / partenaire",
    "membership": "Cotisations et adhésions",
    "event": "Événement / vente",
    "other_income": "Autre recette",
}
EXPENSE_CATEGORIES = {
    "construction": "Construction et aménagement",
    "equipment": "Équipement et matériel",
    "training": "Formation et pédagogie",
    "transport": "Transport et logistique",
    "staff": "Personnel et indemnités",
    "communication": "Communication",
    "fees": "Frais bancaires et opérateurs",
    "operations": "Fonctionnement",
    "other_expense": "Autre dépense",
}
PAYMENT_METHODS = {
    "cash": "Espèces",
    "wave": "Wave",
    "orange_money": "Orange Money",
    "free_money": "Free Money",
    "bank_transfer": "Virement bancaire",
    "check": "Chèque",
    "card": "Carte bancaire",
}
MAX_AMOUNT = 100_000_000_000  # 100 milliards FCFA: catches a typing slip, not a real limit
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
MAX_BUDGET_LINES = 50


# ---------- schemas ----------

class EntryIn(BaseModel):
    kind: Literal["income", "expense"]
    entry_date: date
    amount: int = Field(gt=0, le=MAX_AMOUNT)
    category: str
    label: str = Field(min_length=1, max_length=255)
    project_id: Optional[int] = None
    payment_method: str
    reference: Optional[str] = Field(default=None, max_length=100)
    document_id: Optional[str] = Field(default=None, max_length=32)

    @field_validator("category")
    @classmethod
    def _category_exists(cls, value: str, info):
        allowed = INCOME_CATEGORIES if info.data.get("kind") == "income" else EXPENSE_CATEGORIES
        if value not in allowed:
            raise ValueError("Catégorie inconnue pour ce type d'écriture")
        return value

    @field_validator("payment_method")
    @classmethod
    def _method_exists(cls, value: str):
        if value not in PAYMENT_METHODS:
            raise ValueError("Moyen de paiement inconnu")
        return value

    @field_validator("entry_date")
    @classmethod
    def _not_in_future(cls, value: date):
        if value > date.today():
            raise ValueError("La date ne peut pas être dans le futur")
        return value


class EntryOut(BaseModel):
    id: int
    kind: str
    entry_date: date
    amount: int
    category: str
    label: str
    project_id: Optional[int] = None
    payment_method: str
    reference: Optional[str] = None
    document_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None


class CancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=255)


class BudgetLineIn(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    category: str
    planned_amount: int = Field(ge=0, le=MAX_AMOUNT)

    @field_validator("category")
    @classmethod
    def _expense_category(cls, value: str):
        if value not in EXPENSE_CATEGORIES:
            raise ValueError("Catégorie de dépense inconnue")
        return value


class BudgetLineOut(BudgetLineIn):
    id: int


class ReconcileIn(BaseModel):
    reconciled: bool


# ---------- helpers ----------

def _entry_fields(entry: FinanceEntry) -> dict:
    return audit.snapshot(
        entry, ["kind", "entry_date", "amount", "category", "label", "project_id", "payment_method", "reference", "document_id"]
    )


async def _check_links(db: AsyncSession, data: EntryIn) -> None:
    if data.project_id is not None and not await db.get(Projects, data.project_id):
        raise HTTPException(status_code=400, detail="Cette campagne n'existe pas.")
    if data.document_id and not await db.get(FinanceDocument, data.document_id):
        raise HTTPException(status_code=400, detail="Justificatif introuvable : envoyez-le à nouveau.")


async def _entry_out(db: AsyncSession, entry: FinanceEntry) -> EntryOut:
    author = await db.get(User, entry.created_by) if entry.created_by else None
    return EntryOut(
        **{c: getattr(entry, c) for c in EntryOut.model_fields if c != "created_by_name"},
        created_by_name=(author.name or author.email) if author else None,
    )


def _year_filter(column, year: Optional[int]):
    return [extract("year", column) == year] if year else []


# ---------- reference data ----------

@router.get("/meta")
async def meta(_reader: UserResponse = Depends(get_finance_reader)):
    """Labels of categories and payment methods, shared with the website."""
    return {
        "income_categories": INCOME_CATEGORIES,
        "expense_categories": EXPENSE_CATEGORIES,
        "payment_methods": PAYMENT_METHODS,
    }


# ---------- entries ----------

@router.get("/entries", response_model=List[EntryOut])
async def list_entries(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _reader: UserResponse = Depends(get_finance_reader),
):
    query = select(FinanceEntry, User).outerjoin(User, User.id == FinanceEntry.created_by)
    conditions = _year_filter(FinanceEntry.entry_date, year)
    if project_id is not None:
        conditions.append(FinanceEntry.project_id == project_id)
    rows = (await db.execute(query.where(*conditions).order_by(FinanceEntry.entry_date.desc(), FinanceEntry.id.desc()))).all()
    return [
        EntryOut(
            **{c: getattr(entry, c) for c in EntryOut.model_fields if c != "created_by_name"},
            created_by_name=(author.name or author.email) if author else None,
        )
        for entry, author in rows
    ]


@router.post("/entries", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(data: EntryIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_finance_actor)):
    await _check_links(db, data)
    entry = FinanceEntry(**{**data.model_dump(), "label": data.label.strip()}, created_by=actor.id)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    kind = "Recette" if entry.kind == "income" else "Dépense"
    await audit.record(
        db, actor, "finance.entry_create", f"{kind} enregistrée : {entry.label} ({entry.amount:,} FCFA)".replace(",", " "),
        target_type="finance_entry", target_id=entry.id, details=_entry_fields(entry),
    )
    return await _entry_out(db, entry)


@router.put("/entries/{entry_id}", response_model=EntryOut)
async def update_entry(
    entry_id: int, data: EntryIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_finance_actor)
):
    entry = await db.get(FinanceEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Écriture introuvable")
    if entry.cancelled_at:
        raise HTTPException(status_code=409, detail="Une écriture annulée ne peut plus être modifiée.")
    await _check_links(db, data)
    before = _entry_fields(entry)
    for key, value in {**data.model_dump(), "label": data.label.strip()}.items():
        setattr(entry, key, value)
    entry.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    changes = audit.diff(before, _entry_fields(entry))
    if changes:
        await audit.record(
            db, actor, "finance.entry_update", f"Écriture modifiée : {entry.label} ({', '.join(changes)})",
            target_type="finance_entry", target_id=entry.id, details=changes,
        )
    return await _entry_out(db, entry)


@router.post("/entries/{entry_id}/cancel", response_model=EntryOut)
async def cancel_entry(
    entry_id: int, data: CancelIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_finance_actor)
):
    entry = await db.get(FinanceEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Écriture introuvable")
    if entry.cancelled_at:
        raise HTTPException(status_code=409, detail="Cette écriture est déjà annulée.")
    entry.cancelled_at = datetime.now(timezone.utc)
    entry.cancelled_by = actor.id
    entry.cancel_reason = data.reason.strip()
    await db.commit()
    await db.refresh(entry)
    await audit.record(
        db, actor, "finance.entry_cancel", f"Écriture annulée : {entry.label} (motif : {entry.cancel_reason})",
        target_type="finance_entry", target_id=entry.id, details=_entry_fields(entry),
    )
    return await _entry_out(db, entry)


# ---------- supporting documents ----------

def _prepare_document(raw: bytes) -> tuple[bytes, str]:
    """PDF kept as sent; photos straightened, shrunk and re-encoded (no phone metadata)."""
    if raw.startswith(b"%PDF-"):
        return raw, "application/pdf"
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP", "MPO"}:
                raise ValueError
            image = ImageOps.exif_transpose(source)
            image.thumbnail((2000, 2000))
            if image.mode != "RGB":
                image = image.convert("RGB")
            out = io.BytesIO()
            image.save(out, "JPEG", quality=85, optimize=True)
            return out.getvalue(), "image/jpeg"
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Justificatif accepté : PDF, JPEG, PNG ou WebP.") from exc


@router.post("/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_finance_actor)
):
    raw = await file.read(MAX_DOCUMENT_BYTES + 1)
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Justificatif trop lourd (10 Mo au maximum).")
    if not raw:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")
    data, content_type = _prepare_document(raw)
    filename = (file.filename or "justificatif").replace("/", "_").replace("\\", "_")[:200]
    document = FinanceDocument(
        id=secrets.token_hex(16), filename=filename, content_type=content_type, data=data, size=len(data), uploaded_by=actor.id
    )
    db.add(document)
    await db.commit()
    return {"id": document.id, "filename": filename, "content_type": content_type, "size": len(data)}


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str, db: AsyncSession = Depends(get_db), _reader: UserResponse = Depends(get_finance_reader)
):
    document = await db.get(FinanceDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Justificatif introuvable")
    safe_name = document.filename.encode("ascii", "ignore").decode() or "justificatif"
    return Response(
        content=document.data,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ---------- campaign budgets ----------

@router.get("/budgets/{project_id}", response_model=List[BudgetLineOut])
async def get_budget(project_id: int, db: AsyncSession = Depends(get_db), _reader: UserResponse = Depends(get_finance_reader)):
    rows = await db.execute(
        select(ProjectBudgetLine).where(ProjectBudgetLine.project_id == project_id).order_by(ProjectBudgetLine.position)
    )
    return [BudgetLineOut(id=l.id, label=l.label, category=l.category, planned_amount=l.planned_amount) for l in rows.scalars()]


@router.put("/budgets/{project_id}", response_model=List[BudgetLineOut])
async def save_budget(
    project_id: int,
    lines: List[BudgetLineIn],
    db: AsyncSession = Depends(get_db),
    actor: Actor = Depends(get_finance_actor),
):
    """Replace the whole budget of a campaign (the form always sends every line)."""
    project = await db.get(Projects, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Campagne introuvable")
    if len(lines) > MAX_BUDGET_LINES:
        raise HTTPException(status_code=400, detail=f"{MAX_BUDGET_LINES} lignes au maximum.")
    before = sum(l.planned_amount for l in (await db.execute(
        select(ProjectBudgetLine).where(ProjectBudgetLine.project_id == project_id)
    )).scalars())
    await db.execute(delete(ProjectBudgetLine).where(ProjectBudgetLine.project_id == project_id))
    for position, line in enumerate(lines):
        db.add(ProjectBudgetLine(project_id=project_id, position=position, **{**line.model_dump(), "label": line.label.strip()}))
    await db.commit()
    total = sum(l.planned_amount for l in lines)
    await audit.record(
        db, actor, "finance.budget_update",
        f"Budget de « {project.title} » : {len(lines)} ligne(s), {total:,} FCFA".replace(",", " "),
        target_type="project", target_id=project_id, details={"total": {"avant": before, "apres": total}},
    )
    return await get_budget(project_id, db)


# ---------- reconciliation of online donations ----------

@router.get("/reconciliation")
async def reconciliation(
    state: Literal["pending", "done", "all"] = "pending",
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    _reader: UserResponse = Depends(get_finance_reader),
):
    """Paid donations, to tick against the PayTech / Wave / Orange Money statements."""
    conditions = [Donations.payment_status == "paid", *_year_filter(Donations.created_at, year)]
    if state == "pending":
        conditions.append(Donations.reconciled_at.is_(None))
    elif state == "done":
        conditions.append(Donations.reconciled_at.is_not(None))
    rows = (
        await db.execute(
            select(Donations, Projects.title, User)
            .outerjoin(Projects, Projects.id == Donations.project_id)
            .outerjoin(User, User.id == Donations.reconciled_by)
            .where(*conditions)
            .order_by(Donations.created_at.desc(), Donations.id.desc())
            .limit(2000)
        )
    ).all()
    return [
        {
            "id": d.id,
            "created_at": d.created_at,
            "amount": d.amount,
            "payment_method": d.payment_method,
            "payment_provider": d.payment_provider,
            "payment_reference": d.payment_reference,
            "donor_name": " ".join(filter(None, [d.donor_first_name, d.donor_last_name])) or None,
            "project_title": title,
            "reconciled_at": d.reconciled_at,
            "reconciled_by_name": (checker.name or checker.email) if checker else None,
        }
        for d, title, checker in rows
    ]


@router.post("/reconciliation/{donation_id}")
async def reconcile(
    donation_id: int, data: ReconcileIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_finance_actor)
):
    donation = await db.get(Donations, donation_id)
    if not donation or donation.payment_status != "paid":
        raise HTTPException(status_code=404, detail="Don payé introuvable")
    if data.reconciled == (donation.reconciled_at is not None):
        return {"id": donation.id, "reconciled_at": donation.reconciled_at}
    donation.reconciled_at = datetime.now(timezone.utc) if data.reconciled else None
    donation.reconciled_by = actor.id if data.reconciled else None
    await db.commit()
    await audit.record(
        db, actor, "finance.reconcile" if data.reconciled else "finance.unreconcile",
        f"Don n° {donation.id} ({donation.amount:,} FCFA) {'pointé' if data.reconciled else 'dépointé'}".replace(",", " "),
        target_type="donation", target_id=donation.id,
    )
    return {"id": donation.id, "reconciled_at": donation.reconciled_at}


# ---------- summary ----------

@router.get("/summary")
async def summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    _reader: UserResponse = Depends(get_finance_reader),
):
    """Totals for a year (or all years): online donations + other income - expenses."""
    paid = [Donations.payment_status == "paid", *_year_filter(Donations.created_at, year)]
    active = [FinanceEntry.cancelled_at.is_(None), *_year_filter(FinanceEntry.entry_date, year)]
    total = func.coalesce(func.sum(Donations.amount), 0)
    entry_total = func.coalesce(func.sum(FinanceEntry.amount), 0)

    donations_total, donations_count = (await db.execute(select(total, func.count(Donations.id)).where(*paid))).one()
    reconciled_total, reconciled_count = (
        await db.execute(select(total, func.count(Donations.id)).where(*paid, Donations.reconciled_at.is_not(None)))
    ).one()
    by_method = dict((await db.execute(select(Donations.payment_method, total).where(*paid).group_by(Donations.payment_method))).all())

    by_category = {"income": {}, "expense": {}}
    for kind, category, amount in (
        await db.execute(select(FinanceEntry.kind, FinanceEntry.category, entry_total).where(*active).group_by(FinanceEntry.kind, FinanceEntry.category))
    ).all():
        by_category[kind][category] = amount
    other_income = sum(by_category["income"].values())
    expenses = sum(by_category["expense"].values())

    months = {m: {"month": m, "donations": 0, "other_income": 0, "expenses": 0} for m in range(1, 13)}
    if year:
        for month, amount in (await db.execute(
            select(extract("month", Donations.created_at), total).where(*paid).group_by(extract("month", Donations.created_at))
        )).all():
            months[int(month)]["donations"] = amount
        for kind, month, amount in (await db.execute(
            select(FinanceEntry.kind, extract("month", FinanceEntry.entry_date), entry_total)
            .where(*active).group_by(FinanceEntry.kind, extract("month", FinanceEntry.entry_date))
        )).all():
            months[int(month)]["other_income" if kind == "income" else "expenses"] += amount

    # Per campaign: money in (donations + income tied to it), money out, planned budget
    project_donations = dict((await db.execute(
        select(Donations.project_id, total).where(*paid, Donations.project_id.is_not(None)).group_by(Donations.project_id)
    )).all())
    project_entries = {}
    for project_id, kind, amount in (await db.execute(
        select(FinanceEntry.project_id, FinanceEntry.kind, entry_total)
        .where(*active, FinanceEntry.project_id.is_not(None)).group_by(FinanceEntry.project_id, FinanceEntry.kind)
    )).all():
        project_entries.setdefault(project_id, {})[kind] = amount
    budgets = dict((await db.execute(
        select(ProjectBudgetLine.project_id, func.sum(ProjectBudgetLine.planned_amount)).group_by(ProjectBudgetLine.project_id)
    )).all())
    projects = []
    for project in (await db.execute(select(Projects).order_by(Projects.id))).scalars():
        entries = project_entries.get(project.id, {})
        received = int(project_donations.get(project.id, 0)) + int(entries.get("income", 0))
        spent = int(entries.get("expense", 0))
        projects.append({
            "id": project.id,
            "title": project.title,
            "status": project.status,
            "goal": project.goal,
            "received": received,
            "spent": spent,
            "available": received - spent,
            "budget": int(budgets.get(project.id) or 0),
        })

    return {
        "year": year,
        "donations": {"total": int(donations_total), "count": donations_count, "by_method": {k: int(v) for k, v in by_method.items()}},
        "reconciliation": {
            "reconciled_total": int(reconciled_total),
            "reconciled_count": reconciled_count,
            "pending_total": int(donations_total) - int(reconciled_total),
            "pending_count": donations_count - reconciled_count,
        },
        "other_income": other_income,
        "expenses": expenses,
        "balance": int(donations_total) + other_income - expenses,
        "by_category": by_category,
        "months": list(months.values()) if year else [],
        "projects": projects,
    }
