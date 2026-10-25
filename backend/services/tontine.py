"""Figures of a tontine group: what each member paid and owes, the treasurer's cash, the bank, the alerts.

The ledger only records: money goes member → treasurer → the association's bank account.
- Treasurer's cash = contributions - deposits - payouts made from the cash
  (every operation not cancelled, validated or not: the money has left the treasurer's hands).
- Bank (declared) = validated deposits - validated payouts made from the bank.
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional

from models.tontine import TontineGroup, TontineMember, TontineOperation

KINDS = {"savings": "Épargne", "rotating": "Natt tournante"}
FREQUENCIES = {"daily": "par jour", "weekly": "par semaine", "monthly": "par mois"}
METHODS = {
    "cash": "Espèces",
    "wave": "Wave",
    "orange_money": "Orange Money",
    "free_money": "Free Money",
    "bank_transfer": "Virement bancaire",
}
OFFICER_ROLES = ("treasurer", "president")


def month_bounds(month: str) -> tuple[date, date]:
    year, mon = (int(x) for x in month.split("-"))
    return date(year, mon, 1), date(year, mon, calendar.monthrange(year, mon)[1])


def expected_count(group: TontineGroup, member: TontineMember, start: date, end: date, today: date) -> int:
    """How many contributions the member owes between start and end (up to today), by the group's rhythm."""
    first = max(start, member.joined_at)
    last = min(end, today, member.left_at or end)
    if last < first:
        return 0
    days = (last - first).days + 1
    if group.frequency == "daily":
        return days
    if group.frequency == "weekly":
        return -(-days // 7)
    return 1


def active(member: TontineMember, on: date) -> bool:
    return member.joined_at <= on and (member.left_at is None or member.left_at >= on)


@dataclass
class Ledger:
    group: TontineGroup
    members: List[TontineMember]
    operations: List[TontineOperation]  # cancelled ones included (shown, never counted)

    def live(self, kind: Optional[str] = None) -> List[TontineOperation]:
        return [o for o in self.operations if o.cancelled_at is None and (kind is None or o.kind == kind)]

    def cash_in_hand(self) -> int:
        paid_in = sum(o.amount for o in self.live("contribution"))
        deposited = sum(o.amount for o in self.live("deposit"))
        paid_out = sum(o.amount for o in self.live("payout") if o.source == "cash")
        return paid_in - deposited - paid_out

    def bank_balance(self) -> int:
        deposited = sum(o.amount for o in self.live("deposit") if o.validated_at)
        paid_out = sum(o.amount for o in self.live("payout") if o.source == "bank" and o.validated_at)
        return deposited - paid_out

    def cash_since(self, today: date) -> Optional[int]:
        """Days since the last deposit (or the first contribution when nothing was ever deposited)."""
        deposits = self.live("deposit")
        if deposits:
            return (today - max(o.op_date for o in deposits)).days
        contributions = self.live("contribution")
        if contributions:
            return (today - min(o.op_date for o in contributions)).days
        return None

    def member_rows(self, month: str, today: date) -> List[Dict]:
        start, end = month_bounds(month)
        rows = []
        for m in sorted(self.members, key=lambda x: (x.rotation_order is None, x.rotation_order or 0, x.name.lower())):
            if m.joined_at > end or (m.left_at and m.left_at < start):
                continue
            mine = [o for o in self.live() if o.member_id == m.id]
            contributed = sum(o.amount for o in mine if o.kind == "contribution" and start <= o.op_date <= end)
            paid_days = len({o.op_date for o in mine if o.kind == "contribution" and start <= o.op_date <= end})
            owed = expected_count(self.group, m, start, end, today)
            received = sum(o.amount for o in mine if o.kind == "payout" and o.period == month)
            rows.append({
                "id": m.id,
                "name": m.name,
                "role": m.role,
                "phone": m.phone,
                "email": m.email,
                "linked": bool(m.user_id),
                "rotation_order": m.rotation_order,
                "joined_at": m.joined_at,
                "left_at": m.left_at,
                "contributed": contributed,
                "expected": owed * self.group.amount,
                "paid_count": paid_days,
                "expected_count": owed,
                "late": max(0, owed * self.group.amount - contributed),
                "received": received,
                # Savings: what the member gets back for this month
                "to_receive": max(0, contributed - received) if self.group.kind == "savings" else None,
                "total_contributed": sum(o.amount for o in mine if o.kind == "contribution"),
                "total_received": sum(o.amount for o in mine if o.kind == "payout"),
            })
        return rows

    def rotation(self, today: date) -> Optional[Dict]:
        """Rotating groups: rounds done, the pot, who receives next."""
        if self.group.kind != "rotating":
            return None
        order = sorted((m for m in self.members if active(m, today)), key=lambda m: (m.rotation_order or 10_000, m.id))
        if not order:
            return {"rounds_done": 0, "pot": 0, "next": None, "order": []}
        payouts = sorted(self.live("payout"), key=lambda o: (o.op_date, o.id))
        size = len(order)
        cycle_start = (len(payouts) // size) * size
        served = {o.member_id for o in payouts[cycle_start:]}
        upcoming = [m for m in order if m.id not in served]
        return {
            "rounds_done": len(payouts),
            "cycle": len(payouts) // size + 1,
            "pot": self.group.amount * size,
            "next": {"id": upcoming[0].id, "name": upcoming[0].name} if upcoming else None,
            "order": [{"id": m.id, "name": m.name, "served": m.id in served} for m in order],
        }

    def alerts(self, today: date, month: str) -> List[Dict]:
        found = []
        cash = self.cash_in_hand()
        since = self.cash_since(today)
        if cash >= self.group.cash_alert_amount and since is not None and since > self.group.cash_alert_days:
            found.append({
                "code": "cash_dormant", "level": "warning",
                "text": f"Le trésorier garde {cash:,} F depuis {since} jours sans dépôt à la banque (seuil : "
                        f"{self.group.cash_alert_amount:,} F, {self.group.cash_alert_days} jours).".replace(",", " "),
            })
        if cash < 0:
            found.append({
                "code": "cash_negative", "level": "critical",
                "text": "Plus d'argent déposé ou versé que de cotisations reçues : une opération est mal saisie.",
            })
        pending = [o for o in self.live() if o.kind in ("deposit", "payout") and not o.validated_at]
        if pending:
            found.append({"code": "to_validate", "level": "info", "text": f"{len(pending)} opération(s) à valider."})
        late = [r for r in self.member_rows(month, today) if r["late"] > 0]
        if late:
            found.append({"code": "late", "level": "info", "text": f"{len(late)} membre(s) en retard ce mois-ci."})
        return found

    def summary(self, month: str, today: date) -> Dict:
        live = self.live()
        start, end = month_bounds(month)
        in_month = [o for o in live if start <= o.op_date <= end]
        return {
            "month": month,
            "cash_in_hand": self.cash_in_hand(),
            "bank_balance": self.bank_balance(),
            "days_since_deposit": self.cash_since(today),
            "month_contributions": sum(o.amount for o in in_month if o.kind == "contribution"),
            "month_deposits": sum(o.amount for o in in_month if o.kind == "deposit"),
            "month_payouts": sum(o.amount for o in in_month if o.kind == "payout"),
            "total_contributions": sum(o.amount for o in live if o.kind == "contribution"),
            "pending_validation": sum(1 for o in live if o.kind in ("deposit", "payout") and not o.validated_at),
            "alerts": self.alerts(today, month),
            "rotation": self.rotation(today),
        }


def recent_months(today: date, count: int = 12) -> List[str]:
    months, cursor = [], today.replace(day=1)
    for _ in range(count):
        months.append(cursor.strftime("%Y-%m"))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    return months
