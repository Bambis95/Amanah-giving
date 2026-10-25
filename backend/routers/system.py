"""Santé du système: live state of the server, incidents to resolve, settings checks and capacity.

Read by the president and admins; only admins resolve incidents and send a test alert. Browsers report
their own crashes to /api/v1/monitoring/client-error (public, rate-limited, never emailed).
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from core.config import settings
from core.database import get_db
from dependencies.auth import client_ip, get_admin_actor, get_manager_user
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from models.auth import User
from models.system_incident import SystemIncident
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services import alerts, audit, donation_switch, monitoring
from services import email as mail
from services.audit import Actor
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/admin/system", tags=["system"])
public_router = APIRouter(prefix="/api/v1/monitoring", tags=["system"])

KIND_LABELS = {
    "error": "Erreur du serveur",
    "payment": "Paiement",
    "email": "Emails",
    "database": "Base de données",
    "memory": "Mémoire",
    "cpu": "Processeur",
    "slow": "Lenteur",
    "restart": "Redémarrage",
    "client": "Navigateur",
    "backup": "Sauvegarde",
    "server": "Serveur",
    "report": "Signalement",
}


def _incident(row: SystemIncident, resolver: Optional[str] = None) -> Dict[str, Any]:
    return {
        "id": row.id,
        "kind": row.kind,
        "kind_label": KIND_LABELS.get(row.kind, row.kind),
        "severity": row.severity,
        "title": row.title,
        "detail": row.detail,
        "path": row.path,
        "count": row.count,
        "first_seen": row.first_seen,
        "last_seen": row.last_seen,
        "emailed_at": row.emailed_at,
        "resolved_at": row.resolved_at,
        "resolved_by_name": resolver,
        "resolution_note": row.resolution_note,
    }


def _check(id: str, label: str, status: str, detail: str) -> Dict[str, str]:
    return {"id": id, "label": label, "status": status, "detail": detail}


def _date(value: Optional[datetime]) -> str:
    return value.astimezone(timezone.utc).strftime("%d/%m/%Y à %H:%M UTC") if value else "jamais"


async def _checks(db: AsyncSession, database: Dict[str, Any]) -> List[Dict[str, str]]:
    now = datetime.now(timezone.utc)
    checks = []

    if database["ok"]:
        status = "warning" if (database.get("latency_ms") or 0) > 300 else "ok"
        extra = f", {database['connections']} connexions sur {database['max_connections']}" if database.get("max_connections") else ""
        checks.append(_check("database", "Base de données", status, f"Répond en {database['latency_ms']} ms{extra}."))
    else:
        checks.append(_check("database", "Base de données", "critical", database.get("error") or "Ne répond pas."))

    if not mail.email_enabled():
        checks.append(_check("email", "Envoi des emails", "critical",
                             "SMTP non configuré : ni codes de connexion, ni reçus, ni alertes. Remplir SMTP_* dans Render."))
    else:
        failures = [f for f in mail.recent_failures if now - f[1] < timedelta(hours=24)]
        if failures:
            checks.append(_check("email", "Envoi des emails", "warning",
                                 f"{len(failures)} échec(s) en 24 h, le dernier le {_date(failures[-1][1])} : {failures[-1][3]}"))
        else:
            checks.append(_check("email", "Envoi des emails", "ok",
                                 f"Configuré ({settings.email_from}). Dernier envoi réussi : {_date(mail.last_success)}."))

    provider = settings.payment_provider.lower()
    if provider == "paytech":
        keys = bool(settings.paytech_api_key and settings.paytech_api_secret)
        name, mode = "PayTech", settings.paytech_env
    else:
        keys = bool(settings.paydunya_master_key and settings.paydunya_private_key and settings.paydunya_token)
        name, mode = "PayDunya", settings.paydunya_mode
    if not await donation_switch.donations_open(db):
        checks.append(_check("payment", "Paiements en ligne", "info",
                             f"Dons fermés (mode « bientôt disponible »). Prestataire : {name}, clés {'présentes' if keys else 'absentes'}, mode {mode}."))
    elif not keys:
        checks.append(_check("payment", "Paiements en ligne", "critical", f"Dons ouverts mais clés {name} absentes : aucun don ne passe."))
    elif mode != "prod" and mode != "live":
        checks.append(_check("payment", "Paiements en ligne", "warning",
                             f"{name} en mode {mode} : les dons ne sont pas réellement encaissés. Passer en prod après l'activation."))
    else:
        checks.append(_check("payment", "Paiements en ligne", "ok", f"{name} en production, dons ouverts."))

    if settings.backup_email_days <= 0:
        checks.append(_check("backup", "Sauvegarde automatique", "warning", "Désactivée (BACKUP_EMAIL_DAYS=0)."))
    else:
        last = await monitoring.last_backup()
        late = last is None or now - last > timedelta(days=settings.backup_email_days + 2)
        checks.append(_check("backup", "Sauvegarde automatique", "warning" if late else "ok",
                             f"Tous les {settings.backup_email_days} jours par email. Dernière : {_date(last)}."))

    team = (await db.execute(
        select(User.role, User.totp_secret.is_not(None)).where(
            User.role.in_(("treasurer", "accountant", "president", "admin")), User.suspended_at.is_(None)
        )
    )).all()
    without = sum(1 for _, has in team if not has)
    if not settings.require_2fa_for_team:
        checks.append(_check("2fa", "Double authentification de l'équipe", "warning",
                             "Non obligatoire (REQUIRE_2FA_FOR_TEAM=false) : à remettre à true."))
    else:
        checks.append(_check("2fa", "Double authentification de l'équipe", "warning" if without else "ok",
                             f"Obligatoire. {len(team) - without} compte(s) sur {len(team)} l'ont activée"
                             + (f" ; {without} n'ont pas encore accès au tableau de bord." if without else ".")))

    secure = settings.session_cookie_secure and settings.frontend_url.startswith("https://")
    checks.append(_check("https", "Connexions sécurisées (HTTPS)", "ok" if secure else "warning",
                         f"Site : {settings.frontend_url}" + ("" if secure else " — cookies non sécurisés (normal en local seulement).")))

    owner = (await db.execute(select(func.count()).select_from(User).where(User.is_technical_owner.is_(True)))).scalar()
    checks.append(_check("owner", "Propriétaire technique", "ok" if owner else "info",
                         "Défini." if owner else "Aucun (scripts/make_owner.py)."))
    return checks


@router.get("")
async def system_status(db: AsyncSession = Depends(get_db), _reader: UserResponse = Depends(get_manager_user)):
    await monitoring.drain_email_failures()
    database = await monitoring.database_reading()
    open_rows = (await db.execute(
        select(SystemIncident.severity, func.count()).where(SystemIncident.resolved_at.is_(None)).group_by(SystemIncident.severity)
    )).all()
    open_counts = {severity: n for severity, n in open_rows}
    checks = await _checks(db, database)

    worst = "ok"
    if open_counts.get("critical") or any(c["status"] == "critical" for c in checks) or not database["ok"]:
        worst = "critical"
    elif open_counts.get("warning") or any(c["status"] == "warning" for c in checks):
        worst = "warning"

    routes = [
        {"route": name, "count": s.count, "server_errors": s.server_errors, "avg_ms": round(s.total_ms / s.count), "max_ms": round(s.max_ms)}
        for name, s in monitoring.metrics.routes.items() if s.count
    ]
    cpu5, cpu60 = monitoring.metrics.cpu(5), monitoring.metrics.cpu(60)
    now = datetime.now(timezone.utc)
    return {
        "status": worst,
        "checked_at": now,
        "server": {
            "started_at": monitoring.metrics.started_at,
            "uptime_seconds": int((now - monitoring.metrics.started_at).total_seconds()),
            "version": monitoring.version(),
            "environment": "production" if settings.frontend_url.startswith("https://") else "local",
            "watchdog_seconds": settings.monitor_every_seconds,
        },
        "resources": {
            "cpu_limit": monitoring.cpu_limit(),
            "cpu_percent_5m": cpu5["percent"] if cpu5 else None,
            "cpu_percent_1h": cpu60["percent"] if cpu60 else None,
            "memory": monitoring.memory(),
            "active_requests": monitoring.metrics.active,
            "peak_active_requests": monitoring.metrics.peak_active,
        },
        "traffic": {
            "last_5m": monitoring.metrics.window(5),
            "last_1h": monitoring.metrics.window(60),
            "last_24h": monitoring.metrics.window(24 * 60),
        },
        "hourly": monitoring.metrics.hourly(24),
        "slow_routes": sorted([r for r in routes if r["count"] >= 3], key=lambda r: -r["avg_ms"])[:6],
        "error_routes": sorted([r for r in routes if r["server_errors"]], key=lambda r: -r["server_errors"])[:6],
        "database": database,
        "capacity": monitoring.capacity(),
        "checks": checks,
        "incidents": {"open": sum(open_counts.values()), "critical": open_counts.get("critical", 0), "warning": open_counts.get("warning", 0)},
    }


@router.get("/incidents")
async def list_incidents(
    status: str = Query("open", pattern="^(open|resolved|all)$"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _reader: UserResponse = Depends(get_manager_user),
):
    query = select(SystemIncident, User.name, User.email).outerjoin(User, User.id == SystemIncident.resolved_by)
    if status == "open":
        query = query.where(SystemIncident.resolved_at.is_(None))
    elif status == "resolved":
        query = query.where(SystemIncident.resolved_at.is_not(None))
    rows = (await db.execute(query.order_by(SystemIncident.last_seen.desc()).limit(limit))).all()
    items = [_incident(row, name or email) for row, name, email in rows]
    if status == "open":
        items.sort(key=lambda i: monitoring.SEVERITY_ORDER.get(i["severity"], 3))
    open_count = (await db.execute(select(func.count()).select_from(SystemIncident).where(SystemIncident.resolved_at.is_(None)))).scalar()
    return {"items": items, "open_count": open_count}


class ResolveRequest(BaseModel):
    note: str = Field("", max_length=500)


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: int, data: ResolveRequest, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)
):
    row = await db.get(SystemIncident, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    if row.resolved_at:
        raise HTTPException(status_code=409, detail="Incident déjà résolu")
    row.resolved_at = datetime.now(timezone.utc)
    row.resolved_by = actor.id
    row.resolution_note = data.note.strip() or None
    await db.commit()
    await audit.record(
        db, actor, "system.incident_resolved", f"Incident résolu : {row.title}", "system_incident", row.id,
        {"note": row.resolution_note, "count": row.count},
    )
    return _incident(row, actor.email)


@router.post("/incidents/resolve-all")
async def resolve_all(data: ResolveRequest, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    """After a fix (e.g. a new version deployed): close everything still open."""
    result = await db.execute(
        update(SystemIncident)
        .where(SystemIncident.resolved_at.is_(None))
        .values(resolved_at=datetime.now(timezone.utc), resolved_by=actor.id, resolution_note=data.note.strip() or None)
    )
    await db.commit()
    count = result.rowcount or 0
    if count:
        await audit.record(db, actor, "system.incidents_resolved", f"{count} incident(s) marqué(s) comme résolu(s)", details={"note": data.note})
    return {"resolved": count}


@router.post("/test-alert")
async def test_alert(db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_admin_actor)):
    """Check that the alerts reach the admins' mailboxes."""
    recipients = await alerts.admin_emails(db)
    if not mail.email_enabled():
        raise HTTPException(status_code=400, detail="L'envoi d'emails n'est pas configuré (SMTP_* dans Render)")
    if not recipients:
        raise HTTPException(status_code=400, detail="Aucun administrateur actif à prévenir")
    message = alerts.build_alert(
        recipients, "Alerte de test",
        f"Ceci est un essai demandé par {actor.email} depuis Santé du système.\n\n"
        "Si vous lisez ce message, les alertes de pannes vous parviennent. Pensez à vérifier le dossier « Spam » "
        "et à marquer l'expéditeur comme fiable.",
    )
    delivered = await asyncio.to_thread(mail.deliver, message, "test alert")
    await audit.record(db, actor, "system.test_alert", "Alerte de test envoyée" if delivered else "Alerte de test : échec de l'envoi")
    if not delivered:
        error = next((f[3] for f in reversed(mail.recent_failures) if f[2] == "test alert"), "")
        raise HTTPException(status_code=502, detail=f"L'email n'a pas pu partir. {smtp_advice(error)} (Réponse du serveur : {error[:200]})")
    return {"sent_to": recipients}


