import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, CheckCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitSource } from "@/hooks/use-visit-source";
import { BRAND_DESCRIPTOR, BRAND_NAME, BRAND_SLOGAN, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import ContactLine from "@/components/ContactLine";

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
        {/* The official logo already carries the name, the descriptor and the slogan */}
        <header className="flex justify-center border-b-[3mm] border-[#F57206] px-[14mm] pb-[5mm] pt-[8mm]">
          <img src="/logo-senjapo.jpg" alt={`${BRAND_NAME} – ${BRAND_DESCRIPTOR} : ${BRAND_SLOGAN}`} className="h-[92mm] w-auto" />
        </header>

        <section className="flex flex-1 flex-col px-[14mm] py-[7mm]">
          <p className="text-xl leading-relaxed text-slate-700">
            Contribuez à des projets à impact social, économique, éducatif et communautaire, vérifiés et suivis en toute
            transparence.
          </p>

          <ul className="mt-[5mm] space-y-2 text-lg">
            {[
              "Soutenez les jeunes, les Daaras, les artisans, les agriculteurs, les femmes et les plus vulnérables.",
              "Vous portez un projet ? Proposez votre campagne.",
              "Suivez l'utilisation des fonds et les réalisations.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-[#044990]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-[5mm] flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <span key={c.value} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700">
                {c.label}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-[10mm] rounded-3xl border-2 border-[#F57206] p-[6mm]">
            <QRCodeSVG value={siteUrl} size={180} level="M" marginSize={0} title={`QR code : site ${BRAND_NAME}`} />
            <div>
              <p className="text-3xl font-bold leading-tight text-[#044990]">Scannez pour découvrir les campagnes</p>
              <p className="mt-3 text-lg text-slate-700">ou rendez-vous sur</p>
              <p className="break-all text-xl font-semibold">{host}</p>
            </div>
          </div>
        </section>

        <footer className="flex items-center gap-[5mm] border-t border-slate-200 px-[14mm] py-[4mm] text-sm text-slate-600">
          <img src="/partners/cces.jpg" alt={`${CARRIER_SHORT} – ${CARRIER_NAME}`} className="h-[16mm] w-auto" />
          <img src="/partners/diaayma-local.jpg" alt={PARTNER_NAME} className="h-[16mm] w-auto" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-semibold text-slate-800">
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
