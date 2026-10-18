import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  Gauge,
  Info,
  Loader2,
  MemoryStick,
  RefreshCw,
  Timer,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { HealthStatus, systemApi, SystemIncident, SystemStatus } from "@/api";
import { formatDate } from "./format";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;
const nf = new Intl.NumberFormat("fr-FR");

const STATUS: Record<HealthStatus, { icon: React.ElementType; label: string; text: string; bar: string }> = {
  ok: { icon: CheckCircle2, label: "OK", text: "text-success", bar: "bg-success" },
  info: { icon: Info, label: "Info", text: "text-info", bar: "bg-info" },
  warning: { icon: AlertTriangle, label: "Attention", text: "text-warning", bar: "bg-warning" },
  critical: { icon: XCircle, label: "Panne", text: "text-destructive", bar: "bg-destructive" },
};

function StatusMark({ status, className }: { status: HealthStatus; className?: string }) {
  const s = STATUS[status];
  return <s.icon className={cn("h-4 w-4 shrink-0", s.text, className)} aria-label={s.label} />;
}

const levelOf = (percent: number | null, warn = 70, critical = 90): HealthStatus =>
  percent === null ? "info" : percent >= critical ? "critical" : percent >= warn ? "warning" : "ok";

function duration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

const ms = (value: number | null) => (value === null ? "—" : value >= 1000 ? `${(value / 1000).toLocaleString("fr-FR")} s` : `${value} ms`);

