import { Link } from "react-router-dom";
import { BadgeCheck, Phone, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import { CONTACT_EMAIL, CONTACT_PHONES, telHref } from "@/lib/contact";
import { BRAND_NAME, BRAND_SLOGAN, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";

const navigation = [
  { href: "/", label: "Accueil" },
  { href: "/projects", label: "Campagnes" },
  { href: "/donate", label: "Faire un Don" },
  { href: "/about", label: "À Propos" },
  { href: "/proposer", label: "Proposer une Campagne" },
  { href: "/partenaires", label: "Devenir Partenaire" },
  { href: "/transparence", label: "Transparence" },
  { href: "/contact", label: "Contact" },
];

const causes = CATEGORIES.map((c) => c.label);

const linkClass = "text-sm text-white/65 transition-colors hover:text-white";

// Dark in both themes (surface-footer): texts use white with opacity for contrast
export default function Footer() {
  return (
    <footer className="surface-footer">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Logo variant="onDark" />
            <p className="max-w-sm text-sm italic leading-relaxed text-white/80">« {BRAND_SLOGAN} »</p>
            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              {BRAND_NAME} est une initiative du {CARRIER_NAME} ({CARRIER_SHORT}), en partenariat avec {PARTNER_NAME}.
            </p>
            <div className="flex items-center gap-2">
              <img src="/partners/cces.jpg" alt={`Logo ${CARRIER_SHORT}`} className="h-12 w-auto rounded-lg bg-white p-1" loading="lazy" />
              <img src="/partners/diaayma-local.jpg" alt={`Logo ${PARTNER_NAME}`} className="h-12 w-auto rounded-lg bg-white p-1" loading="lazy" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-md bg-[#1DC3E2]/20 px-3 py-1.5 text-xs font-medium text-[#5AD6EE]">Wave</span>
              <span className="rounded-md bg-[#FF6600]/20 px-3 py-1.5 text-xs font-medium text-[#FF8A3D]">Orange Money</span>
              <span className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium">Carte bancaire</span>
            </div>
          </div>

          <nav aria-label="Liens du pied de page" className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">Navigation</h3>
            <ul className="space-y-3">
              {navigation.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">Nos Causes</h3>
            <ul className="space-y-3">
              {causes.map((cause) => (
                <li key={cause}>
                  <Link to="/projects" className={linkClass}>
                    {cause}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">Contact</h3>
            <ul className="space-y-3 text-sm text-white/65">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  {CONTACT_PHONES.map((phone) => (
                    <a key={phone} href={telHref(phone)} className="transition-colors hover:text-white">
                      {phone}
                    </a>
                  ))}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <a href={`mailto:${CONTACT_EMAIL}`} className="break-all transition-colors hover:text-white">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <span>
                  {CARRIER_SHORT} · Récépissé {CARRIER_RECEIPT}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} {BRAND_NAME} · {CARRIER_SHORT}. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-xs">
            <Link to="/confidentialite" className="text-white/50 transition-colors hover:text-white">
              Politique de Confidentialité
            </Link>
            <Link to="/conditions" className="text-white/50 transition-colors hover:text-white">
              Conditions d'Utilisation
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
