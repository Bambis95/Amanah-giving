"""Platform commission: the provider's agreed share of the donations, computed as a monthly statement.

Nothing is paid out automatically: the platform computes what is owed on every paid donation (online
and confirmed QR deposits; club membership fees are not donations), the client pays the provider, and
the treasurer records that payment in Finances (category "platform"). Statement = owed − paid.

The rate keeps its history: a change applies from the day it is made, never to earlier donations.
Every change is sealed in the audit journal, emailed to the admins, and the rate is shown to donors.
"""

from collections import OrderedDict
from datetime import date
from decimal import ROUND_DOWN, Decimal
from typing import Any, Dict, List, Optional

from models.donations import Donations
from models.finance import FinanceEntry
from models.site_setting import SiteSetting
from pydantic import BaseModel, Field
from services import audit
from services.audit import Actor
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

SETTING_KEY = "platform_commission"
FINANCE_CATEGORY = "platform"
MAX_PERCENT = Decimal("20")


class RateChange(BaseModel):
    since: date
    percent: Decimal


class CommissionSettings(BaseModel):
    # Who receives it, as it should appear on the statement (e.g. the provider's company name)
    payee: str = Field(default="", max_length=120)
    history: List[RateChange] = []

    def rate_on(self, day: date) -> Decimal:
        rate = Decimal(0)
        for change in sorted(self.history, key=lambda c: c.since):
            if change.since <= day:
                rate = change.percent
        return rate

    @property
    def current(self) -> Decimal:
        return self.rate_on(date.today())


class CommissionUpdate(BaseModel):
    percent: Decimal = Field(ge=0, le=MAX_PERCENT)
    payee: str = Field(default="", max_length=120)


def share_of(amount: int, percent: Decimal) -> int:
    """The provider's share, rounded down to the franc (never more than agreed)."""
    return int((Decimal(amount) * percent / 100).to_integral_value(rounding=ROUND_DOWN))


def pct(value: Decimal) -> str:
    return format(value.normalize(), "f")


async def load(db: AsyncSession) -> CommissionSettings:
    row = await db.get(SiteSetting, SETTING_KEY)
    try:
        return CommissionSettings(**(row.value or {})) if row else CommissionSettings()
    except Exception:
        return CommissionSettings()


async def update(db: AsyncSession, data: CommissionUpdate, actor: Actor) -> CommissionSettings:
    """Set the rate from today on (a second change the same day replaces the first)."""
    current = await load(db)
    before_rate, before_payee = current.current, current.payee
    today = date.today()
    history = [c for c in current.history if c.since != today]
    if data.percent != current.rate_on(today) or any(c.since == today for c in current.history):
        history.append(RateChange(since=today, percent=data.percent))
    saved = CommissionSettings(payee=data.payee.strip(), history=sorted(history, key=lambda c: c.since))
    row = await db.get(SiteSetting, SETTING_KEY)
    value = saved.model_dump(mode="json")
    if row:
        row.value = value
        row.updated_by = actor.id
    else:
        db.add(SiteSetting(key=SETTING_KEY, value=value, updated_by=actor.id))
    await db.commit()
    changes = audit.diff(
        {"pourcentage": pct(before_rate), "beneficiaire": before_payee},
        {"pourcentage": pct(saved.current), "beneficiaire": saved.payee},
    )
    if changes:
        await audit.record(
            db, actor, "finance.commission_settings",
            f"Commission de la plateforme : {pct(saved.current)} % à partir du {today.strftime('%d/%m/%Y')}",
            target_type="setting", target_id=SETTING_KEY, details=changes,
        )
    return saved


async def statement(db: AsyncSession, year: Optional[int] = None) -> Dict[str, Any]:
    """Owed per month (rate in force on each donation's day), paid so far, and the balance."""
    config = await load(db)
    query = select(Donations.amount, Donations.created_at).where(
        Donations.payment_status == "paid", Donations.cause != "membership", Donations.created_at.is_not(None)
    )
    months: "OrderedDict[str, Dict[str, int]]" = OrderedDict()
    total_owed = 0
    for amount, created in (await db.execute(query.order_by(Donations.created_at))).all():
        day = created.date()
        if year and day.year != year:
            continue
        rate = config.rate_on(day)
        owed = share_of(amount, rate)
        month = months.setdefault(day.strftime("%Y-%m"), {"donations": 0, "collected": 0, "owed": 0})
        month["donations"] += 1
        month["collected"] += amount
        month["owed"] += owed
        total_owed += owed

    paid_query = select(func.coalesce(func.sum(FinanceEntry.amount), 0)).where(
        FinanceEntry.kind == "expense", FinanceEntry.category == FINANCE_CATEGORY, FinanceEntry.cancelled_at.is_(None)
    )
    if year:
        paid_query = paid_query.where(func.extract("year", FinanceEntry.entry_date) == year)
    paid = int((await db.execute(paid_query)).scalar_one())
    return {
        "percent": pct(config.current),
        "payee": config.payee,
        "history": [{"since": c.since.isoformat(), "percent": pct(c.percent)} for c in config.history],
        "months": [{"month": m, **v} for m, v in reversed(months.items())],
        "owed": total_owed,
        "paid": paid,
        "balance": total_owed - paid,
    }


def public_rate(config: CommissionSettings) -> Optional[str]:
    """The rate announced to donors, when there is one."""
    return pct(config.current) if config.current > 0 else None
