"""Platform commission: the agreed rate and the statement of what is owed (dashboard).

Read by the finance team: treasurer, president, admins (nothing hidden from the client); the rate is set by admins only.
"""

from datetime import datetime
from typing import Optional

from core.database import get_db
from dependencies.auth import get_admin_actor, get_finance_reader
from fastapi import APIRouter, Depends, Query, Response
from schemas.auth import UserResponse
from services import alerts, commission
from services.audit import Actor
from services.commission import CommissionUpdate
from services.finance_report import build_commission_statement
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/admin/commission", tags=["commission"])


@router.get("")
async def get_statement(
    year: Optional[int] = Query(None, ge=2020, le=2100),
    db: AsyncSession = Depends(get_db),
    _reader: UserResponse = Depends(get_finance_reader),
):
    return await commission.statement(db, year)


@router.put("")
async def set_rate(data: CommissionUpdate, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    """Admins: the rate applies from today on. Sealed in the journal and announced to every admin by email."""
    before = await commission.load(db)
    saved = await commission.update(db, data, actor)
    if (before.current, before.payee) != (saved.current, saved.payee):
        await alerts.alert_admins(
            db, f"commission-{datetime.now().timestamp()}", "Commission de la plateforme modifiée",
            f"{actor.email} a fixé la commission de la plateforme à {commission.pct(saved.current)} % "
            f"à partir d'aujourd'hui (bénéficiaire : {saved.payee or 'non précisé'}).\n\n"
            "Le détail est inscrit au Journal (catégorie Finances) ; le taux est affiché aux donateurs.",
        )
    return await commission.statement(db)


@router.get("/statement.pdf")
async def statement_pdf(
    year: Optional[int] = Query(None, ge=2020, le=2100),
    db: AsyncSession = Depends(get_db),
    reader: UserResponse = Depends(get_finance_reader),
):
    data = await commission.statement(db, year)
    pdf = build_commission_statement(data=data, year=year, author=reader.name or reader.email)
    name = f"releve-commission-{year or 'total'}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
