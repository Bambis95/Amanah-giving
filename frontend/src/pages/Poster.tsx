import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, CheckCircle, HandHeart, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitSource } from "@/hooks/use-visit-source";
import { BRAND_DESCRIPTOR, BRAND_NAME, BRAND_SLOGAN, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/contact";

/*
 * Printable A4 poster (/affiche?source=foire-thies) with a QR code to the home page.
 * Always light, whatever the site theme. The QR code uses the address the page is opened from:
 * print it from the final website, not from a temporary link.
 */

// Addresses that stop working (local computer, temporary tunnel): warn before printing
const isTemporaryHost = (host: string) =>
  /^(localhost|127\.|192\.168\.|10\.)/.test(host) || host.endsWith(".trycloudflare.com");

export default function PosterPage() {
  const source = useVisitSource() ?? "affiche";
  const siteUrl = `${window.location.origin}/?source=${encodeURIComponent(source)}`;
  const host = window.location.host;
  const temporary = isTemporaryHost(window.location.hostname);

  useEffect(() => {
    document.title = `${BRAND_NAME} · Affiche`;
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 0 } @media print { html, body { background: #fff } }"}</style>

      <div className="mx-auto mb-6 flex max-w-[210mm] flex-col gap-3 px-4 print:hidden">
        {temporary && (
          <p className="flex gap-2 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ce QR code pointe vers une adresse temporaire ({host}) qui ne fonctionnera plus après la démonstration.
            Pour l'impression définitive, ouvrez cette page depuis le site en ligne.
          </p>
        )}
        <Button onClick={() => window.print()} className="self-start rounded-lg">
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
          Imprimer / enregistrer en PDF
        </Button>
      </div>

      {/* A4 sheet */}
      <article className="mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white text-slate-900 shadow-xl print:shadow-none">
        <header className="bg-[#0D7C66] px-[14mm] pb-[12mm] pt-[14mm] text-white">
          <div className="mb-[8mm] flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <HandHeart className="h-8 w-8" aria-hidden="true" />
            </span>
            <span className="text-3xl font-bold tracking-wide">{BRAND_NAME}</span>
          </div>
          <p className="text-lg font-medium text-white/85">{BRAND_DESCRIPTOR}</p>
          <h1 className="mt-3 text-[40px] font-bold leading-tight">{BRAND_SLOGAN}</h1>
        </header>

        <section className="flex flex-1 flex-col px-[14mm] py-[9mm]">
          <p className="text-xl leading-relaxed text-slate-700">
            Contribuez à des projets à impact social, économique, éducatif et communautaire, vérifiés et suivis en toute
            transparence.
          </p>

          <ul className="mt-[7mm] space-y-3 text-lg">
            {[
              "Soutenez les jeunes, les Daaras, les artisans, les agriculteurs, les femmes et les plus vulnérables.",
              "Vous portez un projet ? Proposez votre campagne.",
              "Suivez l'utilisation des fonds et les réalisations.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-[#0D7C66]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-[8mm] flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span key={c.value} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700">
                {c.label}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-[10mm] rounded-3xl border-2 border-[#0D7C66] p-[8mm]">
            <QRCodeSVG value={siteUrl} size={200} level="M" marginSize={0} title={`QR code : site ${BRAND_NAME}`} />
            <div>
              <p className="text-3xl font-bold leading-tight text-[#0D7C66]">Scannez pour découvrir les campagnes</p>
              <p className="mt-3 text-lg text-slate-700">ou rendez-vous sur</p>
              <p className="break-all text-xl font-semibold">{host}</p>
            </div>
          </div>
        </section>

        <footer className="space-y-1 border-t border-slate-200 px-[14mm] py-[5mm] text-sm text-slate-600">
          <p className="flex flex-wrap justify-between gap-2 text-base">
            <span>{CONTACT_PHONES.join(" / ")}</span>
            <span>{CONTACT_EMAIL}</span>
          </p>
          <p>
            Une initiative du {CARRIER_NAME} ({CARRIER_SHORT}), récépissé {CARRIER_RECEIPT}, en partenariat avec{" "}
            {PARTNER_NAME}.
          </p>
        </footer>
      </article>
    </div>
  );
}
