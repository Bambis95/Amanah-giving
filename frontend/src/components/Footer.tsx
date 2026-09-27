import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import Logo from "@/components/Logo";
import { CONTACT_EMAIL } from "@/lib/contact";

const navigation = [
  { href: "/", label: "Accueil" },
  { href: "/projects", label: "Nos Projets" },
  { href: "/donate", label: "Faire un Don" },
  { href: "/about", label: "À Propos" },
  { href: "/contact", label: "Contact" },
];

const causes = ["Éducation", "Santé", "Eau Potable", "Alimentation", "Logement"];

const linkClass = "text-sm text-white/65 transition-colors hover:text-white";

// Dark in both themes (surface-footer): texts use white with opacity for contrast
export default function Footer() {
  return (
    <footer className="surface-footer">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Logo variant="onDark" />
            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              Amanah Giving est une plateforme de dons en ligne dédiée à connecter les donateurs du monde entier avec
              des causes qui changent des vies.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium">Stripe</span>
              <span className="rounded-md bg-[#FF6600]/20 px-3 py-1.5 text-xs font-medium text-[#FF8A3D]">Orange Money</span>
              <span className="rounded-md bg-[#1DC3E2]/20 px-3 py-1.5 text-xs font-medium text-[#5AD6EE]">Wave</span>
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
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <div>
                  <a href="tel:+221779394344" className="transition-colors hover:text-white">
                    +221 77 939 43 44
                  </a>
                  <p className="text-xs text-white/50">OM & Wave</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <a href={`mailto:${CONTACT_EMAIL}`} className="break-all transition-colors hover:text-white">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>
                  Dakar, Sacré Cœur 3<br />
                  Mermoz, Sénégal
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-white/50">© {new Date().getFullYear()} Amanah Giving. Tous droits réservés.</p>
          {/* Legal pages are not written yet: plain text rather than links that lead nowhere */}
          <div className="flex items-center gap-6 text-xs text-white/50">
            <span>Politique de Confidentialité</span>
            <span>Conditions d'Utilisation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
