import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { softTone, textTone, Tone } from "@/lib/tones";
import { formatAmount, formatNumber, plural, usePublicStats } from "@/hooks/use-public-stats";
import {
  Heart,
  Shield,
  Eye,
  Users,
  Target,
  Globe,
  HandHeart,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const values = [
  {
    icon: Shield,
    title: "Amanah (Confiance)",
    description: "Chaque don est une amanah, un dépôt sacré. Nous garantissons que vos contributions sont utilisées exactement comme prévu.",
    tone: "primary" as Tone,
  },
  {
    icon: Eye,
    title: "Transparence",
    description: "Rapports détaillés, suivi en temps réel et audits réguliers. Vous savez toujours où va votre argent.",
    tone: "info" as Tone,
  },
  {
    icon: HandHeart,
    title: "Compassion",
    description: "Nous croyons en la dignité de chaque être humain et travaillons pour améliorer les conditions de vie des plus vulnérables.",
    tone: "highlight" as Tone,
  },
  {
    icon: Globe,
    title: "Impact Global",
    description: "De Dakar au monde entier, nous connectons les donateurs avec les communautés qui ont le plus besoin d'aide.",
    tone: "destructive" as Tone,
  },
];

const milestones = [
  { year: "2020", event: "Fondation d'Amanah Giving à Dakar" },
  { year: "2021", event: "Premier projet financé : École de Thiès" },
  { year: "2022", event: "Expansion dans 5 régions du Sénégal" },
  { year: "2024", event: "Ouverture aux projets internationaux" },
  { year: "2025", event: "Lancement de la plateforme en ligne" },
];

const commitments = [
  "100% des dons, hors frais de paiement, vont directement aux projets",
  "Rapports d'impact trimestriels pour chaque projet",
  "Audit financier annuel par un cabinet indépendant",
  "Équipe de terrain vérifiant chaque projet",
  "Communication directe avec les bénéficiaires",
  "Politique de remboursement transparente",
];

export default function AboutPage() {
  const { stats, failed: statsFailed } = usePublicStats();
  const figures = [
    { value: formatNumber(stats?.donors ?? 0), label: plural(stats?.donors ?? 0, "Donateur", "Donateurs"), tone: "primary" as Tone },
    { value: formatNumber(stats?.active_projects ?? 0), label: plural(stats?.active_projects ?? 0, "Projet actif", "Projets actifs"), tone: "highlight" as Tone },
    { value: formatAmount(stats?.total_raised ?? 0), label: "FCFA collectés", tone: "info" as Tone },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-16 px-4 surface-brand">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            Notre Histoire
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-6">
            À Propos d'Amanah Giving
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Née de la conviction que chaque acte de générosité est un dépôt sacré, Amanah Giving connecte les cœurs généreux du monde entier avec les communautés qui en ont le plus besoin.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block bg-accent text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
                Notre Mission
              </span>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Faciliter la Générosité, Maximiser l'Impact
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Amanah Giving est une plateforme de dons en ligne fondée à Dakar, Sénégal, avec pour mission de rendre le don accessible, transparent et impactant. Nous croyons que la générosité ne connaît pas de frontières et que chaque contribution, aussi petite soit-elle, peut transformer des vies.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Notre plateforme permet aux donateurs du monde entier de soutenir des projets vérifiés dans les domaines de l'éducation, la santé, l'eau potable, l'alimentation et le logement, avec une transparence totale sur l'utilisation des fonds.
              </p>
              {/* Real figures; hidden if they cannot be loaded rather than showing wrong ones */}
              {!statsFailed && (
                <div className="flex items-center gap-6">
                  {figures.map((f, i) => (
                    <div key={f.label} className="flex items-center gap-6">
                      {i > 0 && <div className="w-px h-12 bg-muted" />}
                      <div className="text-center">
                        <p className={cn("text-3xl font-bold tabular-nums", textTone[f.tone])}>
                          {stats ? f.value : "…"}
                        </p>
                        <p className="text-sm text-muted-foreground">{f.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.map((v) => (
                <Card key={v.title} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div
                      className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", softTone[v.tone])}
                    >
                      <v.icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h3 className="font-bold text-foreground text-sm mb-2">{v.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-4 bg-muted/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-highlight/15 text-warning text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              Notre Parcours
            </span>
            <h2 className="text-3xl font-bold text-foreground">Étapes Clés</h2>
          </div>

          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={m.year} className="flex items-center gap-6 group">
                <div className="w-20 text-right">
                  <span className="text-lg font-bold text-primary">{m.year}</span>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="w-4 h-4 bg-primary rounded-full border-4 border-accent motion-safe:group-hover:scale-125 transition-transform" />
                  {i < milestones.length - 1 && (
                    <div className="w-0.5 h-8 bg-primary/20" />
                  )}
                </div>
                <Card className="flex-1 border-0 shadow-sm group-hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-foreground/80 font-medium">{m.event}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-accent text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              <Target className="w-4 h-4 inline mr-1" />
              Nos Engagements
            </span>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Notre Promesse envers Vous
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              La confiance est au cœur de notre mission. Voici nos engagements envers chaque donateur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commitments.map((c) => (
              <div
                key={c}
                className="flex items-start gap-3 p-4 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground/80 text-sm font-medium">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 surface-hero">
        <div className="max-w-3xl mx-auto text-center">
          <Users className="w-12 h-12 mx-auto mb-6 text-primary" />
          <h2 className="text-3xl font-bold mb-4">Rejoignez Notre Communauté</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            Ensemble, nous pouvons créer un impact durable.{" "}
            {stats && stats.donors > 0
              ? `Rejoignez ${plural(stats.donors, "le donateur qui fait", `les ${formatNumber(stats.donors)} donateurs qui font`)} déjà la différence.`
              : "Soyez parmi les premiers à faire la différence."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 font-semibold"
              ><Link to="/donate">
                <Heart className="w-5 h-5 mr-2" />
                Faire un Don
              </Link></Button>
            <Button asChild
                size="lg"
                variant="outline"
                className="!bg-transparent border-2 border-white/30 text-white !hover:bg-white/10 rounded-xl px-8 font-semibold"
              ><Link to="/contact">
                Nous Contacter
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link></Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}