def smtp_advice(error: str) -> str:
    """What to change in Render for the usual Gmail refusals (the error never contains the password)."""
    if "535" in error or "Username and Password not accepted" in error or "BadCredentials" in error:
        return ("Gmail refuse l'identifiant ou le mot de passe : SMTP_USERNAME doit être l'adresse Gmail complète et "
                "SMTP_PASSWORD un mot de passe d'application de 16 lettres (pas le mot de passe du compte).")
    if "534" in error or "Application-specific password" in error:
        return "Gmail exige un mot de passe d'application : activez la validation en deux étapes du compte Google, puis créez-en un."
    if "timed out" in error or "Timeout" in error or "Connection refused" in error or "getaddrinfo" in error:
        return f"Le serveur d'envoi ne répond pas : vérifiez SMTP_HOST (smtp.gmail.com) et SMTP_PORT (587). Actuel : {settings.smtp_host}:{settings.smtp_port}."
    if "550" in error or "553" in error or "sender" in error.lower():
        return "L'adresse d'expédition est refusée : EMAIL_FROM doit être la même adresse que SMTP_USERNAME."
    return "Vérifiez SMTP_USERNAME, SMTP_PASSWORD et EMAIL_FROM dans Render."


class ClientError(BaseModel):
    message: str = Field(..., max_length=1000)
    stack: str = Field("", max_length=8000)
    page: str = Field("", max_length=500)


@public_router.post("/client-error", status_code=204)
async def client_error(data: ClientError, request: Request):
    """A visitor's browser hit a JavaScript error (blank page, broken button)."""
    if not monitoring.is_noise(data.message, data.stack) and monitoring.client_report_allowed(client_ip(request) or "?"):
        await monitoring.report_client_error(
            data.message.strip() or "Erreur inconnue", data.stack, data.page, request.headers.get("user-agent", "")
        )
    return Response(status_code=204)
