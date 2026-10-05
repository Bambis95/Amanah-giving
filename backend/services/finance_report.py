"""Financial report (PDF) of one campaign or of the whole platform, for partners and authorities.

Several pages when needed: summary, income, detailed expenses, budget against actual spending,
and signature lines for the treasurer and the president.
"""

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.config import settings

LOGO = Path(__file__).resolve().parent.parent / "assets" / "logo-senjapo.jpg"
BLUE = HexColor("#044990")
INK = HexColor("#1A1A2E")
MUTED = HexColor("#6B7280")
LINE = HexColor("#E5E7EB")
TINT = HexColor("#EEF4FB")
RED = HexColor("#B91C1C")

BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=9, leading=12, textColor=INK)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8, leading=10, textColor=MUTED)
H2 = ParagraphStyle("h2", parent=BODY, fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=BLUE, spaceBefore=10, spaceAfter=6)
CELL = ParagraphStyle("cell", parent=BODY, fontSize=8.5, leading=10.5)
CELL_RIGHT = ParagraphStyle("cellr", parent=CELL, alignment=TA_RIGHT)
HEAD = ParagraphStyle("head", parent=CELL, fontName="Helvetica-Bold", textColor=white)
HEAD_RIGHT = ParagraphStyle("headr", parent=HEAD, alignment=TA_RIGHT)

BAND = 30 * mm
MARGIN = 16 * mm


def fcfa(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " FCFA"


def _esc(text: Optional[str]) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _table(rows, widths, total_row=False, highlight_last=False):
    """Blue header row, thin rules, optional bold total row."""
    table = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
    ]
    if total_row:
        style += [("BACKGROUND", (0, -1), (-1, -1), TINT), ("LINEABOVE", (0, -1), (-1, -1), 0.8, BLUE)]
    table.setStyle(TableStyle(style))
    return table


