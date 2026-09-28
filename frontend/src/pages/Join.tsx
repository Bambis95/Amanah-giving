import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, FileSearch, Lightbulb, Loader2, Megaphone, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { BRAND_NAME, CARRIER_NAME, CARRIER_SHORT } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { REGIONS } from "@/lib/regions";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";

// A campaign proposal is stored as a contact message with this subject (admin: "Proposition de campagne")
const JOIN_SUBJECT = "join";

const REGION_CHOICES = [...REGIONS, "Hors du Sénégal"];

const STAGES = ["Idée", "En préparation", "Démarré", "En activité, à développer"];

const benefits = [
  { icon: FileSearch, title: "Vérification et validation", text: "Votre proposition est étudiée avant toute publication, pour la confiance des contributeurs." },
  { icon: Megaphone, title: "Une visibilité nationale", text: "Les campagnes validées sont publiées sur la plateforme et ouvertes aux contributions." },
  { icon: Users, title: "Un réseau de créateurs", text: `Rejoignez le ${CARRIER_NAME} (${CARRIER_SHORT}) et ses porteurs de projets.` },
];

const emptyForm = {
  name: "", organization: "", email: "", phone: "", region: "", sector: "", stage: "", title: "", need: "", description: "",
};

export default function JoinPage() {
  const source = useVisitSource();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: [keyof typeof emptyForm, string][] = [
      ["name", "votre nom"], ["email", "votre email"], ["phone", "votre téléphone"], ["region", "votre région"],
      ["sector", "la cause"], ["title", "le nom de la campagne"], ["description", "la description du projet"],
    ];
    const missing = required.find(([key]) => !form[key].trim());
    if (missing) {
      toast.error(`Veuillez indiquer ${missing[1]}`);
      return;
    }
    const need = form.need.replace(/\D/g, "");

    // Stored as a readable message: the admin sees every answer in the Messages tab
    const message = [
      `Proposition de campagne`,
      ``,
      `Campagne : ${form.title.trim()}`,
      form.organization.trim() ? `Structure : ${form.organization.trim()}` : null,
      `Cause : ${CATEGORIES.find((c) => c.value === form.sector)?.label ?? form.sector}`,
      `Région : ${form.region}`,
      form.stage ? `Stade : ${form.stage}` : null,
      need ? `Besoin estimé : ${new Intl.NumberFormat("fr-FR").format(Number(need))} FCFA` : null,
      sourceLine(source),
      ``,
      `Description :`,
      form.description.trim(),
    ]
      .filter((line) => line !== null)
      .join("\n");

    setLoading(true);
    try {
      await api.sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: JOIN_SUBJECT,
        message,
      });
      setSubmitted(true);
    } catch {
      toast.error("L'envoi a échoué. Vérifiez votre email et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="surface-brand px-4 pb-16 pt-24 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            Porteurs de projets
          </span>
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">Proposer une Campagne</h1>
          <p className="mx-auto max-w-2xl text-white/80">
            Associations, groupements, organisations, créateurs et entrepreneurs : proposez un projet à impact social,
            économique, éducatif ou communautaire. Après vérification et validation, votre campagne sera publiée sur{" "}
            {BRAND_NAME}.
          </p>
        </div>
      </section>

      <section className="-mt-6 px-4 pb-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            {benefits.map((b) => (
              <Card key={b.title} className="shadow-sm">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <b.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{b.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm lg:col-span-3">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                    <CheckCircle className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-foreground">Proposition envoyée !</h2>
                  <p className="mb-6 text-muted-foreground">
                    Merci, {form.name.trim()}. L'équipe {BRAND_NAME} étudie votre campagne « {form.title.trim()} » et vous
                    recontactera par email ou par téléphone.
                  </p>
                  <Button asChild className="rounded-lg">
                    <Link to="/projects">Voir les campagnes en cours</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <h2 className="text-2xl font-bold text-foreground">Présentez votre campagne</h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="join-name">Nom complet *</Label>
                      <Input id="join-name" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="join-org">Structure (si applicable)</Label>
                      <Input id="join-org" autoComplete="organization" placeholder="Association, groupement, GIE…" value={form.organization} onChange={(e) => set("organization", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="join-email">Email *</Label>
                      <Input id="join-email" type="email" autoComplete="email" placeholder="vous@exemple.com" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="join-phone">Téléphone *</Label>
                      <Input id="join-phone" type="tel" autoComplete="tel" placeholder="+221 7X XXX XX XX" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label>Région *</Label>
                      <Select value={form.region} onValueChange={(v) => set("region", v)}>
                        <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label="Région">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {REGION_CHOICES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="join-title">Nom de la campagne *</Label>
                    <Input id="join-title" placeholder="Ex. : Équipement d'un atelier de couture à Thiès" value={form.title} onChange={(e) => set("title", e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Cause *</Label>
                      <Select value={form.sector} onValueChange={(v) => set("sector", v)}>
                        <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label="Cause">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Stade du projet</Label>
                      <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                        <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label="Stade du projet">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="join-need">Besoin de financement estimé (FCFA)</Label>
                    <Input id="join-need" inputMode="numeric" placeholder="Ex. : 2 500 000" value={form.need} onChange={(e) => set("need", e.target.value)} className="mt-1 h-11 rounded-xl" />
                  </div>

                  <div>
                    <Label htmlFor="join-description">Description du projet *</Label>
                    <Textarea
                      id="join-description"
                      rows={5}
                      placeholder="Ce que vous voulez réaliser, pour qui, où, et ce dont vous avez besoin."
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className="mt-1 resize-none rounded-xl"
                    />
                  </div>

                  <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl font-semibold">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Envoyer ma proposition
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Vos informations servent uniquement à étudier votre demande (voir notre{" "}
                    <Link to="/confidentialite" className="text-primary hover:underline">politique de confidentialité</Link>).
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
