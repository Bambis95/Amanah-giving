"""Health of the platform for the admins: live figures of the server, incidents, alerts and capacity.

- Every request is counted per minute (number, errors, response time), in memory, for 24 hours.
- Crashes, payment and email outages, overloads and unexpected restarts become incidents (table
  system_incidents): the admins see them in Tableau de bord → Santé du système and mark them resolved.
  A new critical or warning incident is emailed to the admins (again after 24 h if still happening).
- A watchdog checks every MONITOR_EVERY_SECONDS the database, memory, CPU, error rate and backup;
  a problem that goes away is closed automatically ("Rétabli automatiquement").
"""

import asyncio
import hashlib
import logging
import os
import time
import traceback
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional, Tuple

from core.config import settings
from core.database import db_manager
from models.site_setting import SiteSetting
from models.system_incident import SystemIncident
from services import alerts
from services import email as mail
from sqlalchemy import delete, select, text, update

logger = logging.getLogger(__name__)

# Response-time buckets in milliseconds; the last bucket holds everything slower
LATENCY_EDGES = (50, 100, 250, 500, 1000, 2000, 5000, 10000)
SLOW_MS = 2000
DETAIL_MAX = 4000
REMIND_AFTER = timedelta(hours=24)
KEEP_RESOLVED = timedelta(days=180)
STATE_KEY = "server_instances"
INSTANCE_ID = os.environ.get("RENDER_INSTANCE_ID") or uuid.uuid4().hex[:12]

# CPU time the server spends per request when nothing is measured yet (FastAPI + one or two queries)
DEFAULT_CPU_PER_REQUEST = 0.025
# A visitor browsing the site calls the server about once every 20 seconds (the pages themselves
# come from Render's CDN; campaign photos are cached by the browser for a year)
SECONDS_BETWEEN_VISITOR_CALLS = 20
REQUESTS_PER_DONATION = 6
# Keep 30 % of the processor free for peaks
USABLE_CPU_SHARE = 0.7

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Live figures (memory of this server process only: they restart at zero after a deploy)
# ---------------------------------------------------------------------------


@dataclass
class Minute:
    start: int  # minutes since 1970
    requests: int = 0
    server_errors: int = 0
    client_errors: int = 0
    total_ms: float = 0.0
    max_ms: float = 0.0
    slow: int = 0
    histogram: List[int] = field(default_factory=lambda: [0] * (len(LATENCY_EDGES) + 1))


@dataclass
class RouteStats:
    count: int = 0
    server_errors: int = 0
    total_ms: float = 0.0
    max_ms: float = 0.0


