import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BRAND_SHORT } from "@/lib/brand";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface LegalLayoutProps {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}

// Shared page for legal texts: header, table of contents (sticky on large screens) and numbered sections
export default function LegalLayout({ title, updated, intro, sections }: LegalLayoutProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${BRAND_SHORT}`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="surface-brand px-4 pb-12 pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-white/70">Dernière mise à jour : {updated}</p>
        </div>
      </section>

      <main className="px-4 py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Sommaire" className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sommaire</p>
            <ol className="space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted-foreground transition-colors hover:text-primary">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0 max-w-3xl space-y-10 leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul+p]:mt-3[&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:space-y-1.5">
            <div className="text-foreground">{intro}</div>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="mb-3 text-xl font-semibold text-foreground">
                  {i + 1}. {s.title}
                </h2>
                {s.content}
              </section>
            ))}
            <p className="border-t pt-6 text-sm">
              Voir aussi : <Link to="/confidentialite">Politique de confidentialité</Link> ·{" "}
              <Link to="/conditions">Conditions d'utilisation</Link> · <Link to="/contact">Contact</Link>
            </p>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
