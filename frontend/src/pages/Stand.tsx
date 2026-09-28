import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, ChevronRight, Expand, FileSearch, HandHeart, Megaphone, Users } from "lucide-react";
import Logo from "@/components/Logo";
import { api, Project } from "@/api";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import { useVisitSource } from "@/hooks/use-visit-source";
import { BRAND_DESCRIPTOR, BRAND_NAME, CARRIER_NAME, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";

/*
 * Stand screen for fairs and events (/stand?source=foire-thies): a full-screen presentation that
 * loops on a TV or a tablet. The QR code, always visible, opens the site on the visitor's phone;
 * its ?source tells the team which event the requests came from.
 */

const SLIDE_SECONDS = 12;

interface Slide {
  id: string;
  content: React.ReactNode;
}

export default function StandPage() {
  const source = useVisitSource() ?? "stand";
  const { stats } = usePublicStats();
  const [projects, setProjects] = useState<Project[]>([]);
  const [index, setIndex] = useState(0);

  const siteUrl = `${window.location.origin}/?source=${encodeURIComponent(source)}`;

  useEffect(() => {
    document.title = `${BRAND_NAME} · Stand`;
    api
      .getProjects()
      .then((res) => {
        const open = res.items.filter((p) => !p.status || p.status === "active");
        const featured = open.filter((p) => p.is_featured);
        setProjects((featured.length ? featured : open).slice(0, 3));
      })
      .catch(() => setProjects([]));
  }, []);

  // Keep the screen on while the presentation runs (supported browsers only)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [
      {
        id: "intro",
        content: (
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-lg font-medium">
              <HandHeart className="h-5 w-5 text-highlight" aria-hidden="true" />
              {BRAND_NAME} · {BRAND_DESCRIPTOR}
            </p>
            <h1 className="mb-8 text-5xl font-bold leading-tight tracking-tight xl:text-7xl">
              Une plateforme, plusieurs causes, <span className="text-emerald-300">une solidarité nationale</span>
            </h1>
            <p className="max-w-3xl text-2xl leading-relaxed text-white/80 xl:text-3xl">
              Une initiative du {CARRIER_NAME} ({CARRIER_SHORT}), en partenariat avec {PARTNER_NAME}.
            </p>
          </div>
        ),
      },
      {
        id: "sectors",
        content: (
          <div>
            <h2 className="mb-10 text-4xl font-bold xl:text-5xl">Les causes que nous soutenons</h2>
            <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
              {CATEGORIES.map((c) => (
                <div key={c.value} className="flex items-center gap-4 rounded-2xl bg-white/10 p-5">
                  <c.icon className="h-9 w-9 shrink-0 text-emerald-300" aria-hidden="true" />
                  <span className="text-xl font-semibold xl:text-2xl">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ];

    if (projects.length) {
      list.push({
        id: "projects",
        content: (
          <div>
            <h2 className="mb-10 text-4xl font-bold xl:text-5xl">Campagnes en cours</h2>
            <div className="space-y-5">
              {projects.map((p) => {
                const pct = p.goal > 0 ? Math.min(100, Math.round((p.raised / p.goal) * 100)) : 0;
                return (
                  <div key={p.id} className="rounded-2xl bg-white/10 p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-2xl font-bold xl:text-3xl">{p.title}</h3>
                      <span className="text-lg text-white/70">
                        {[categoryLabel(p.category), p.location].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-emerald-300" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-lg tabular-nums text-white/80">
                      {formatNumber(p.raised)} FCFA collectés sur {formatNumber(p.goal)} FCFA · {pct} %
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      });
    }

    list.push({
      id: "how",
      content: (
        <div>
          <h2 className="mb-10 text-4xl font-bold xl:text-5xl">Comment ça marche</h2>
          <ol className="grid gap-6 xl:grid-cols-3">
            {[
              ["01", "Vous choisissez", "Une campagne vérifiée et validée, ou un don général."],
              ["02", "Vous contribuez", "Par Wave, Orange Money ou carte bancaire, en toute sécurité."],
              ["03", "Vous suivez", "L'utilisation des fonds et les réalisations, en toute transparence."],
            ].map(([n, title, text]) => (
              <li key={n} className="rounded-2xl bg-white/10 p-7">
                <span className="text-5xl font-bold text-emerald-300">{n}</span>
                <h3 className="mt-3 text-2xl font-bold xl:text-3xl">{title}</h3>
                <p className="mt-2 text-xl leading-relaxed text-white/75">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      ),
    });

    list.push({
      id: "join",
      content: (
        <div>
          <h2 className="mb-6 text-5xl font-bold leading-tight xl:text-6xl">Vous portez un projet à impact ?</h2>
          <p className="mb-10 max-w-3xl text-2xl leading-relaxed text-white/80 xl:text-3xl">
            Associations, groupements, organisations, créateurs et entrepreneurs : proposez votre campagne.
          </p>
          <div className="grid gap-5 xl:grid-cols-3">
            {[
              [FileSearch, "Vérification et validation"],
              [Megaphone, "Une visibilité nationale"],
              [Users, "Le réseau du CCES"],
            ].map(([Icon, label]) => {
              const I = Icon as React.ElementType;
              return (
                <div key={label as string} className="flex items-center gap-4 rounded-2xl bg-white/10 p-5">
                  <I className="h-8 w-8 shrink-0 text-emerald-300" aria-hidden="true" />
                  <span className="text-xl font-semibold xl:text-2xl">{label as string}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-3xl font-bold text-highlight">Scannez le QR code pour découvrir la plateforme →</p>
        </div>
      ),
    });

    // Real figures only once there is something to show
    if (stats && (stats.total_raised > 0 || stats.donors > 0)) {
      list.push({
        id: "figures",
        content: (
          <div>
            <h2 className="mb-10 text-4xl font-bold xl:text-5xl">Ensemble, nous avons déjà</h2>
            <div className="grid grid-cols-2 gap-6">
              {[
                [`${formatAmount(stats.total_raised)} FCFA`, "collectés"],
                [formatNumber(stats.donors), plural(stats.donors, "contributeur", "contributeurs")],
                [formatNumber(stats.active_projects), plural(stats.active_projects, "campagne en cours", "campagnes en cours")],
                [formatNumber(stats.funded_projects), plural(stats.funded_projects, "campagne financée", "campagnes financées")],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-7">
                  <p className="text-5xl font-bold tabular-nums text-emerald-300 xl:text-6xl">{value}</p>
                  <p className="mt-2 text-2xl text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      });
    }
    return list;
  }, [projects, stats]);

  const count = slides.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  // Auto-advance; restarts after a manual change
  useEffect(() => {
    const timer = window.setTimeout(() => go(1), SLIDE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [index, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const current = slides[index % count];

  return (
    <div className="surface-hero relative flex min-h-screen flex-col overflow-hidden text-white">
      <header className="flex items-center justify-between px-8 py-6 xl:px-12">
        <Logo variant="onDark" />
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Expand className="h-4 w-4" aria-hidden="true" />
          Plein écran
        </button>
      </header>

      <main className="flex flex-1 items-center gap-10 px-8 pb-10 xl:px-12">
        <section key={current.id} className="min-w-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700" aria-live="polite">
          {current.content}
        </section>

        {/* Always visible: the visitor can scan at any moment */}
        <aside className="hidden w-72 shrink-0 flex-col items-center rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl lg:flex xl:w-80">
          <QRCodeSVG value={siteUrl} size={232} level="M" marginSize={1} className="h-auto w-full" title={`QR code : site ${BRAND_NAME}`} />
          <p className="mt-4 text-xl font-bold">Scannez-moi</p>
          <p className="text-sm text-slate-600">pour découvrir les campagnes et contribuer</p>
        </aside>
      </main>

      {/* Phones / tablets in portrait: the QR code goes under the slide */}
      <div className="mx-auto mb-8 flex items-center gap-4 rounded-2xl bg-white p-4 text-slate-900 lg:hidden">
        <QRCodeSVG value={siteUrl} size={112} level="M" marginSize={1} title={`QR code : site ${BRAND_NAME}`} />
        <p className="text-lg font-bold">Scannez pour<br />découvrir {BRAND_NAME}</p>
      </div>

      <footer className="flex items-center justify-between gap-4 px-8 pb-6 xl:px-12">
        <button type="button" onClick={() => go(-1)} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Diapositive précédente">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex flex-1 justify-center gap-2" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.id} className={cn("h-1.5 rounded-full transition-all", i === index % count ? "w-10 bg-emerald-300" : "w-4 bg-white/25")} />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Diapositive suivante">
          <ChevronRight className="h-6 w-6" />
        </button>
      </footer>
    </div>
  );
}
