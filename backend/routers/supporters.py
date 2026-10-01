"""Public list of a campaign's latest supporters ("Awa D. a donné 5 000 FCFA").

Only paid donations whose donor chose to appear: anonymous ones show neither name nor amount,
and older donations (made before the choice existed) count as anonymous. Membership fees are not gifts.
"""

from datetime import datetime
from typing import List, Optional

from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query
from models.donations import Donations
from models.projects import Projects
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/supporters", tags=["supporters"])


class Supporter(BaseModel):
    name: Optional[str] = None  # None: anonymous
    amount: Optional[int] = None  # None: anonymous
    created_at: Optional[datetime] = None


class SupportersOut(BaseModel):
    total: int
    items: List[Supporter]


def public_name(first: Optional[str], last: Optional[str]) -> Optional[str]:
    """First name and initial of the last name: enough to thank, not enough to identify."""
    first = (first or "").strip()
    last = (last or "").strip()
    if not first:
        return None
    return f"{first[:40]} {last[0].upper()}." if last else first[:40]


@router.get("/{project_id}", response_model=SupportersOut)
async def campaign_supporters(project_id: int, limit: int = Query(10, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    project = await db.get(Projects, project_id)
    if not project or project.status == "paused":
        raise HTTPException(status_code=404, detail="Campagne introuvable")
    paid = (
        (Donations.project_id == project_id)
        & (Donations.payment_status == "paid")
        & (Donations.cause != "membership")
    )
    total = (await db.execute(select(func.count()).select_from(Donations).where(paid))).scalar_one()
    rows = (
        await db.execute(select(Donations).where(paid).order_by(Donations.created_at.desc(), Donations.id.desc()).limit(limit))
    ).scalars()
    items = []
    for d in rows:
        shown = d.anonymous is False
        name = public_name(d.donor_first_name, d.donor_last_name) if shown else None
        items.append(Supporter(name=name, amount=d.amount if shown and name else None, created_at=d.created_at))
    return SupportersOut(total=total, items=items)
