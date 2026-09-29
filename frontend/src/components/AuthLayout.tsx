import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck, GraduationCap, ShieldCheck, Users } from "lucide-react";
import Logo from "@/components/Logo";
import { BRAND_SLOGAN, CARRIER_RECEIPT, CARRIER_SHORT } from "@/lib/brand";

// Real figures from the campaigns on the site: update them with the campaigns
const IMPACT = [
  { icon: GraduationCap, value: "2 500", label: "jeunes des daaras à former" },
  { icon: Users, value: "400", label: "femmes formées à Fandène" },
];

const PHOTO = "/collectes/femmes-fandene.jpg";

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Link under the form (e.g. back to sign-in) */
  footer?: ReactNode;
}

/**
 * Sign-in screens (connexion, compte, mot de passe, invitation): the SENJAPO photo panel on the left
 * from large screens, a photo band on phones, and the form alone on the right without the site footer.
 */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (large screens), kept in view while a longer form scrolls */}
      <aside className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <img src={PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="auth-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <Link to="/" className="w-fit rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <Logo variant="onDark" />
          </Link>

          <div className="max-w-md">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-highlight">Solidarité nationale</p>
            <p className="text-3xl font-bold leading-tight xl:text-4xl">{BRAND_SLOGAN}</p>
            <dl className="mt-10 grid grid-cols-2 gap-4">
              {IMPACT.map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                  <Icon className="mb-3 h-5 w-5 text-highlight" aria-hidden="true" />
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block text-2xl font-bold tabular-nums">{value}</span>
                    <span className="text-sm text-white/75">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <ul className="space-y-2 text-sm text-white/75">
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
              Initiative du {CARRIER_SHORT}, récépissé {CARRIER_RECEIPT}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
              Paiements sécurisés : Wave, Orange Money, carte bancaire
            </li>
          </ul>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Photo band (phones and tablets) */}
        <div className="relative h-36 overflow-hidden sm:h-44 lg:hidden">
          <img src={PHOTO} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="auth-overlay absolute inset-0" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between p-4 text-white sm:p-6">
            <div className="flex items-center justify-between">
              <Link to="/" aria-label="Accueil SENJAPO">
                <Logo variant="onDark" size="sm" />
              </Link>
              <Link to="/" className="flex items-center gap-1 text-sm font-medium text-white/85 hover:text-white">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Le site
              </Link>
            </div>
            <p className="max-w-xs text-sm font-semibold leading-snug sm:text-base">{BRAND_SLOGAN}</p>
          </div>
        </div>

        <div className="hidden justify-end p-6 lg:flex">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour au site
          </Link>
        </div>

        <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 lg:items-center lg:py-0">
          <div className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle && <div className="mt-2 text-muted-foreground">{subtitle}</div>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>

        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SENJAPO · {CARRIER_SHORT}</span>
          <Link to="/conditions" className="hover:text-primary">Conditions</Link>
          <Link to="/confidentialite" className="hover:text-primary">Confidentialité</Link>
        </footer>
      </div>
    </div>
  );
}
