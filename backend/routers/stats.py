from core.database import get_db
from fastapi import APIRouter, Depends
from models.donations import Donations
from models.projects import Projects
from pydantic import BaseModel
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


class PublicStats(BaseModel):
    total_raised: int
    donors: int
    paid_donations: int
    active_projects: int
    funded_projects: int


@router.get("", response_model=PublicStats)
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    """Public platform statistics: aggregates only, no donor data is exposed."""
    paid = Donations.payment_status == "paid"

    # A donor is their account, else their email, else the donation itself (anonymous without email)
    donor_key = func.coalesce(
        Donations.user_id,
        func.lower(Donations.donor_email),
        "donation-" + cast(Donations.id, String),
    )
    donations_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(Donations.amount), 0),
                func.count(func.distinct(donor_key)),
                func.count(Donations.id),
            ).where(paid)
        )
    ).one()

    projects_row = (
        await db.execute(
            select(
                func.count(Projects.id).filter(or_(Projects.status.is_(None), Projects.status == "active")),
                func.count(Projects.id).filter(
                    or_(Projects.status == "completed", Projects.raised >= Projects.goal)
                ),
            )
        )
    ).one()

    return PublicStats(
        total_raised=donations_row[0],
        donors=donations_row[1],
        paid_donations=donations_row[2],
        active_projects=projects_row[0],
        funded_projects=projects_row[1],
    )
