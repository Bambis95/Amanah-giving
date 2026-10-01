import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, Project } from "@/api";
import { BRAND_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { causeLabel } from "@/lib/categories";
import ContactLine from "@/components/ContactLine";

/*
 * Printable A4 poster of one campaign (/affiche/campagne/ID), opened from the dashboard.
 * The QR code leads straight to the donation form with this campaign selected.
 * Always French and light: it is printed for events in Senegal.
 */

const isTemporaryHost = (host: string) =>
  /^(localhost|127\.|192\.168\.|10\.)/.test(host) || host.endsWith(".trycloudflare.com");

const formatCFA = (amount: number) => new Intl.NumberFormat("fr-FR").format(amount);

// The first paragraph, cut at a sentence when it is too long for the sheet
function summary(text: string, max = 420) {
  const first = text.split(/\n\s*\n/)[0].trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return (end > 150 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
}

export default function CampaignPosterPage() {
  const id = Number(useParams().id);
  const [project, setProject] = useState<Project | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .getProject(id)
      .then((p) => {
        if (p.status === "paused") throw new Error("paused");
        setProject(p);
        document.title = `${BRAND_NAME} · Affiche · ${p.title}`;
      })
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) return <p className="p-8 text-center text-slate-700">Campagne introuvable ou masquée.</p>;
  if (!project) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#044990]" /></div>;

  const donateUrl = `${window.location.origin}/donate?project=${project.id}&source=${encodeURIComponent(`affiche-campagne-${project.id}`)}`;
  const temporary = isTemporaryHost(window.location.hostname);
  const progress = project.goal > 0 ? Math.min(100, Math.round((project.raised / project.goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 0 } @media print { html, body { background: #fff } }"}</style>

      <div className="mx-auto mb-6 flex max-w-[210mm] flex-col gap-3 px-4 print:hidden">
        {temporary && (
          <p className="flex gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ce QR code pointe vers une adresse temporaire ({window.location.host}). Pour l'impression définitive, ouvrez
            cette page depuis le site en ligne.
          </p>
        )}
        <p className="text-sm text-slate-700">
          Le montant collecté est celui d'aujourd'hui : réimprimez l'affiche pour le mettre à jour.
        </p>
        <Button onClick={() => window.print()} className="self-start rounded-lg">
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
          Imprimer / enregistrer en PDF
        </Button>
      </div>

      <article className="mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white text-slate-900 shadow-xl print:shadow-none">
        <header className="flex items-center justify-between border-b-[3mm] border-[#F57206] px-[12mm] py-[5mm]">
          <img src="/logo-senjapo.jpg" alt={BRAND_NAME} className="h-[24mm] w-auto" />
          <p className="text-right text-sm font-semibold uppercase tracking-wider text-[#044990]">Campagne de solidarité</p>
        </header>

        {project.image && (
          <div className="flex justify-center bg-slate-100"><img src={project.image} alt="" className="max-h-[95mm] w-auto max-w-full object-contain" /></div>
        )}

        <section className="flex flex-1 flex-col px-[12mm] py-[6mm]">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#F57206]">
            {[causeLabel(project.category), project.location].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-1 text-[26pt] font-bold leading-tight text-[#044990]">{project.title}</h1>
          <p className="mt-[4mm] text-[12pt] leading-relaxed text-slate-700">{summary(project.description)}</p>

          {project.goal > 0 && (
            <div className="mt-[5mm]">
              <div className="flex items-baseline justify-between text-[12pt]">
                <span className="font-bold">{formatCFA(project.raised)} FCFA collectés</span>
                <span className="text-slate-600">Objectif : {formatCFA(project.goal)} FCFA</span>
              </div>
              <div className="mt-2 h-[4mm] overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[#044990]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center gap-[8mm] rounded-3xl border-2 border-[#F57206] p-[6mm]">
            <QRCodeSVG value={donateUrl} size={200} level="M" marginSize={0} title={`QR code : faire un don à ${project.title}`} />
            <div>
              <p className="text-[22pt] font-bold leading-tight text-[#044990]">Scannez pour faire un don</p>
              <p className="mt-2 text-[12pt] text-slate-700">Wave, Orange Money ou carte bancaire : votre don va directement à cette campagne.</p>
              <p className="mt-2 break-all text-[12pt] font-semibold">{window.location.host}</p>
            </div>
          </div>
        </section>

        <footer className="flex items-center gap-[5mm] border-t border-slate-200 px-[12mm] py-[4mm] text-sm text-slate-600">
          <img src="/partners/cces.jpg" alt={CARRIER_SHORT} className="h-[14mm] w-auto" />
          <img src="/partners/diaayma-local.jpg" alt={PARTNER_NAME} className="h-[14mm] w-auto" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold text-slate-800">
              <ContactLine link={false} />
            </p>
            <p>
              Une initiative du {CARRIER_SHORT} (récépissé {CARRIER_RECEIPT}), en partenariat avec {PARTNER_NAME}.
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