/** A labelled bar: share of a limit (processor, memory, capacity) */
function Meter({ label, percent, detail }: { label: string; percent: number | null; detail: string }) {
  const level = levelOf(percent);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="flex items-center gap-1 tabular-nums text-foreground">
          {percent !== null && level !== "ok" && <StatusMark status={level} className="h-3.5 w-3.5" />}
          {percent === null ? "non mesuré" : `${percent.toLocaleString("fr-FR")} %`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={cn("h-full rounded-full transition-all", STATUS[level].bar)} style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Tile({ icon: Icon, label, value, detail, status }: { icon: React.ElementType; label: string; value: string; detail: string; status: HealthStatus }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          <StatusMark status={status} />
        </div>
        <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

/** Requests per hour over 24 hours, server errors stacked on top */
function TrafficChart({ hours }: { hours: SystemStatus["hourly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, ...hours.map((h) => h.requests));
  const shown = hover !== null ? hours[hover] : null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Requêtes</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" />Erreurs du serveur</span>
        </div>
        <span className="tabular-nums text-foreground" aria-live="polite">
          {shown
            ? `${new Date(shown.hour).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} : ${nf.format(shown.requests)} requêtes, ${shown.server_errors} erreur(s)`
            : `max. ${nf.format(top)} requêtes / heure`}
        </span>
      </div>
      <div className="flex h-32 items-end gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)}>
        {hours.map((h, i) => {
          const ok = h.requests - h.server_errors;
          return (
            <div
              key={h.hour}
              className="flex h-full flex-1 cursor-default flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${new Date(h.hour).getHours()} h : ${h.requests} requêtes, ${h.server_errors} erreurs`}
            >
              {h.server_errors > 0 && (
                <div className="mb-[2px] rounded-t-[3px] bg-destructive" style={{ height: `${Math.max(3, (100 * h.server_errors) / top)}%` }} />
              )}
              <div
                className={cn("rounded-t-[3px] bg-primary transition-opacity", h.server_errors > 0 && "rounded-t-none", hover !== null && hover !== i && "opacity-50")}
                style={{ height: ok > 0 ? `${Math.max(2, (100 * ok) / top)}%` : "0" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>il y a 24 h</span>
        <span>maintenant</span>
      </div>
    </div>
  );
}

function IncidentItem({ incident, canResolve, onResolve }: { incident: SystemIncident; canResolve: boolean; onResolve: (i: SystemIncident) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-3">
        <StatusMark status={incident.resolved_at ? "ok" : incident.severity} className="mt-0.5" />
        <div className="min-w-0 flex-1 basis-56">
          <p className="break-words font-medium text-foreground">{incident.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-2 px-1.5 py-0 text-[11px]">{incident.kind_label}</Badge>
            {incident.count > 1 ? `${nf.format(incident.count)} fois · ` : ""}
            {incident.count > 1 ? `du ${formatDate(incident.first_seen)} au ${formatDate(incident.last_seen)}` : formatDate(incident.first_seen)}
            {incident.emailed_at ? " · alerte envoyée par email" : ""}
          </p>
          {incident.resolved_at && (
            <p className="mt-1 text-xs text-success">
              Résolu le {formatDate(incident.resolved_at)}
              {incident.resolved_by_name ? ` par ${incident.resolved_by_name}` : ""}
              {incident.resolution_note ? ` : ${incident.resolution_note}` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {incident.detail && (
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(!open)} aria-expanded={open}>
              Détail
              <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", open && "rotate-180")} />
            </Button>
          )}
          {canResolve && !incident.resolved_at && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => onResolve(incident)}>
              Résolu
            </Button>
          )}
        </div>
      </div>
      {open && incident.detail && (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs text-foreground">{incident.detail}</pre>
      )}
    </li>
  );
}

/**
 * The admin's watch post: is the platform up, what broke (crashes, payment or email outages, overload,
 * unexpected restarts), what to check in the settings, and how many visitors the server can take.
 * President and admins read it; admins mark incidents resolved. Refreshed every 30 seconds.
 */
export default function SystemTab({ canResolve, onIncidents }: { canResolve: boolean; onIncidents?: (open: number, critical: number) => void }) {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [view, setView] = useState<"open" | "resolved">("open");
  const [incidents, setIncidents] = useState<SystemIncident[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<SystemIncident | "all" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [status, list] = await Promise.all([systemApi.status(), systemApi.incidents(view)]);
      setData(status);
      setIncidents(list.items);
      onIncidents?.(status.incidents.open, status.incidents.critical);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [view, onIncidents]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const resolve = async () => {
    if (!resolving) return;
    setBusy(true);
    try {
      if (resolving === "all") {
        const { resolved } = await systemApi.resolveAll(note.trim());
        toast.success(`${resolved} incident(s) marqué(s) comme résolu(s)`);
      } else {
        await systemApi.resolve(resolving.id, note.trim());
        toast.success("Incident marqué comme résolu (inscrit au Journal)");
      }
      setResolving(null);
      setNote("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const testAlert = async () => {
    setBusy(true);
    try {
      const { sent_to } = await systemApi.testAlert();
      toast.success(`Alerte de test envoyée à ${sent_to.join(", ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Chargement" /></div>;

  const { traffic, resources, capacity, database } = data;
  const hour = traffic.last_1h;
  const day = traffic.last_24h;
  const mem = resources.memory;
  const banner = {
    ok: { title: "Tout fonctionne", text: "Aucune panne en cours. Les vérifications automatiques tournent toutes les minutes." },
    warning: { title: "À surveiller", text: "Le site fonctionne, mais un point demande votre attention (voir ci-dessous)." },
    critical: { title: "Panne en cours", text: "Une partie du site ne fonctionne pas : regardez les incidents à traiter." },
  }[data.status];

  return (
    <div className="space-y-4">
      <Card className={cn("border-l-4 shadow-sm", data.status === "ok" ? "border-l-success" : data.status === "warning" ? "border-l-warning" : "border-l-destructive")}>
        <CardContent className="flex flex-wrap items-center gap-4 p-4 md:p-5">
          <StatusMark status={data.status} className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-foreground">{banner.title}</p>
            <p className="text-sm text-muted-foreground">{banner.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Serveur en marche depuis {duration(data.server.uptime_seconds)} · version {data.server.version} · vérifié à{" "}
              {new Date(data.checked_at).toLocaleTimeString("fr-FR")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canResolve && (
              <Button variant="outline" onClick={testAlert} disabled={busy}>
                <BellRing className="mr-2 h-4 w-4" />
                Envoyer une alerte test
              </Button>
            )}
            <Button variant="outline" onClick={load} disabled={loading} aria-label="Actualiser la santé du système">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          icon={Timer}
          label="Temps de réponse"
          value={ms(hour.p95_ms)}
          detail={hour.requests ? `95 % des requêtes, dernière heure (moyenne ${ms(hour.avg_ms)})` : "aucune requête cette heure"}
          status={hour.p95_ms === null ? "info" : hour.p95_ms > 2000 ? "critical" : hour.p95_ms > 1000 ? "warning" : "ok"}
        />
        <Tile
          icon={XCircle}
          label="Erreurs du serveur"
          value={nf.format(day.server_errors)}
          detail={`sur ${nf.format(day.requests)} requêtes en 24 h (${day.error_rate.toLocaleString("fr-FR")} %)`}
          status={day.error_rate >= 5 ? "critical" : day.server_errors > 0 ? "warning" : "ok"}
        />
        <Tile
          icon={Activity}
          label="Trafic"
          value={`${traffic.last_5m.per_minute.toLocaleString("fr-FR")} / min`}
          detail={`${resources.active_requests} en cours · pic : ${nf.format(day.busiest_minute)} en une minute`}
          status="ok"
        />
        <Tile
          icon={Database}
          label="Base de données"
          value={database.ok ? ms(database.latency_ms) : "injoignable"}
          detail={database.ok ? `${database.size_mb ?? "?"} Mo · ${database.connections ?? "?"} connexions / ${database.max_connections ?? "?"}` : database.error ?? ""}
          status={!database.ok ? "critical" : (database.latency_ms ?? 0) > 300 ? "warning" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="space-y-4 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              Capacité du serveur
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-2xl font-bold tabular-nums text-foreground">≈ {nf.format(capacity.visitors_at_once)}</p>
                <p className="text-xs text-muted-foreground">visiteurs en même temps</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-2xl font-bold tabular-nums text-foreground">≈ {nf.format(capacity.donations_per_minute)}</p>
                <p className="text-xs text-muted-foreground">dons par minute</p>
              </div>
            </div>
            <Meter
              label="Charge actuelle"
              percent={capacity.load_percent}
              detail={`${capacity.current_requests_per_second.toLocaleString("fr-FR")} requête(s)/s sur ${capacity.max_requests_per_second.toLocaleString("fr-FR")} possibles`}
            />
            <Meter
              label="Plus forte charge des 24 h"
              percent={capacity.peak_load_percent_24h}
              detail={`${capacity.peak_requests_per_second_24h.toLocaleString("fr-FR")} requête(s)/s pendant la minute la plus chargée`}
            />
            <p className="text-xs text-muted-foreground">
              Calcul : {capacity.cpu_limit.toLocaleString("fr-FR")} processeur, {capacity.cpu_per_request_ms.toLocaleString("fr-FR")} ms de
              calcul par requête ({capacity.measured ? "mesuré sur la dernière heure" : "estimation, mesurée dès 50 requêtes"}), 30 % gardés
              pour les pics, un visiteur sollicite le serveur environ toutes les {capacity.assumptions.seconds_between_visitor_calls} s. Les
              pages et images sont servies à part par Render et ne comptent pas.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-4 p-4 md:p-6">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
              Ressources
            </h3>
            <Meter
              label="Processeur (5 min)"
              percent={resources.cpu_percent_5m}
              detail={`Offre : ${resources.cpu_limit.toLocaleString("fr-FR")} processeur · moyenne sur 1 h : ${resources.cpu_percent_1h === null ? "—" : `${resources.cpu_percent_1h.toLocaleString("fr-FR")} %`}`}
            />
            <Meter
              label="Mémoire"
              percent={mem.percent}
              detail={mem.used_mb === null ? "Mesurée seulement sur le serveur en ligne (Linux)." : `${mem.used_mb} Mo utilisés sur ${mem.limit_mb ?? "?"} Mo. À 100 %, Render relance le serveur.`}
            />
            <TrafficChart hours={data.hourly} />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              <MemoryStick className="h-3.5 w-3.5" aria-hidden="true" />
              Chiffres de ce serveur depuis son dernier démarrage (remis à zéro à chaque mise à jour).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 md:p-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              Incidents
              {data.incidents.open > 0 && <Badge className="bg-highlight text-highlight-foreground">{data.incidents.open} à traiter</Badge>}
            </h3>
            <div className="flex gap-1">
              {(["open", "resolved"] as const).map((v) => (
                <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"} className="h-8" onClick={() => setView(v)} aria-pressed={view === v}>
                  {v === "open" ? "À traiter" : "Résolus"}
                </Button>
              ))}
              {canResolve && view === "open" && (incidents?.length ?? 0) > 1 && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => setResolving("all")}>Tout marquer résolu</Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Chaque panne est enregistrée ici. Les nouvelles pannes et alertes vous sont aussi envoyées par email (une fois, puis un rappel
            après 24 h si elles continuent). Les problèmes passagers (mémoire, lenteur, base de données) se ferment seuls quand ils
            disparaissent.
          </p>
          {incidents === null ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-primary" />
          ) : incidents.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              {view === "open" ? "Aucun incident à traiter." : "Aucun incident résolu pour l'instant."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {incidents.map((i) => (
                <IncidentItem key={i.id} incident={i} canResolve={canResolve} onResolve={setResolving} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="font-semibold text-foreground">Vérification des réglages</h3>
            <ul className="divide-y divide-border">
              {data.checks.map((c) => (
                <li key={c.id} className="flex gap-3 py-2.5">
                  <StatusMark status={c.status} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Ces réglages se changent dans Render → senjapo-api → Environment. En plus de cette page, GitHub vérifie le site toutes les
              30 minutes et vous prévient par email s'il ne répond plus (même quand ce serveur est arrêté).
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-3 p-4 md:p-6">
            <h3 className="font-semibold text-foreground">Adresses les plus lentes</h3>
            {data.slow_routes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore assez de requêtes.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adresse</TableHead>
                    <TableHead className="text-right">Appels</TableHead>
                    <TableHead className="text-right">Moyenne</TableHead>
                    <TableHead className="text-right">Erreurs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slow_routes.map((r) => (
                    <TableRow key={r.route}>
                      <TableCell className="max-w-[8rem] truncate font-mono text-xs sm:max-w-[14rem]" title={r.route}>{r.route}</TableCell>
                      <TableCell className="text-right tabular-nums">{nf.format(r.count)}</TableCell>
                      <TableCell className="text-right tabular-nums">{ms(r.avg_ms)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.server_errors > 0 && "font-semibold text-destructive")}>{r.server_errors}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {data.error_routes.length > 0 && (
              <p className="break-words text-xs text-muted-foreground">
                Erreurs par adresse : {data.error_routes.map((r) => `${r.route} (${r.server_errors})`).join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resolving === "all" ? "Marquer tous les incidents comme résolus ?" : "Marquer comme résolu ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {resolving === "all"
                ? "Par exemple après une mise à jour qui corrige le problème."
                : resolving && resolving !== "all" ? resolving.title : ""}{" "}
              Si le problème revient, un nouvel incident s'ouvrira. L'action est inscrite au Journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Ce qui a été fait (facultatif) : clés PayTech corrigées, nouvelle version…"
            aria-label="Note de résolution"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); resolve(); }} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Résolu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
