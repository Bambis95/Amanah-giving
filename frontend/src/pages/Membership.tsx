import MembershipFeeCard from "@/components/MembershipFeeCard";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, Loader2, Megaphone, Printer, Send, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";
import { BRAND_NAME, CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT } from "@/lib/brand";
import { CATEGORIES } from "@/lib/categories";
import { REGIONS } from "@/lib/regions";
import { MEMBER_EXPECTATIONS, MEMBER_PROFILES } from "@/lib/membership";
import { sourceLine, useVisitSource } from "@/hooks/use-visit-source";
import { useI18n } from "@/i18n";

// Stored as a contact message with this subject (admin: "Adhésion au club")
const MEMBERSHIP_SUBJECT = "membership";
const OTHER_SECTOR = "autre";

const BENEFIT_ICONS = [Users, Megaphone, UserPlus];
// Region kept in the message for a member abroad (the admin reads French)
const DIASPORA = "Diaspora (hors du Sénégal)";

const emptyForm = {
  firstName: "", lastName: "", phone: "", email: "", region: "", city: "",
  profile: "", activity: "", sector: "", organization: "", motivation: "",
};

export default function MembershipPage() {
  const source = useVisitSource();
  const { t: dict } = useI18n();
  const t = dict.membership;
  const benefits = t.benefits.map((b, i) => ({ ...b, icon: BENEFIT_ICONS[i] }));
  const [form, setForm] = useState(emptyForm);
  const [expectations, setExpectations] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (item: string) =>
    setExpectations((list) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required: (keyof typeof emptyForm)[] = ["firstName", "lastName", "phone", "region", "profile", "activity"];
    const missing = required.find((key) => !form[key].trim());
    if (missing) return toast.error(t.missing[missing]);
    if (!consent) return toast.error(t.consentNeeded);

    const sector = form.sector === OTHER_SECTOR ? "Autre" : CATEGORIES.find((c) => c.value === form.sector)?.label;
    // Stored as a readable message: the admin sees every answer in the Messages tab
    const message = [
      `Demande d'adhésion au ${CARRIER_SHORT}`,
      ``,
      `Profil : ${form.profile}`,
      `Activité : ${form.activity.trim()}`,
      sector ? `Secteur : ${sector}` : null,
      form.organization.trim() ? `Structure : ${form.organization.trim()}` : null,
      `Région : ${form.region}${form.city.trim() ? ` (${form.city.trim()})` : ""}`,
      expectations.length ? `Attentes : ${expectations.join(", ")}` : null,
      sourceLine(source),
      form.motivation.trim() ? `\nMotivation :\n${form.motivation.trim()}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n");

    setLoading(true);
    try {
      await api.sendContactMessage({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: MEMBERSHIP_SUBJECT,
        message,
      });
      setSubmitted(true);
    } catch {
      toast.error(t.failed);
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
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t.badge}
          </span>
          <h1 className="mb-4 text-3xl font-bold md:text-4xl">{t.title}</h1>
          <p className="mx-auto max-w-2xl text-white/85">
            {t.intro(CARRIER_NAME, CARRIER_SHORT, BRAND_NAME)}
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
            {/* Members renewing (or who applied on paper) pay here without the form */}
            {!submitted && <MembershipFeeCard />}
            <Card className="shadow-sm">
              <CardContent className="space-y-3 p-5">
                <p className="text-sm text-muted-foreground">
                  {t.paper}
                </p>
                <Button asChild variant="outline" className="w-full rounded-lg">
                  <Link to="/adherer/imprimer">
                    <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t.print}
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  {CARRIER_SHORT} · {t.receipt} {CARRIER_RECEIPT}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm lg:col-span-3">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="py-10 text-center" role="status">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                    <CheckCircle className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-xl font-bold text-foreground">{t.sentTitle}</h2>
                  <p className="mb-6 text-muted-foreground">
                    {t.sentText(form.firstName.trim(), CARRIER_SHORT, !!form.email.trim())}
                  </p>
                  <MembershipFeeCard
                    prefill={{ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone }}
                    className="mx-auto mb-6 max-w-sm text-left"
                  />
                  <Button asChild className="rounded-lg">
                    <Link to="/projects">{t.seeCampaigns}</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  <fieldset className="space-y-4">
                    <legend className="mb-2 text-lg font-bold text-foreground">{t.contactLegend}</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="m-first">{t.firstName}</Label>
                        <Input id="m-first" autoComplete="given-name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="m-last">{t.lastName}</Label>
                        <Input id="m-last" autoComplete="family-name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="m-phone">{t.phone}</Label>
                        <Input id="m-phone" type="tel" autoComplete="tel" placeholder="+221 7X XXX XX XX" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="m-email">{t.email}</Label>
                        <Input id="m-email" type="email" autoComplete="email" placeholder={t.emailPlaceholder} value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label>{t.region}</Label>
                        <Select value={form.region} onValueChange={(v) => set("region", v)}>
                          <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label={t.regionLabel}>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {REGIONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                            <SelectItem value={DIASPORA}>{t.diaspora}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="m-city">{t.city}</Label>
                        <Input id="m-city" autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="mb-2 text-lg font-bold text-foreground">{t.activityLegend}</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>{t.profile}</Label>
                        <Select value={form.profile} onValueChange={(v) => set("profile", v)}>
                          <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label={t.profileLabel}>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_PROFILES.map((p, i) => (
                              <SelectItem key={p} value={p}>{t.profiles[i] ?? p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t.sector}</Label>
                        <Select value={form.sector} onValueChange={(v) => set("sector", v)}>
                          <SelectTrigger className="mt-1 h-11 rounded-xl" aria-label={t.sector}>
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{dict.categories[c.value] ?? c.label}</SelectItem>
                            ))}
                            <SelectItem value={OTHER_SECTOR}>{t.otherSector}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="m-activity">{t.activity}</Label>
                        <Input id="m-activity" placeholder={t.activityPlaceholder} value={form.activity} onChange={(e) => set("activity", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="m-org">{t.organization}</Label>
                        <Input id="m-org" autoComplete="organization" placeholder={t.organizationPlaceholder} value={form.organization} onChange={(e) => set("organization", e.target.value)} className="mt-1 h-11 rounded-xl" />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="mb-2 text-lg font-bold text-foreground">{t.expectationsLegend}</legend>
                    {MEMBER_EXPECTATIONS.map((item, i) => (
                      <label key={item} className="flex cursor-pointer items-start gap-3 text-sm text-foreground/90">
                        <Checkbox checked={expectations.includes(item)} onCheckedChange={() => toggle(item)} className="mt-0.5" />
                        {t.expectations[i] ?? item}
                      </label>
                    ))}
                    <div>
                      <Label htmlFor="m-motivation">{t.motivation}</Label>
                      <Textarea id="m-motivation" rows={4} value={form.motivation} onChange={(e) => set("motivation", e.target.value)} className="mt-1 resize-none rounded-xl" />
                    </div>
                  </fieldset>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/60 p-4 text-sm text-foreground/90">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-required="true" />
                    <span>
                      {t.consent(CARRIER_SHORT)}{" "}
                      <Link to="/confidentialite" className="text-primary hover:underline">{t.privacy}</Link>). *
                    </span>
                  </label>

                  <Button type="submit" size="lg" disabled={loading} className="w-full rounded-xl font-semibold">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {t.submit}
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