def build_finance_report(
    *,
    project,
    year: Optional[int],
    donations_total: int,
    donations_count: int,
    donations_by_method: dict,
    entries: list,
    memberships_total: int = 0,
    budget: list,
    income_labels: dict,
    expense_labels: dict,
    method_labels: dict,
    author: str,
) -> bytes:
    buffer = io.BytesIO()
    width, height = A4
    period = f"Année {year}" if year else "Depuis le lancement"
    scope = project.title if project else "Ensemble de la plateforme"
    generated = datetime.now(timezone.utc).strftime("%d/%m/%Y")

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
        canvas.setFont("Helvetica-Bold", 16)
        canvas.drawRightString(width - MARGIN, height - 13 * mm, "RAPPORT FINANCIER")
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(width - MARGIN, height - 19 * mm, scope[:80])
        canvas.drawRightString(width - MARGIN, height - 24 * mm, period)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(MARGIN, 12 * mm, f"{settings.site_short_name} · {settings.carrier_name} · {settings.carrier_receipt}")
        canvas.drawString(MARGIN, 8.5 * mm, f"Généré le {generated} par {author[:40]}")
        canvas.drawRightString(width - MARGIN, 8.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=BAND + 8 * mm, bottomMargin=18 * mm,
        title=f"Rapport financier – {scope}", author=settings.site_short_name,
    )
    usable = width - 2 * MARGIN
    story = []

    incomes = [(e, t) for e, t in entries if e.kind == "income"]
    expenses = [(e, t) for e, t in entries if e.kind == "expense"]
    other_income = sum(e.amount for e, _ in incomes) + memberships_total
    spent = sum(e.amount for e, _ in expenses)
    balance = donations_total + other_income - spent

    # 1. Summary
    story.append(Paragraph("1. Synthèse", H2))
    rows = [[Paragraph("Poste", HEAD), Paragraph("Montant", HEAD_RIGHT)]]
    summary = [
        (f"Dons en ligne ({donations_count} don{'s' if donations_count > 1 else ''} payé{'s' if donations_count > 1 else ''})", donations_total),
        ("Autres recettes (subventions, cotisations, espèces…)", other_income),
        ("Total des recettes", donations_total + other_income),
        ("Total des dépenses", spent),
    ]
    if project:
        summary = [("Objectif de collecte", project.goal)] + ([("Budget prévu", sum(l.planned_amount for l in budget))] if budget else []) + summary
    for label, amount in summary:
        rows.append([Paragraph(_esc(label), CELL), Paragraph(fcfa(amount), CELL_RIGHT)])
    balance_style = ParagraphStyle("bal", parent=CELL_RIGHT, fontName="Helvetica-Bold", textColor=RED if balance < 0 else INK)
    rows.append([Paragraph("<b>Solde disponible</b>", CELL), Paragraph(fcfa(balance), balance_style)])
    story.append(_table(rows, [usable * 0.7, usable * 0.3], total_row=True))

    # 2. Income
    story.append(Paragraph("2. Recettes", H2))
    rows = [[Paragraph("Origine", HEAD), Paragraph("Détail", HEAD), Paragraph("Montant", HEAD_RIGHT)]]
    for method, amount in sorted(donations_by_method.items(), key=lambda kv: -kv[1]):
        rows.append([Paragraph("Dons en ligne", CELL), Paragraph(_esc(method_labels.get(method, method)), CELL), Paragraph(fcfa(amount), CELL_RIGHT)])
    if memberships_total:
        rows.append([Paragraph("Cotisations", CELL), Paragraph("Cotisations au club payées en ligne", CELL), Paragraph(fcfa(memberships_total), CELL_RIGHT)])
    for entry, _ in incomes:
        detail = f"{entry.entry_date.strftime('%d/%m/%Y')} · {_esc(entry.label)}"
        if entry.reference:
            detail += f" · réf. {_esc(entry.reference)}"
        rows.append([Paragraph(_esc(income_labels.get(entry.category, entry.category)), CELL), Paragraph(detail, CELL), Paragraph(fcfa(entry.amount), CELL_RIGHT)])
    rows.append([Paragraph("<b>Total</b>", CELL), "", Paragraph(f"<b>{fcfa(donations_total + other_income)}</b>", CELL_RIGHT)])
    story.append(_table(rows, [usable * 0.3, usable * 0.47, usable * 0.23], total_row=True))

    # 3. Expenses
    story.append(Paragraph("3. Dépenses détaillées", H2))
    if not expenses:
        story.append(Paragraph("Aucune dépense enregistrée sur la période.", SMALL))
    else:
        head = ["Date", "Libellé", "Catégorie"] + ([] if project else ["Campagne"]) + ["Montant"]
        rows = [[Paragraph(h, HEAD_RIGHT if h == "Montant" else HEAD) for h in head]]
        for entry, title in expenses:
            label = _esc(entry.label)
            extra = " · ".join(filter(None, [method_labels.get(entry.payment_method), entry.reference and f"réf. {_esc(entry.reference)}"]))
            if extra:
                label += f"<br/><font size=7 color='#6B7280'>{extra}</font>"
            row = [
                Paragraph(entry.entry_date.strftime("%d/%m/%Y"), CELL),
                Paragraph(label, CELL),
                Paragraph(_esc(expense_labels.get(entry.category, entry.category)), CELL),
            ]
            if not project:
                row.append(Paragraph(_esc(title or "Frais généraux"), CELL))
            row.append(Paragraph(fcfa(entry.amount), CELL_RIGHT))
            rows.append(row)
        total = [Paragraph("<b>Total</b>", CELL), "", ""] + ([] if project else [""]) + [Paragraph(f"<b>{fcfa(spent)}</b>", CELL_RIGHT)]
        rows.append(total)
        widths = [0.12, 0.43, 0.23, 0.22] if project else [0.11, 0.33, 0.19, 0.19, 0.18]
        story.append(_table(rows, [usable * w for w in widths], total_row=True))

        by_category: dict = {}
        for entry, _ in expenses:
            by_category[entry.category] = by_category.get(entry.category, 0) + entry.amount
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            "Par catégorie : " + " · ".join(f"{_esc(expense_labels.get(c, c))} {fcfa(v)}" for c, v in sorted(by_category.items(), key=lambda kv: -kv[1])),
            SMALL,
        ))

    # 4. Budget against actual spending (one campaign)
    if project and budget:
        story.append(Paragraph("4. Budget prévu et dépenses réelles", H2))
        spent_by = {}
        for entry, _ in expenses:
            spent_by[entry.category] = spent_by.get(entry.category, 0) + entry.amount
        rows = [[Paragraph(h, HEAD_RIGHT if h in ("Prévu", "Dépensé", "Reste") else HEAD) for h in ["Ligne", "Catégorie", "Prévu", "Dépensé", "Reste"]]]
        counted = set()
        for line in budget:
            used = spent_by.get(line.category, 0) if line.category not in counted else 0
            counted.add(line.category)
            left = line.planned_amount - used
            rows.append([
                Paragraph(_esc(line.label), CELL),
                Paragraph(_esc(expense_labels.get(line.category, line.category)), CELL),
                Paragraph(fcfa(line.planned_amount), CELL_RIGHT),
                Paragraph(fcfa(used), CELL_RIGHT),
                Paragraph(fcfa(left), ParagraphStyle("left", parent=CELL_RIGHT, textColor=RED if left < 0 else INK)),
            ])
        planned = sum(l.planned_amount for l in budget)
        rows.append([Paragraph("<b>Total</b>", CELL), "", Paragraph(f"<b>{fcfa(planned)}</b>", CELL_RIGHT), Paragraph(f"<b>{fcfa(spent)}</b>", CELL_RIGHT), Paragraph(f"<b>{fcfa(planned - spent)}</b>", CELL_RIGHT)])
        story.append(_table(rows, [usable * w for w in (0.25, 0.2, 0.185, 0.18, 0.185)], total_row=True))
        story.append(Spacer(1, 4))
        story.append(Paragraph("Les dépenses sont rapprochées des lignes par catégorie.", SMALL))

    # Signatures
    signatures = Table(
        [
            [Paragraph("Le Trésorier", BODY), "", Paragraph("Le Président", BODY)],
            ["", "", ""],
            [Paragraph("Signature et date", SMALL), "", Paragraph("Signature et date", SMALL)],
        ],
        colWidths=[usable * 0.42, usable * 0.16, usable * 0.42],
        rowHeights=[None, 16 * mm, None],
    )
    signatures.setStyle(TableStyle([
        ("LINEBELOW", (0, 1), (0, 1), 0.6, MUTED),
        ("LINEBELOW", (2, 1), (2, 1), 0.6, MUTED),
    ]))
    story.append(Spacer(1, 8 * mm))
    story.append(KeepTogether([
        Paragraph(
            "Montants en francs CFA. Les dons en ligne sont ceux confirmés par les opérateurs de paiement ; les écritures "
            "annulées ne sont pas comptées. Les justificatifs sont conservés par la trésorerie.",
            SMALL,
        ),
        Spacer(1, 6 * mm),
        signatures,
    ]))

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    return buffer.getvalue()


MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def month_label(key: str) -> str:
    year, month = key.split("-")
    return f"{MONTHS[int(month) - 1].capitalize()} {year}"


def build_commission_statement(*, data: dict, year: Optional[int], author: str) -> bytes:
    """Statement of the platform commission: owed month by month, paid, balance; signed by both sides."""
    buffer = io.BytesIO()
    width, height = A4
    period = f"Année {year}" if year else "Depuis le lancement"
    generated = datetime.now(timezone.utc).strftime("%d/%m/%Y")

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
        canvas.setFont("Helvetica-Bold", 16)
        canvas.drawRightString(width - MARGIN, height - 13 * mm, "RELEVÉ DE COMMISSION")
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(width - MARGIN, height - 19 * mm, "Commission de la plateforme")
        canvas.drawRightString(width - MARGIN, height - 24 * mm, period)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(MARGIN, 12 * mm, f"{settings.site_short_name} · {settings.carrier_name} · {settings.carrier_receipt}")
        canvas.drawString(MARGIN, 8.5 * mm, f"Généré le {generated} par {author[:40]}")
        canvas.drawRightString(width - MARGIN, 8.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=BAND + 8 * mm, bottomMargin=18 * mm,
        title="Relevé de commission", author=settings.site_short_name,
    )
    usable = width - 2 * MARGIN
    story = []

    payee = data.get("payee") or "le prestataire de la plateforme"
    rates = " ; ".join(f"{h['percent']} % à partir du {datetime.fromisoformat(h['since']).strftime('%d/%m/%Y')}" for h in data["history"])
    story.append(Paragraph(
        f"Commission due à <b>{_esc(payee)}</b> sur les dons payés (en ligne et dépôts Wave / Orange Money confirmés), "
        f"hors cotisations au club. Taux convenu : {_esc(rates) or 'aucun'}. Chaque don est compté au taux en vigueur le jour du don.",
        BODY,
    ))

    story.append(Paragraph("1. Synthèse", H2))
    balance = data["balance"]
    rows = [[Paragraph("Poste", HEAD), Paragraph("Montant", HEAD_RIGHT)]]
    rows.append([Paragraph("Commission due", CELL), Paragraph(fcfa(data["owed"]), CELL_RIGHT)])
    rows.append([Paragraph("Déjà réglé (enregistré dans Finances)", CELL), Paragraph(fcfa(data["paid"]), CELL_RIGHT)])
    balance_style = ParagraphStyle("bal", parent=CELL_RIGHT, fontName="Helvetica-Bold", textColor=RED if balance < 0 else INK)
    rows.append([Paragraph("<b>Reste à régler</b>", CELL), Paragraph(fcfa(balance), balance_style)])
    story.append(_table(rows, [usable * 0.7, usable * 0.3], total_row=True))

    story.append(Paragraph("2. Détail par mois", H2))
    if not data["months"]:
        story.append(Paragraph("Aucun don payé sur la période.", SMALL))
    else:
        rows = [[Paragraph(h, HEAD if h == "Mois" else HEAD_RIGHT) for h in ["Mois", "Dons", "Montant collecté", "Commission"]]]
        for m in data["months"]:
            rows.append([
                Paragraph(month_label(m["month"]), CELL), Paragraph(str(m["donations"]), CELL_RIGHT),
                Paragraph(fcfa(m["collected"]), CELL_RIGHT), Paragraph(fcfa(m["owed"]), CELL_RIGHT),
            ])
        rows.append([
            Paragraph("<b>Total</b>", CELL), Paragraph(f"<b>{sum(m['donations'] for m in data['months'])}</b>", CELL_RIGHT),
            Paragraph(f"<b>{fcfa(sum(m['collected'] for m in data['months']))}</b>", CELL_RIGHT),
            Paragraph(f"<b>{fcfa(data['owed'])}</b>", CELL_RIGHT),
        ])
        story.append(_table(rows, [usable * w for w in (0.34, 0.14, 0.27, 0.25)], total_row=True))

    signatures = Table(
        [
            [Paragraph("Le prestataire", BODY), "", Paragraph("Le Président", BODY)],
            ["", "", ""],
            [Paragraph("Signature et date", SMALL), "", Paragraph("Signature et date", SMALL)],
        ],
        colWidths=[usable * 0.42, usable * 0.16, usable * 0.42],
        rowHeights=[None, 16 * mm, None],
    )
    signatures.setStyle(TableStyle([("LINEBELOW", (0, 1), (0, 1), 0.6, MUTED), ("LINEBELOW", (2, 1), (2, 1), 0.6, MUTED)]))
    story.append(Spacer(1, 8 * mm))
    story.append(KeepTogether([
        Paragraph(
            "Montants en francs CFA, arrondis au franc inférieur pour chaque don. Les dons sont ceux confirmés par les "
            "opérateurs ou vérifiés par l'équipe ; les règlements sont les dépenses « Commission de la plateforme » de Finances.",
            SMALL,
        ),
        Spacer(1, 6 * mm),
        signatures,
    ]))

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    return buffer.getvalue()