class Metrics:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.started_at = utcnow()
        self.minutes: Deque[Minute] = deque(maxlen=24 * 60)
        self.routes: Dict[str, RouteStats] = {}
        self.active = 0
        self.peak_active = 0
        # (wall clock, process CPU seconds), one sample per watchdog check
        self.cpu_samples: Deque[Tuple[float, float]] = deque(maxlen=24 * 60 + 1)
        self.cpu_samples.append((time.time(), cpu_seconds()))

    def _minute(self, now: float) -> Minute:
        start = int(now // 60)
        if not self.minutes or self.minutes[-1].start != start:
            self.minutes.append(Minute(start=start))
        return self.minutes[-1]

    def record(self, method: str, route: str, status: int, ms: float, now: Optional[float] = None) -> None:
        minute = self._minute(now or time.time())
        minute.requests += 1
        minute.total_ms += ms
        minute.max_ms = max(minute.max_ms, ms)
        if status >= 500:
            minute.server_errors += 1
        elif status >= 400:
            minute.client_errors += 1
        if ms >= SLOW_MS:
            minute.slow += 1
        minute.histogram[next((i for i, edge in enumerate(LATENCY_EDGES) if ms <= edge), len(LATENCY_EDGES))] += 1

        stats = self.routes.setdefault(f"{method} {route}", RouteStats())
        stats.count += 1
        stats.total_ms += ms
        stats.max_ms = max(stats.max_ms, ms)
        if status >= 500:
            stats.server_errors += 1

    def window(self, minutes: int, now: Optional[float] = None) -> Dict[str, Any]:
        """Totals of the last `minutes` minutes."""
        since = int((now or time.time()) // 60) - minutes + 1
        picked = [m for m in self.minutes if m.start >= since]
        requests = sum(m.requests for m in picked)
        histogram = [sum(m.histogram[i] for m in picked) for i in range(len(LATENCY_EDGES) + 1)]
        errors = sum(m.server_errors for m in picked)
        return {
            "minutes": minutes,
            "requests": requests,
            "per_minute": round(requests / minutes, 1),
            "server_errors": errors,
            "client_errors": sum(m.client_errors for m in picked),
            "error_rate": round(100 * errors / requests, 2) if requests else 0.0,
            "avg_ms": round(sum(m.total_ms for m in picked) / requests) if requests else None,
            "p95_ms": percentile(histogram, 0.95),
            "max_ms": round(max((m.max_ms for m in picked), default=0)) or None,
            "slow": sum(m.slow for m in picked),
            "busiest_minute": max((m.requests for m in picked), default=0),
        }

    def hourly(self, hours: int = 24, now: Optional[float] = None) -> List[Dict[str, Any]]:
        """Requests and server errors per hour, oldest first (for the chart)."""
        current_hour = int((now or time.time()) // 3600)
        buckets = {h: [0, 0] for h in range(current_hour - hours + 1, current_hour + 1)}
        for m in self.minutes:
            bucket = buckets.get(m.start // 60)
            if bucket is not None:
                bucket[0] += m.requests
                bucket[1] += m.server_errors
        return [
            {"hour": datetime.fromtimestamp(h * 3600, timezone.utc).isoformat(), "requests": r, "server_errors": e}
            for h, (r, e) in buckets.items()
        ]

    def cpu(self, minutes: int) -> Optional[Dict[str, float]]:
        """Share of the processor used and CPU time per request over about the last `minutes` minutes."""
        if len(self.cpu_samples) < 1:
            return None
        now = (time.time(), cpu_seconds())
        older = [s for s in self.cpu_samples if now[0] - s[0] <= minutes * 60 + 30]
        start = older[0] if older else self.cpu_samples[-1]
        elapsed = now[0] - start[0]
        if elapsed < 5:
            return None
        used = max(0.0, now[1] - start[1])
        requests = sum(m.requests for m in self.minutes if m.start * 60 >= start[0] - 60)
        return {
            "percent": round(100 * used / elapsed / cpu_limit(), 1),
            "per_request": used / requests if requests >= 50 else None,
            "requests": requests,
        }

    def sample_cpu(self) -> None:
        self.cpu_samples.append((time.time(), cpu_seconds()))


def percentile(histogram: List[int], share: float) -> Optional[int]:
    """Upper edge of the bucket holding the given share of the requests (an upper bound, in ms)."""
    total = sum(histogram)
    if not total:
        return None
    seen = 0
    for i, n in enumerate(histogram):
        seen += n
        if seen >= share * total:
            return LATENCY_EDGES[i] if i < len(LATENCY_EDGES) else LATENCY_EDGES[-1] * 2
    return None



# Render checks /database/health every 5 seconds and GitHub /health/full every 30 minutes: not visitors
NOT_COUNTED = ("/health", "/database/health", "/health/full")


class RequestMetricsMiddleware:
    """Pure ASGI middleware: times every HTTP request and counts its status (500 when it crashed)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") in NOT_COUNTED:
            return await self.app(scope, receive, send)
        started = time.perf_counter()
        status = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        metrics.active += 1
        metrics.peak_active = max(metrics.peak_active, metrics.active)
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            metrics.active -= 1
            # The route template (/api/v1/projects/{id}), never the real address: no ids, no tokens
            route = getattr(scope.get("route"), "path", None) or "(adresse inconnue)"
            metrics.record(scope.get("method", "GET"), route, status["code"], (time.perf_counter() - started) * 1000)


# ---------------------------------------------------------------------------
# Server resources (Linux containers such as Render; "not available" elsewhere)
# ---------------------------------------------------------------------------


def _read(path: str) -> Optional[str]:
    try:
        with open(path, encoding="ascii") as f:
            return f.read().strip()
    except (OSError, ValueError):
        return None


def cpu_seconds() -> float:
    t = os.times()
    return t.user + t.system


def cpu_limit() -> float:
    """Processors the plan gives (SERVER_CPU_LIMIT, else the container limit, else the machine)."""
    if settings.server_cpu_limit > 0:
        return settings.server_cpu_limit
    raw = _read("/sys/fs/cgroup/cpu.max")  # "50000 100000" = half a processor
    if raw and not raw.startswith("max"):
        quota, period = raw.split()[:2]
        return round(int(quota) / int(period), 2)
    quota, period = _read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"), _read("/sys/fs/cgroup/cpu/cpu.cfs_period_us")
    if quota and period and int(quota) > 0:
        return round(int(quota) / int(period), 2)
    return float(os.cpu_count() or 1)


def memory() -> Dict[str, Optional[float]]:
    """Memory used by the server process and the plan's limit, in MB."""
    used = None
    status = _read("/proc/self/status")
    if status:
        for line in status.splitlines():
            if line.startswith("VmRSS:"):
                used = int(line.split()[1]) / 1024
    limit = settings.server_memory_mb or None
    if not limit:
        for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
            raw = _read(path)
            if raw and raw.isdigit() and int(raw) < 1 << 50:  # "max" or a huge number = no limit
                limit = int(raw) / 1024 / 1024
                break
    return {
        "used_mb": round(used) if used is not None else None,
        "limit_mb": round(limit) if limit else None,
        "percent": round(100 * used / limit, 1) if used is not None and limit else None,
    }


metrics = Metrics()


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------


def fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


async def record_incident(
    kind: str,
    severity: str,
    title: str,
    detail: Optional[str] = None,
    path: Optional[str] = None,
    key: Optional[str] = None,
    email: bool = True,
) -> Optional[int]:
    """Open the incident, or add one occurrence to the same one still open. Never raises."""
    if not db_manager.async_session_maker:
        return None
    mark = fingerprint(key or f"{kind}:{title}")
    now = utcnow()
    try:
        async with db_manager.async_session_maker() as db:
            row = (
                await db.execute(
                    select(SystemIncident)
                    .where(SystemIncident.fingerprint == mark, SystemIncident.resolved_at.is_(None))
                    .order_by(SystemIncident.id.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if row:
                row.count += 1
                row.last_seen = now
                if detail:
                    row.detail = detail[:DETAIL_MAX]
            else:
                row = SystemIncident(
                    fingerprint=mark, kind=kind, severity=severity, title=title[:200],
                    detail=detail[:DETAIL_MAX] if detail else None, path=path[:200] if path else None,
                    count=1, first_seen=now, last_seen=now,
                )
                db.add(row)
            await db.commit()

            due = row.emailed_at is None or now - row.emailed_at >= REMIND_AFTER
            if email and severity in ("critical", "warning") and due:
                sent = await alerts.alert_admins(db, f"incident-{mark[:16]}", _subject(row), _email_body(row))
                if sent:
                    row.emailed_at = now
                    await db.commit()
            return row.id
    except Exception:
        logger.exception("Could not record the incident %s", title)
        return None


def _subject(row: SystemIncident) -> str:
    prefix = "Panne" if row.severity == "critical" else "Alerte"
    again = " (toujours en cours)" if row.emailed_at else ""
    return f"{prefix} : {row.title}{again}"


def _email_body(row: SystemIncident) -> str:
    detail = (row.detail or "").strip()
    if len(detail) > 1500:
        detail = detail[:1500] + "\n[…] (suite dans le tableau de bord)"
    return (
        f"{row.title}\n\n"
        f"Vu {row.count} fois, la première le {row.first_seen.astimezone(timezone.utc):%d/%m/%Y à %H:%M} (UTC).\n\n"
        + (f"Détail :\n{detail}\n\n" if detail else "")
        + f"Voir et marquer comme résolu : {settings.frontend_url.rstrip('/')}/admin → Santé du système."
    )


async def resolve_condition(key: str, note: str = "Rétabli automatiquement") -> int:
    """Close the open incident of a problem that has gone away (database back, memory freed...)."""
    if not db_manager.async_session_maker:
        return 0
    try:
        async with db_manager.async_session_maker() as db:
            result = await db.execute(
                update(SystemIncident)
                .where(SystemIncident.fingerprint == fingerprint(key), SystemIncident.resolved_at.is_(None))
                .values(resolved_at=utcnow(), resolution_note=note)
            )
            await db.commit()
            return result.rowcount or 0
    except Exception:
        logger.exception("Could not close the incident %s", key)
        return 0


async def condition(active: bool, key: str, severity: str, title: str, detail: Optional[str] = None, kind: str = "server") -> None:
    if active:
        await record_incident(kind, severity, title, detail, key=key)
    else:
        await resolve_condition(key)


async def report_crash(method: str, route: str, exc: BaseException) -> None:
    """An unexpected error ended a request: one incident per error type and address."""
    frames = traceback.format_exception(type(exc), exc, exc.__traceback__)
    detail = f"{type(exc).__name__}: {exc}\n\n" + "".join(frames)[-3000:]
    await record_incident(
        "error", "critical", f"Erreur {type(exc).__name__} sur {method} {route}", detail,
        path=f"{method} {route}", key=f"error:{type(exc).__name__}:{method}:{route}",
    )


# Browser errors: anyone can report them, so they are rate-limited and never emailed
_client_reports: Dict[str, Deque[float]] = {}
CLIENT_PER_IP_PER_HOUR = 20
CLIENT_TOTAL_PER_HOUR = 300
CLIENT_NOISE = ("ResizeObserver loop", "Script error.", "chrome-extension://", "moz-extension://", "safari-extension://")


def client_report_allowed(ip: str, now: Optional[float] = None) -> bool:
    now = now or time.time()
    for bucket_key, limit in ((ip or "?", CLIENT_PER_IP_PER_HOUR), ("*", CLIENT_TOTAL_PER_HOUR)):
        bucket = _client_reports.setdefault(bucket_key, deque())
        while bucket and now - bucket[0] > 3600:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
    for bucket_key in (ip or "?", "*"):
        _client_reports[bucket_key].append(now)
    if len(_client_reports) > 5000:  # forget old visitors
        for k in [k for k, v in _client_reports.items() if k != "*" and not v]:
            _client_reports.pop(k, None)
    return True


def is_noise(message: str, stack: str) -> bool:
    """Errors of browser extensions and harmless browser warnings."""
    return any(noise in message or noise in stack for noise in CLIENT_NOISE)


async def report_client_error(message: str, stack: str, page: str, user_agent: str) -> Optional[int]:
    if is_noise(message, stack):
        return None
    page = page.split("?")[0].split("#")[0][:200]  # never the query string (reset tokens, emails)
    first_line = next((line.strip() for line in stack.splitlines()[1:] if line.strip()), "")
    detail = f"Page : {page}\nNavigateur : {user_agent[:200]}\n\n{message}\n\n{stack}"
    return await record_incident(
        "client", "warning", f"Erreur dans le navigateur : {message[:150]}", detail,
        path=page, key=f"client:{message[:200]}:{first_line[:200]}", email=False,
    )


# ---------------------------------------------------------------------------
# Watchdog
# ---------------------------------------------------------------------------


@dataclass
class WatchState:
    db_down_since: Optional[datetime] = None
    last_cleanup: Optional[datetime] = None
    emails_seen: int = 0


watch = WatchState()


async def database_reading() -> Dict[str, Any]:
    """Answer time of the database and its size and connections."""
    if not db_manager.async_session_maker:
        return {"ok": False, "latency_ms": None}
    started = time.perf_counter()
    try:
        async with db_manager.async_session_maker() as db:
            await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=5)
            latency = round((time.perf_counter() - started) * 1000)
            reading: Dict[str, Any] = {"ok": True, "latency_ms": latency}
            try:
                row = (
                    await db.execute(
                        text(
                            "SELECT pg_database_size(current_database()) AS size, "
                            "(SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS used, "
                            "current_setting('max_connections')::int AS max"
                        )
                    )
                ).one()
                reading.update(size_mb=round(row.size / 1024 / 1024, 1), connections=row.used, max_connections=row.max)
            except Exception:  # not PostgreSQL (quick local SQLite tests)
                pass
            return reading
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "error": f"{type(exc).__name__}: {exc}"[:300]}


async def drain_email_failures() -> None:
    new = [f for f in list(mail.recent_failures) if f[0] > watch.emails_seen]
    if new:
        watch.emails_seen = new[-1][0]
    for _, when, context, error in new:
        await record_incident(
            "email", "warning", "Un email n'a pas pu partir",
            f"{when:%d/%m/%Y %H:%M} UTC — {context}\n{error}\n\n"
            "Vérifiez SMTP_USERNAME / SMTP_PASSWORD dans Render (mot de passe d'application Gmail) "
            "et la limite d'envoi de Gmail (quelques centaines par jour).",
            key="email:failure", email=False,  # the alert itself would go by email
        )


async def _instances(now: datetime, clean: Optional[bool] = None) -> None:
    """Heartbeat of this server; a server that stopped beating without a clean stop crashed."""
    async with db_manager.async_session_maker() as db:
        row = (await db.execute(select(SiteSetting).where(SiteSetting.key == STATE_KEY).with_for_update())).scalar_one_or_none()
        state = dict(row.value or {}) if row and isinstance(row.value, dict) else {}
        crashed = []
        silence = timedelta(seconds=max(3 * settings.monitor_every_seconds, 180))
        for instance, info in list(state.items()):
            if instance == INSTANCE_ID:
                continue
            beat = datetime.fromisoformat(info.get("heartbeat")) if info.get("heartbeat") else now
            if info.get("clean") or now - beat > timedelta(days=7):
                state.pop(instance)
            elif now - beat > silence:
                crashed.append(info)
                state.pop(instance)
        mine = state.get(INSTANCE_ID, {"started_at": now.isoformat(), "version": version()})
        mine["heartbeat"] = now.isoformat()
        mine["clean"] = bool(clean)
        state[INSTANCE_ID] = mine
        if row:
            row.value = state
        else:
            db.add(SiteSetting(key=STATE_KEY, value=state))
        await db.commit()
    for info in crashed:
        await record_incident(
            "restart", "warning", "Le serveur s'est arrêté brusquement",
            f"Démarré le {info.get('started_at', '?')[:16].replace('T', ' ')} (UTC), dernier signe de vie le "
            f"{info.get('heartbeat', '?')[:16].replace('T', ' ')} (UTC). Render l'a relancé tout seul.\n\n"
            "Cause probable : mémoire pleine (gros export, pic de visiteurs) ou plantage. Ouvrez Render → senjapo-api → "
            "Logs autour de cette heure ; si cela se répète, passez à l'offre supérieure (plus de mémoire).",
            key="restart:crash",
        )


async def check_once() -> None:
    """One round of the watchdog."""
    now = utcnow()
    metrics.sample_cpu()
    await drain_email_failures()

    db = await database_reading()
    if not db["ok"]:
        # Nothing can be written while the database is away: the incident is recorded on its return.
        # Meanwhile /health/full answers 503 and the GitHub watch (every 30 min) emails you.
        watch.db_down_since = watch.db_down_since or now
        logger.error("Database not answering: %s", db.get("error"))
        return
    if watch.db_down_since:
        minutes = max(1, round((now - watch.db_down_since).total_seconds() / 60))
        await record_incident(
            "database", "critical", "La base de données n'a pas répondu",
            f"Du {watch.db_down_since:%d/%m/%Y %H:%M} au {now:%H:%M} UTC (environ {minutes} min). Pendant ce temps, le site "
            "ne pouvait ni afficher les campagnes ni enregistrer de dons.\n\nVérifiez Render → senjapo-db (état, espace "
            "disque, maintenance).",
            key="database:outage",
        )
        watch.db_down_since = None
    await condition(
        db["latency_ms"] > 1000, "database:slow", "warning", "La base de données répond lentement",
        f"{db['latency_ms']} ms pour une requête simple (normalement moins de 50 ms).", kind="database",
    )

    mem = memory()
    if mem["percent"] is not None:
        if mem["percent"] >= 85:
            await condition(True, "memory:high", "warning", "Mémoire du serveur presque pleine",
                            f"{mem['used_mb']} Mo utilisés sur {mem['limit_mb']} Mo ({mem['percent']} %). Au-delà de 100 %, "
                            "Render arrête et relance le serveur.", kind="memory")
        elif mem["percent"] < 75:
            await resolve_condition("memory:high")

    cpu = metrics.cpu(5)
    if cpu:
        if cpu["percent"] >= 85:
            await condition(True, "cpu:high", "warning", "Serveur surchargé",
                            f"Processeur utilisé à {cpu['percent']} % ces 5 dernières minutes : le site ralentit.", kind="cpu")
        elif cpu["percent"] < 60:
            await resolve_condition("cpu:high")

    recent, quiet = metrics.window(5), metrics.window(15)
    if recent["server_errors"] >= 5:
        await condition(True, "errors:spike", "critical", "Nombreuses erreurs du serveur",
                        f"{recent['server_errors']} erreurs sur {recent['requests']} requêtes ces 5 dernières minutes. "
                        "Le détail de chaque erreur est dans la liste des incidents.", kind="error")
    elif quiet["server_errors"] == 0:
        await resolve_condition("errors:spike")

    if quiet["requests"] >= 30 and (quiet["p95_ms"] or 0) > 3000:
        await condition(True, "slow:site", "warning", "Le site répond lentement",
                        f"95 % des requêtes répondent en moins de {quiet['p95_ms'] / 1000:g} s ces 15 dernières minutes "
                        "(normalement moins de 0,5 s).", kind="slow")
    elif (quiet["p95_ms"] or 0) <= 1000:
        await resolve_condition("slow:site")

    await _check_backup(now)
    await _instances(now)

    if not watch.last_cleanup or now - watch.last_cleanup > timedelta(days=1):
        watch.last_cleanup = now
        async with db_manager.async_session_maker() as session:
            await session.execute(delete(SystemIncident).where(SystemIncident.resolved_at < now - KEEP_RESOLVED))
            await session.commit()


async def last_backup() -> Optional[datetime]:
    from services.backup import LAST_SENT_KEY

    async with db_manager.async_session_maker() as db:
        row = await db.get(SiteSetting, LAST_SENT_KEY)
    try:
        return datetime.fromisoformat(row.value) if row and row.value else None
    except (TypeError, ValueError):
        return None


async def _check_backup(now: datetime) -> None:
    days = settings.backup_email_days
    if days <= 0 or not mail.email_enabled():
        return
    last = await last_backup()
    late = (last is None and now - metrics.started_at > timedelta(days=1)) or (
        last is not None and now - last > timedelta(days=days + 2)
    )
    await condition(
        late, "backup:late", "warning", "Sauvegarde automatique en retard",
        f"Dernière sauvegarde envoyée le {last:%d/%m/%Y}." if last else "Aucune sauvegarde envoyée depuis la mise en route.",
        kind="backup",
    )


async def on_startup() -> None:
    if settings.monitor_every_seconds <= 0 or not db_manager.async_session_maker:
        return
    try:
        await _instances(utcnow())
    except Exception:
        logger.exception("Could not record the server start")


async def on_shutdown() -> None:
    """A clean stop (deploy, restart from Render) is not a crash."""
    if settings.monitor_every_seconds <= 0 or not db_manager.async_session_maker:
        return
    try:
        await _instances(utcnow(), clean=True)
    except Exception:
        logger.exception("Could not record the server stop")


async def watch_loop() -> None:
    interval = settings.monitor_every_seconds
    if interval <= 0:
        return
    while True:
        await asyncio.sleep(interval)
        try:
            await check_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Watchdog round failed")


def version() -> str:
    commit = os.environ.get("RENDER_GIT_COMMIT", "")
    return commit[:7] if commit else "local"


# ---------------------------------------------------------------------------
# Capacity: how many people the current server can take
# ---------------------------------------------------------------------------


def capacity() -> Dict[str, Any]:
    cores = cpu_limit()
    hour = metrics.cpu(60)
    measured = hour["per_request"] if hour else None
    per_request = measured or DEFAULT_CPU_PER_REQUEST
    max_rps = cores * USABLE_CPU_SHARE / per_request
    now_rps = metrics.window(5)["requests"] / 300
    day = metrics.window(24 * 60)
    peak_rps = day["busiest_minute"] / 60
    return {
        "cpu_limit": cores,
        "cpu_per_request_ms": round(per_request * 1000, 1),
        "measured": measured is not None,
        "max_requests_per_second": round(max_rps, 1),
        "visitors_at_once": int(round(max_rps * SECONDS_BETWEEN_VISITOR_CALLS) // 10 * 10),
        "donations_per_minute": int(round(max_rps * 60 / REQUESTS_PER_DONATION)),
        "current_requests_per_second": round(now_rps, 2),
        "load_percent": round(100 * now_rps / max_rps, 1) if max_rps else None,
        "peak_requests_per_second_24h": round(peak_rps, 2),
        "peak_load_percent_24h": round(100 * peak_rps / max_rps, 1) if max_rps else None,
        "db_pool": 30,  # 10 kept open + 20 extra (core/database.py)
        "assumptions": {
            "seconds_between_visitor_calls": SECONDS_BETWEEN_VISITOR_CALLS,
            "requests_per_donation": REQUESTS_PER_DONATION,
            "usable_cpu_share": USABLE_CPU_SHARE,
        },
    }
