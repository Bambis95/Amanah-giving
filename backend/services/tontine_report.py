"""Monthly statement of a tontine group (PDF): each member's month, the cash, the bank, deposits and payouts.

Read aloud or printed at the meeting, signed by the president and the treasurer: everyone checks their line.
"""

import io
from datetime import datetime, timezone
from typing import List

from reportlab.lib.colors import white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.config import settings
from services.finance_report import (
    BAND, BLUE, BODY, CELL, CELL_RIGHT, H2, HEAD, HEAD_RIGHT, INK, LINE, LOGO, MARGIN, MUTED, SMALL, _esc, _table, fcfa, month_label,
)
from services.tontine import AID_CATEGORIES

KIND_LABELS = {"contribution": "Cotisation", "deposit": "Dépôt à la banque", "payout": "Versement"}


def build_statement(*, group: dict, month: str, members: List[dict], summary: dict, operations: List[dict], author: str) -> bytes:
    buffer = io.BytesIO()
    width, height = A4
    generated = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    title = month_label(month).capitalize()

    def page_frame(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BLUE)
        canvas.rect(0, height - BAND, width, BAND, stroke=0, fill=1)
        if LOGO.exists():
            tile = 20 * mm
            canvas.setFillColor(white)
            canvas.roundRect(MARGIN, height - BAND + 5 * mm, tile, tile, 2.5 * mm, stroke=0, fill=1)
            canvas.drawImage(ImageReader(str(LOGO)), MARGIN + 1 * mm, height - BAND + 6 * mm, tile - 2 * mm, tile - 2 * mm,
                             preserveAspectRatio=True, mask="auto")
        canvas.setFillColor(white)
        canvas.setFont("Helvetica-Bold", 15)
        canvas.drawRightString(width - MARGIN, height - 13 * mm, "RELEVÉ DU MOIS")
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(width - MARGIN, height - 19 * mm, group["name"][:70])
        canvas.drawRightString(width - MARGIN, height - 24 * mm, f"{title} · {group['kind_label']}")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(MARGIN, 12 * mm, f"Cahier tenu sur {settings.site_short_name}. La plateforme ne garde pas l'argent de l'association.")
        canvas.drawString(MARGIN, 8.5 * mm, f"Généré le {generated} par {author[:40]}")
        canvas.drawRightString(width - MARGIN, 8.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=BAND + 8 * mm,
                            bottomMargin=18 * mm, title=f"Relevé {group['name']} {month}", author=settings.site_short_name)
    usable = width - 2 * MARGIN
    story = []

    rhythm = f"{fcfa(group['amount'])} {group['frequency_label']} par membre"
    bank = f" · Compte : {_esc(group['bank_name'])} {_esc(group['bank_account'] or '')}" if group.get("bank_name") else ""
    story.append(Paragraph(f"<b>{_esc(group['name'])}</b> · {_esc(group['kind_label'])} · {rhythm}{bank}", BODY))

    story.append(Paragraph("1. Situation de la caisse", H2))
    rows = [[Paragraph("Poste", HEAD), Paragraph("Montant", HEAD_RIGHT)]]
    rows.append([Paragraph(f"Cotisations reçues en {month_label(month)}", CELL), Paragraph(fcfa(summary["month_contributions"]), CELL_RIGHT)])
    rows.append([Paragraph(f"Déposé à la banque en {month_label(month)}", CELL), Paragraph(fcfa(summary["month_deposits"]), CELL_RIGHT)])
    rows.append([Paragraph(f"Versé aux membres en {month_label(month)}", CELL), Paragraph(fcfa(summary["month_payouts"]), CELL_RIGHT)])
    rows.append([Paragraph("Caisse du trésorier (aujourd'hui)", CELL), Paragraph(fcfa(summary["cash_in_hand"]), CELL_RIGHT)])
    rows.append([Paragraph("<b>À la banque, validé (aujourd'hui)</b>", CELL), Paragraph(f"<b>{fcfa(summary['bank_balance'])}</b>", CELL_RIGHT)])
    story.append(_table(rows, [usable * 0.7, usable * 0.3], total_row=True))
    if summary.get("month_aids"):
        aids = " · ".join(f"{AID_CATEGORIES[k]} : {fcfa(v)}" for k, v in summary["month_aids"].items() if v)
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(f"Aides du mois : {aids or 'aucune'}.", SMALL))
    if summary.get("pending_validation"):
        story.append(Paragraph(f"{summary['pending_validation']} opération(s) encore à valider : elles ne comptent pas dans le solde bancaire.", SMALL))

    story.append(Paragraph("2. Les membres", H2))
    last = {"savings": "À recevoir", "rotating": "Rang", "mbootaay": "Aides reçues"}[group["kind"]]
    rows = [[Paragraph(h, HEAD if i == 0 else HEAD_RIGHT) for i, h in enumerate(["Membre", "Payé", "Cotisé", "Retard", last])]]
    for m in members:
        if group["kind"] == "savings":
            extra = fcfa(m["to_receive"] or 0)
        elif group["kind"] == "rotating":
            extra = str(m["rotation_order"] or "—")
        else:
            extra = fcfa(m["received"])
        late = fcfa(m["late"]) if m["late"] else "—"
        rows.append([
            Paragraph(_esc(m["name"]), CELL), Paragraph(f"{m['paid_count']}/{m['expected_count']}", CELL_RIGHT),
            Paragraph(fcfa(m["contributed"]), CELL_RIGHT), Paragraph(late, CELL_RIGHT), Paragraph(extra, CELL_RIGHT),
        ])
    rows.append([Paragraph("<b>Total</b>", CELL), Paragraph("", CELL), Paragraph(f"<b>{fcfa(sum(m['contributed'] for m in members))}</b>", CELL_RIGHT),
                 Paragraph(f"<b>{fcfa(sum(m['late'] for m in members))}</b>", CELL_RIGHT), Paragraph("", CELL)])
    story.append(_table(rows, [usable * 0.36, usable * 0.12, usable * 0.18, usable * 0.16, usable * 0.18], total_row=True))

    story.append(Paragraph("3. Dépôts et versements du mois", H2))
    if not operations:
        story.append(Paragraph("Aucun dépôt ni versement ce mois-ci.", SMALL))
    else:
        rows = [[Paragraph(h, HEAD if i < 2 else HEAD_RIGHT) for i, h in enumerate(["Date", "Opération", "Montant"])]]
        for o in operations:
            what = KIND_LABELS[o["kind"]]
            if o.get("member_name"):
                what += f" · {o['member_name']}"
            if o.get("category_label"):
                what += f" · {o['category_label']}"
            if o.get("reference"):
                what += f" · réf. {o['reference']}"
            status = "annulé" if o["cancelled_at"] else ("validé" if o["validated_at"] else "à valider")
            rows.append([Paragraph(o["op_date"].strftime("%d/%m/%Y"), CELL), Paragraph(f"{_esc(what)} <font color='#6B7280'>({status})</font>", CELL),
                         Paragraph(fcfa(o["amount"]), CELL_RIGHT)])
        story.append(_table(rows, [usable * 0.16, usable * 0.6, usable * 0.24]))

    signatures = Table(
        [[Paragraph("Le président / la présidente", SMALL), Paragraph("Le trésorier / la trésorière", SMALL)],
         [Paragraph("<br/><br/><br/>Signature :", SMALL), Paragraph("<br/><br/><br/>Signature :", SMALL)]],
        colWidths=[usable / 2, usable / 2],
    )
    signatures.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE), ("TEXTCOLOR", (0, 0), (-1, -1), INK),
                                    ("TOPPADDING", (0, 0), (-1, -1), 4)]))
    story.append(Spacer(1, 8 * mm))
    story.append(KeepTogether([Paragraph("Lu et approuvé en réunion :", BODY), Spacer(1, 2 * mm), signatures]))

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    return buffer.getvalue()
