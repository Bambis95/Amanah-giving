import { Link } from "react-router-dom";
import { BadgeCheck, Facebook, Instagram, Mail, MessageCircle, Music2, Phone, Youtube } from "lucide-react";
import Logo from "@/components/Logo";
import { telHref } from "@/lib/contact";
import { useSiteSettings, whatsappHref } from "@/hooks/use-site-settings";
import { BRAND_NAME, BRAND_SLOGAN, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_LEGAL, PARTNER_NAME } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { useI18n } from "@/i18n";

const linkClass = "text-sm text-white/65 transition-colors hover:text-white";

// Dark in both themes (surface-footer): texts use white with opacity for contrast
export default function Footer() {
  const site = useSiteSettings();
  const { t } = useI18n();
  const navigation = [
    { href: "/", label: t.nav.home },
    { href: "/projects", label: t.nav.campaigns },
    { href: "/donate", label: t.nav.donate },
    { href: "/about", label: t.nav.about },
    { href: "/adherer", label: t.nav.join },
    { href: "/proposer", label: t.nav.propose },
    { href: "/partenaires", label: t.nav.partners },
    { href: "/transparence", label: t.nav.transparency },
    { href: "/contact", label: t.nav.contact },
  ];
  const causes = CATEGORIES.map((c) => t.categories[c.value] ?? c.label);
  const socials = [
    { url: site.facebook_url, label: "Facebook", icon: Facebook },
    { url: site.instagram_url, label: "Instagram", icon: Instagram },
    { url: site.tiktok_url, label: "TikTok", icon: Music2 },
    { url: site.youtube_url, label: "YouTube", icon: Youtube },
  ].filter((s): s is typeof s & { url: string } => !!s.url);

  return (
    <footer className="surface-footer">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Logo variant="onDark" />
            <p className="max-w-sm text-sm italic leading-relaxed text-white/80">« {BRAND_SLOGAN} »</p>
            <p className="max-w-sm text-sm leading-relaxed text-white/65">
              {t.footer.initiative(BRAND_NAME, CARRIER_NAME, CARRIER_SHORT, PARTNER_NAME)}
            </p>
            <div className="flex items-center gap-2">
              <img src="/partners/cces.jpg" alt={`Logo ${CARRIER_SHORT}`} className="h-12 w-auto rounded-lg bg-white p-1" loading="lazy" />
              <img src="/partners/diaayma-local.jpg" alt={`Logo ${PARTNER_NAME}`} className="h-12 w-auto rounded-lg bg-white p-1" loading="lazy" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-md bg-[#1DC3E2]/20 px-3 py-1.5 text-xs font-medium text-[#5AD6EE]">Wave</span>
              <span className="rounded-md bg-[#FF6600]/20 px-3 py-1.5 text-xs font-medium text-[#FF8A3D]">Orange Money</span>
              <span className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium">{t.footer.card}</span>
            </div>
          </div>

          <nav aria-label="Liens du pied de page" className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">{t.footer.navigation}</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">{t.footer.causes}</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/85">{t.footer.contact}</h3>
            <ul className="space-y-3 text-sm text-white/65">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  {site.contact_phones.map((phone) => (
                    <a key={phone} href={telHref(phone)} className="transition-colors hover:text-white">
                      {phone}
                    </a>
                  ))}
                </div>
              </li>
              {site.whatsapp_number && (
                <li className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                  <a href={whatsappHref(site.whatsapp_number)} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                    {t.footer.whatsapp}
                  </a>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <a href={`mailto:${site.contact_email}`} className="break-all transition-colors hover:text-white">
                  {site.contact_email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
                <span>
                  {CARRIER_SHORT} · Récépissé {CARRIER_RECEIPT}
                  <br />
                  {PARTNER_NAME} · RCCM {PARTNER_LEGAL.rccm} · NINEA {PARTNER_LEGAL.ninea}
                </span>
              </li>
            </ul>
            {socials.length > 0 && (
              <ul className="flex gap-2" aria-label="Réseaux sociaux">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                      aria-label={`${BRAND_NAME} sur ${s.label}`}
                    >
                      <s.icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center md:flex-row md:text-left">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} {BRAND_NAME} · {CARRIER_SHORT}. {t.footer.rights}
          </p>
          <div className="flex items-center gap-6 text-xs">
            <Link to="/confidentialite" className="text-white/50 transition-colors hover:text-white">
              {t.footer.privacy}
            </Link>
            <Link to="/conditions" className="text-white/50 transition-colors hover:text-white">
              {t.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
