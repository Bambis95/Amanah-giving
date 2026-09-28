import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Building2, Briefcase, CheckCircle, Globe2, HeartHandshake, Landmark, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { BRAND_NAME, BRAND_SHORT } from "@/lib/brand";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";

// Stored as a contact message with this subject (admin: "Partenariat")
const PARTNERSHIP_SUBJECT = "partnership";

const partnerTypes = [
  {
    icon: Landmark,
    title: "Collectivités & institutions",
    text: "Mairies, conseils départementaux, services de l'État : identifier ensemble les projets prioritaires du territoire et en assurer le suivi.",
  },
  {
    icon: Briefcase,
    title: "Entreprises & sponsors",
    text: "Financer un projet, parrainer une région ou un secteur, mettre à disposition du matériel ou des compétences.",
  },
  {
    icon: HeartHandshake,
    title: "Associations & ONG",
    text: "Unir nos forces sur le terrain : accompagnement des porteurs de projets, formation, suivi.",
  },
  {
    icon: Globe2,
    title: "Diaspora",
    text: "Soutenir le développement de sa région d'origine, à distance et en toute transparence.",
  },
];

const PARTNERSHIP_KINDS = [
  "Financement de projets",
  "Sponsoring / mécénat",
  "Appui technique ou formation",
  "Mise à disposition (terrain, locaux, matériel)",
  "Relais et communication",
  "Autre",
];

const emptyForm = { organization: "", contact: "", role: "", email: "", phone: "", kind: "", message: "" };

export default function PartnersPage() {
  const source = useVisitSource();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: [keyof typeof emptyForm, string][] = [
      ["organization", "le nom de votre organisation"], ["contact", "votre nom"], ["email", "votre email"],
      ["message", "votre message"],
    ];
    const missing = required.find(([key]) => !form[key].trim());
    if (missing) {
      toast.error(`Veuillez indiquer ${missing[1]}`);
      return;
    }
    setLoading(true);
    try {
      await api.sendContactMessage({
        name: `${form.contact.trim()} (${form.organization.trim()})`,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: PARTNERSHIP_SUBJECT,
        message: [
          `Proposition de partenariat`,
          ``,
          `Organisation : ${form.organization.trim()}`,
          form.role.trim() ? `Fonction : ${form.role.trim()}` : null,
          form.kind ? `Type de partenariat : ${form.kind}` : null,
          sourceLine(source),
          ``,
          form.message.trim(),
        ]
          .filter((line) => line !== null)
          .join("\n"),
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

      <section className="surface-hero px-4 pb-16 pt-24 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Partenariats
          </span>
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">Construisons Ensemble</h1>
          <p className="mx-auto max-w-2xl text-white/75">
            La {BRAND_NAME} s'associe aux collectivités, aux entreprises, aux associations et à la diaspora pour
            financer et accompagner les projets de développement de nos régions.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {partnerTypes.map((p) => (
            <Card key={p.title} className="shadow-sm">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                  <p.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mb-2 font-bold text-foreground">{p.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Pourquoi devenir partenaire ?</h2>
            <ul className="space-y-3 text-muted-foreground">
              {[
                "Des projets concrets, choisis au plus près des besoins des régions.",
                "Une plateforme transparente : l'avancement de chaque projet est publié en ligne.",
                "Un réseau de créateurs de tous les secteurs, prêts à entreprendre.",
                "Une visibilité pour votre organisation auprès des donateurs et du public.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Vous portez vous-même un projet ?{" "}
              <Link to="/rejoindre" className="font-medium text-primary hover:underline">Rejoignez le club</Link>.
            </p>
          </div>

          <Card className="shadow-sm lg:col-span-3">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                    <CheckCircle className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-foreground">Merci pour votre proposition !</h2>
                  <p className="text-muted-foreground">
                    La {BRAND_SHORT} a bien reçu votre message et reviendra vers vous très prochainement.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <h2 className="text-2xl font-bold text-foreground">Proposer un partenariat</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="p-org">Organisation *</Label>
                      <Input id="p-org" placeholder="Ex. : Mairie de Thiès, entreprise, association…" value={form.organization} onChange={(e) => set("organization", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="p-contact">Nom du contact *</Label>
                      <Input id="p-contact" autoComplete="name" value={form.contact} onChange={(e) => set("contact", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="p-role">Fonction</Label>
                      <Input id="p-role" autoComplete="organization-title" value={form.role} onChange={(e) => set("role", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="p-email">Email *</Label>
                      <Input id="p-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="p-phone">Téléphone</Label>
                      <Input id="p-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 h-11 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <Label>Type de partenariat</Label>
                    <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
                      <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label="Type de partenariat">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTNERSHIP_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="p-message">Votre message *</Label>
                    <Textarea id="p-message" rows={5} placeholder="Présentez votre organisation et ce que vous envisagez." value={form.message} onChange={(e) => set("message", e.target.value)} className="mt-1 resize-none rounded-xl" />
                  </div>
                  <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl font-semibold">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Envoyer ma proposition
                  </Button>
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
