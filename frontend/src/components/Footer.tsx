import { Link } from "react-router-dom";
import { Heart, Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1A1A2E] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#0D7C66] rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-tight">Amanah</span>
                <span className="text-xs text-[#0D7C66] font-semibold -mt-1">GIVING</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Amanah Giving est une plateforme de dons en ligne dédiée à connecter les donateurs du monde entier avec des causes qui changent des vies.
            </p>
            <div className="flex gap-3 pt-2">
              <div className="px-3 py-1.5 bg-white/10 rounded-md text-xs font-medium">Stripe</div>
              <div className="px-3 py-1.5 bg-[#FF6600]/20 text-[#FF6600] rounded-md text-xs font-medium">Orange Money</div>
              <div className="px-3 py-1.5 bg-[#1DC3E2]/20 text-[#1DC3E2] rounded-md text-xs font-medium">Wave</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Navigation</h3>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Accueil" },
                { href: "/projects", label: "Nos Projets" },
                { href: "/donate", label: "Faire un Don" },
                { href: "/about", label: "À Propos" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-gray-400 hover:text-[#0D7C66] transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Causes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Nos Causes</h3>
            <ul className="space-y-3">
              {["Éducation", "Santé", "Eau Potable", "Alimentation", "Logement"].map((cause) => (
                <li key={cause}>
                  <Link
                    to="/projects"
                    className="text-gray-400 hover:text-[#0D7C66] transition-colors text-sm"
                  >
                    {cause}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#0D7C66] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-400">
                  <p>+221 77 939 43 44</p>
                  <p className="text-xs text-gray-500">OM & Wave</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#0D7C66] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-400">Khadimbaeft@gmail.com</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#0D7C66] mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-400">Dakar, Sacré Cœur 3<br />Mermoz, Sénégal</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Amanah Giving. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-gray-500 hover:text-gray-400 cursor-pointer transition-colors">
              Politique de Confidentialité
            </span>
            <span className="text-xs text-gray-500 hover:text-gray-400 cursor-pointer transition-colors">
              Conditions d'Utilisation
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}