"""Donation receipt (PDF), attached to the thank-you email and downloadable from the dashboard.

A receipt exists only for a paid donation. It attests that the platform received the gift; it is
not a tax receipt.
"""

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from num2words import num2words
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

from core.config import settings

LOGO = Path(__file__).resolve().parent.parent / "assets" / "logo-senjapo.jpg"
BLUE = HexColor("#044990")
ORANGE = HexColor("#F57206")
INK = HexColor("#1A1A2E")
MUTED = HexColor("#6B7280")
LINE = HexColor("#E5E7EB")
TINT = HexColor("#EEF4FB")

METHOD_LABELS = {
    "stripe": "Carte bancaire",
    "card": "Carte bancaire",
    "wave": "Wave",
    "orange_money": "Orange Money",
}


def receipt_number(donation) -> str:
    return f"{settings.site_short_name}-{donation.id:06d}"


def _fcfa(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " FCFA"


def _in_words(amount: int) -> str:
    words = num2words(amount, lang="fr")
    return f"{words[:1].upper()}{words[1:]} francs CFA"


def _date(value: Optional[datetime]) -> str:
    return (value or datetime.now(timezone.utc)).strftime("%d/%m/%Y")


def build_receipt_pdf(donation, destination: str) -> bytes:
    """One A4 page: header band, carrier, amount (figures and words), details, thanks."""
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    number = receipt_number(donation)
    pdf.setTitle(f"Reçu de don {number}")
    pdf.setAuthor(settings.site_short_name)
    margin = 20 * mm

    # Header band
    band = 38 * mm
    pdf.setFillColor(BLUE)
    pdf.rect(0, height - band, width, band, stroke=0, fill=1)
    if LOGO.exists():
        tile = 26 * mm
        pdf.setFillColor(white)
        pdf.roundRect(margin, height - band + 6 * mm, tile, tile, 3 * mm, stroke=0, fill=1)
        pdf.drawImage(ImageReader(str(LOGO)), margin + 1.5 * mm, height - band + 7.5 * mm, tile - 3 * mm, tile - 3 * mm,
                      preserveAspectRatio=True, mask="auto")
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawRightString(width - margin, height - 18 * mm, "REÇU DE DON")
    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(width - margin, height - 25 * mm, f"N° {number}")
    pdf.drawRightString(width - margin, height - 30 * mm, f"Date du don : {_date(donation.created_at)}")

    # Carrier
    y = height - band - 12 * mm
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(margin, y, f"{settings.site_short_name} – {settings.site_name}")
    pdf.setFont("Helvetica", 9.5)
    pdf.setFillColor(MUTED)
    for line in (
        f"Initiative du {settings.carrier_name}",
        settings.carrier_receipt,
        f"{settings.contact_email} · {settings.contact_phones}",
    ):
        y -= 5 * mm
        pdf.drawString(margin, y, line)

    # Donor
    y -= 12 * mm
    donor = " ".join(filter(None, [donation.donor_first_name, donation.donor_last_name])).strip()
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(margin, y, "REÇU DE")
    y -= 6 * mm
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(margin, y, donor or "Donateur anonyme")
    pdf.setFont("Helvetica", 9.5)
    for line in filter(None, [donation.donor_email, donation.donor_phone]):
        y -= 5 * mm
        pdf.drawString(margin, y, line)

    # Amount box
    y -= 12 * mm
    box = 26 * mm
    pdf.setFillColor(TINT)
    pdf.roundRect(margin, y - box, width - 2 * margin, box, 3 * mm, stroke=0, fill=1)
    pdf.setFillColor(ORANGE)
    pdf.rect(margin, y - box, 2 * mm, box, stroke=0, fill=1)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(margin + 8 * mm, y - 7 * mm, "MONTANT DU DON")
    pdf.setFillColor(BLUE)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(margin + 8 * mm, y - 15 * mm, _fcfa(donation.amount))
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Oblique", 9.5)
    pdf.drawString(margin + 8 * mm, y - 21.5 * mm, _in_words(donation.amount))
    y -= box + 10 * mm

    # Details
    rows = [
        ("Destination", destination),
        ("Moyen de paiement", METHOD_LABELS.get(donation.payment_method, donation.payment_method)),
        ("Référence de paiement", donation.payment_reference or "—"),
        ("Statut", "Payé"),
    ]
    label_width = 55 * mm
    for label, value in rows:
        pdf.setStrokeColor(LINE)
        pdf.line(margin, y + 3 * mm, width - margin, y + 3 * mm)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 9.5)
        pdf.drawString(margin, y - 2 * mm, label)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 9.5)
        lines = simpleSplit(str(value), "Helvetica-Bold", 9.5, width - 2 * margin - label_width)
        for i, part in enumerate(lines[:3]):
            pdf.drawString(margin + label_width, y - 2 * mm - i * 4.5 * mm, part)
        y -= max(len(lines[:3]), 1) * 4.5 * mm + 6 * mm
    pdf.line(margin, y + 3 * mm, width - margin, y + 3 * mm)

    if donation.message:
        y -= 6 * mm
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Oblique", 9)
        for part in simpleSplit(f"« {donation.message} »", "Helvetica-Oblique", 9, width - 2 * margin)[:4]:
            pdf.drawString(margin, y, part)
            y -= 4.5 * mm

    # Thanks
    y -= 10 * mm
    pdf.setFillColor(BLUE)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(margin, y, "Merci pour votre générosité !")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica", 9.5)
    thanks = (
        f"Votre don soutient les campagnes de {settings.site_short_name} au service des populations du Sénégal. "
        "Conservez ce reçu comme justificatif de votre contribution."
    )
    for part in simpleSplit(thanks, "Helvetica", 9.5, width - 2 * margin):
        y -= 5 * mm
        pdf.drawString(margin, y, part)

    # Footer
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(margin, 15 * mm, "Ce reçu atteste la réception de votre don. Il ne constitue pas un reçu fiscal.")
    pdf.drawString(margin, 11 * mm, f"Document généré automatiquement le {_date(None)} · {number}")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
