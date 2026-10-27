import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Crown, HandHeart, PiggyBank, RotateCw, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatCFA } from "@/components/admin/format";
import { useTontineLandingText } from "@/i18n/tontineLanding";

const ICONS = [PiggyBank, RotateCw, HandHeart];
const PREMIUM_PRICE = 10_000;

/** "Tontines" for visitors who are not signed in: what it is, the three formulas, the questions people ask */
export default function TontinesLanding() {
  const lt = useTontineLandingText();
  const signUp = { from: "/tontines", tab: "register" };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{lt.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-5xl">{lt.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{lt.lead}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/login" state={signUp}>{lt.start}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/login" state={{ from: "/tontines" }}>{lt.signIn}</Link></Button>
          </div>
        </section>

        <Card className="mx-auto mt-10 max-w-3xl border-s-4 border-s-primary shadow-sm">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>{lt.safety}</p>
          </CardContent>
        </Card>

        <section className="mt-14">
          <h2 className="text-center text-2xl font-bold text-foreground">{lt.formulasTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {lt.formulas.map((f, i) => {
              const Icon = ICONS[i];
              return (
                <Card key={f.title} className="shadow-sm">
                  <CardContent className="p-5">
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-center text-2xl font-bold text-foreground">{lt.featuresTitle}</h2>
          <ul className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-2">
            {lt.features.map((f) => (
              <li key={f} className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{f}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
            <Crown className="h-5 w-5 text-highlight" aria-hidden="true" />{lt.plansTitle}
          </h2>
          <div className="mt-4 space-y-2 text-center text-muted-foreground">
            <p>{lt.free}</p>
            <p>{lt.premium(formatCFA(PREMIUM_PRICE))}</p>
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-foreground">{lt.faqTitle}</h2>
          <Accordion type="single" collapsible className="mt-4">
            {lt.faq.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`}>
                <AccordionTrigger className="text-start">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 text-center">
            <Button asChild size="lg"><Link to="/login" state={signUp}>{lt.start}</Link></Button>
          </div>
        </section>
      </main>
      <Footer />
      {/* Questions and answers, for search engines that show them in their results */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: lt.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
        })}
      </script>
    </div>
  );
}
