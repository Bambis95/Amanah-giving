import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_NAME, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import ContactLine from "@/components/ContactLine";
import { MEMBER_EXPECTATIONS, MEMBER_PROFILES } from "@/lib/membership";

/*
 * Printable A4 membership form (/adherer/imprimer), same questions as the online form, for the stand
 * and for people who prefer paper. Always light, whatever the site theme.
 */

function Line({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <span className="shrink-0 text-[12.5px] font-semibold text-slate-800">{label}</span>
      <span className="h-[7mm] flex-1 border-b border-dotted border-slate-500" />
    </div>
  );
}

function Boxes({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
      {items.map((item) => (
        <span key={item} className="flex items-center gap-2 text-[12px] text-slate-800">
          <span className="h-[3.6mm] w-[3.6mm] shrink-0 rounded-[1px] border border-slate-600" />
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="border-b-2 border-[#044990] pb-0.5 text-[13px] font-bold uppercase tracking-wide text-[#044990]">{title}</h2>
      {children}
    </section>
  );
}

export default function MembershipPrintPage() {
  const onlineUrl = `${window.location.origin}/adherer?source=formulaire-papier`;

  useEffect(() => {
    document.title = `Formulaire d'adhésion ${CARRIER_SHORT} · ${BRAND_NAME}`;
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 0 } @media print { html, body { background: #fff } }"}</style>

      <div className="mx-auto mb-6 max-w-[210mm] px-4 print:hidden">
        <Button onClick={() => window.print()} className="rounded-lg">
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
          Imprimer / enregistrer en PDF
        </Button>
      </div>

      <article className="mx-auto flex h-[297mm] w-[210mm] flex-col gap-[4mm] overflow-hidden bg-white px-[14mm] py-[10mm] text-slate-900 shadow-xl print:shadow-none">
        <header className="flex items-center gap-[5mm] border-b-[2.5mm] border-[#F57206] pb-[4mm]">
          <img src="/logo-senjapo.jpg" alt={BRAND_NAME} className="h-[28mm] w-auto" />
          <div className="flex-1">
            <h1 className="text-[22px] font-extrabold leading-tight text-[#044990]">Formulaire d'adhésion</h1>
            <p className="text-[13px] font-semibold text-slate-800">
              {CARRIER_NAME} ({CARRIER_SHORT})
            </p>
            <p className="text-[11px] text-slate-600">
              Récépissé {CARRIER_RECEIPT} · En partenariat avec {PARTNER_NAME}
            </p>
          </div>
          <img src="/partners/cces.jpg" alt={CARRIER_SHORT} className="h-[20mm] w-auto" />
        </header>

        <Section title="Vos coordonnées">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <Line label="Prénom :" />
            <Line label="Nom :" />
            <Line label="Téléphone / WhatsApp :" />
            <Line label="Email :" />
            <Line label="Région :" />
            <Line label="Commune / ville :" />
          </div>
        </Section>

        <Section title="Votre activité">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <Line label="Profession / activité :" />
            <Line label="Structure (si applicable) :" />
          </div>
          <p className="pt-1 text-[12px] font-semibold text-slate-800">Vous êtes :</p>
          <Boxes items={MEMBER_PROFILES} />
          <p className="pt-1 text-[12px] font-semibold text-slate-800">Secteur :</p>
          <Boxes items={[...CATEGORIES.map((c) => c.label), "Autre : ……………………"]} />
        </Section>

        <Section title="Vos attentes">
          <Boxes items={MEMBER_EXPECTATIONS} />
          <p className="pt-1 text-[12px] font-semibold text-slate-800">Pourquoi souhaitez-vous rejoindre le club ?</p>
          <div className="space-y-0">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-[7mm] border-b border-dotted border-slate-500" />
            ))}
          </div>
        </Section>

        <section className="space-y-2 rounded-lg bg-slate-100 p-[3mm] text-[11.5px] text-slate-800">
          <p className="flex items-start gap-2">
            <span className="mt-0.5 h-[3.6mm] w-[3.6mm] shrink-0 rounded-[1px] border border-slate-600" />
            J'accepte que le {CARRIER_SHORT} utilise ces informations pour étudier ma demande et me recontacter.
          </p>
          <div className="grid grid-cols-2 gap-x-6">
            <Line label="Fait à :" />
            <Line label="Le :" />
          </div>
          <Line label="Signature :" className="pt-1" />
        </section>

        <footer className="mt-auto flex items-center gap-[5mm] border-t border-slate-300 pt-[3mm]">
          <QRCodeSVG value={onlineUrl} size={78} level="M" marginSize={0} title="QR code : adhésion en ligne" />
          <div className="flex-1 text-[11px] text-slate-700">
            <p className="font-semibold text-slate-900">Vous préférez adhérer en ligne ? Scannez le QR code.</p>
            <p>
              Contacts : <ContactLine link={false} />
            </p>
          </div>
          <div className="w-[48mm] rounded border border-slate-400 p-[2mm] text-[10px] text-slate-600">
            <p className="font-semibold">Réservé au club</p>
            <p className="mt-1">N° de membre : ………………</p>
            <p className="mt-1">Reçu le : ……………………</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
