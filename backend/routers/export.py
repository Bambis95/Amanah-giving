"""Full data export for administrators: one ZIP with a CSV per table, the photos and the finance documents.

Used as a backup and for the hand-over foreseen by the contract. Secrets are never exported:
password hashes, session versions, sign-in codes, authenticator secrets and recovery codes, invitation and reset
tokens, unsubscribe tokens.
"""

import csv
import io
import json
import zipfile
from datetime import date, datetime, timezone
from typing import Dict, Tuple

from core.database import get_db
from dependencies.auth import get_admin_actor
from fastapi import APIRouter, Depends, Response
from models.audit_log import AuditLog
from models.auth import User
from models.contact_messages import Contact_messages
from models.donations import Donations
from models.finance import FinanceDocument, FinanceEntry, ProjectBudgetLine
from models.image import StoredImage
from models.newsletter import NewsletterIssue, Subscriber
from models.project_update import ProjectUpdate
from models.projects import Projects
from models.site_setting import SiteSetting
from services import audit
from services.audit import Actor
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/admin/export", tags=["export"])

# file name → (model, columns never exported)
TABLES = {
    "campagnes": (Projects, set()),
    "actualites": (ProjectUpdate, set()),
    "dons": (Donations, set()),
    "comptes": (User, {"password_hash", "token_version", "totp_secret", "totp_pending", "totp_last_step", "totp_recovery"}),
    "messages": (Contact_messages, set()),
    "finances_ecritures": (FinanceEntry, set()),
    "finances_budgets": (ProjectBudgetLine, set()),
    "finances_justificatifs": (FinanceDocument, {"data"}),
    "photos": (StoredImage, {"data"}),
    "newsletter_abonnes": (Subscriber, {"token"}),
    "newsletter_envois": (NewsletterIssue, set()),
    "reglages_site": (SiteSetting, set()),
    "journal": (AuditLog, set()),
}

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf"}


def _cell(value):
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def _csv(rows, columns) -> bytes:
    # ";" and a BOM: opens directly in Excel set to French
    out = io.StringIO()
    writer = csv.writer(out, delimiter=";")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([_cell(getattr(row, c)) for c in columns])
    return ("﻿" + out.getvalue()).encode("utf-8")


async def build_archive(db: AsyncSession, with_files: bool = True) -> Tuple[bytes, Dict[str, int]]:
    """The ZIP and the number of rows per table. Without files: CSVs only (small enough for an email)."""
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    buffer = io.BytesIO()
    counts: Dict[str, int] = {}
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, (model, hidden) in TABLES.items():
            columns = [c.name for c in model.__table__.columns if c.name not in hidden]
            rows = list((await db.execute(select(model))).scalars())
            counts[name] = len(rows)
            archive.writestr(f"{name}.csv", _csv(rows, columns))
        if with_files:
            for image in (await db.execute(select(StoredImage))).scalars():
                archive.writestr(f"fichiers/photos/{image.id}.{EXTENSIONS.get(image.content_type, 'bin')}", image.data)
            for doc in (await db.execute(select(FinanceDocument))).scalars():
                archive.writestr(f"fichiers/justificatifs/{doc.id}.{EXTENSIONS.get(doc.content_type, 'bin')}", doc.data)
        files_note = (
            "Les photos et les justificatifs financiers sont dans le dossier fichiers/, nommés par leur identifiant\n"
            "(colonnes image, gallery, document_id).\n"
            if with_files
            else "Les photos et justificatifs ne sont pas inclus : téléchargez l'export complet depuis le tableau de bord.\n"
        )
        chain = await audit.verify_chain(db)
        archive.writestr(
            "LISEZMOI.txt",
            "Export des données de la plateforme SENJAPO du " + stamp + ".\n\n"
            "Chaque fichier .csv s'ouvre dans Excel (séparateur « ; »).\n" + files_note +
            "Les mots de passe, codes et jetons de sécurité ne sont jamais exportés.\n\n"
            "Sceau du journal à cette date (preuve qu'aucune entrée antérieure n'a été modifiée ni supprimée) :\n"
            + (chain["last_seal"] or "aucun") + "\n",
        )
    return buffer.getvalue(), counts


@router.get("")
async def export_all(db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    content, counts = await build_archive(db)
    await audit.record(
        db, actor, "security.data_export", "Export complet des données téléchargé",
        target_type="export", details=counts,
    )
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="senjapo-export-{stamp}.zip"', "Cache-Control": "private, no-store"},
    )
