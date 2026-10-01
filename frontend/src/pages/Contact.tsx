import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Phone,
  Mail,
  BadgeCheck,
  Handshake,
  Send,
  MessageCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/use-site-settings";
import type { SiteSettings } from "@/api";
import { CARRIER_NAME, CARRIER_RECEIPT, CARRIER_SHORT, PARTNER_NAME } from "@/lib/brand";
import { softTone, textTone, Tone } from "@/lib/tones";
import { Dictionary, useI18n } from "@/i18n";

const contactCards = (site: SiteSettings, t: Dictionary["contact"]) => [
  {
    icon: Phone,
    title: t.phone,
    details: site.contact_phones,
    subtitle: "",
    tone: "primary" as Tone,
  },
  {
    icon: Mail,
    title: t.email,
    details: [site.contact_email],
    subtitle: "",
    tone: "info" as Tone,
  },
  {
    icon: BadgeCheck,
    title: t.carrier,
    details: [CARRIER_SHORT],
    subtitle: t.receipt(CARRIER_RECEIPT),
    tone: "highlight" as Tone,
  },
  {
    icon: Handshake,
    title: t.partner,
    details: [PARTNER_NAME],
    subtitle: "",
    tone: "destructive" as Tone,
  },
];

// Stored values (the admin's Messages tab labels them)
const SUBJECTS = ["general", "donation", "project", "partnership", "volunteer", "other"];

export default function ContactPage() {
  const t = useI18n().t.contact;
  const contactInfo = contactCards(useSiteSettings(), t);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("general");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error(t.required);
      return;
    }

    setLoading(true);

    try {
      await api.sendContactMessage({
        name,
        email,
        phone: phone || undefined,
        subject,
        message,
      });
      setSubmitted(true);
      toast.success(t.sent);
    } catch (error) {
      toast.error(t.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-12 px-4 surface-hero">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <MessageCircle className="w-4 h-4 inline mr-1" />
            {t.badge}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{t.title}</h1>
          <p className="text-white/70 max-w-xl mx-auto">
            {t.intro}
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-8 px-4 -mt-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map((info) => (
              <Card key={info.title} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 text-center">
                  <div
                    className={cn("w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3", softTone[info.tone])}
                  >
                    <info.icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm mb-1">{info.title}</h3>
                  {info.details.map((d) => (
                    <p key={d} dir="auto" className="text-sm text-foreground/80">{d}</p>
                  ))}
                  {info.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{info.subtitle}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Form & Map */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardContent className="p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{t.sentTitle}</h3>
                    <p className="text-muted-foreground mb-6">
                      {t.sentText}
                    </p>
                    <Button
                      onClick={() => {
                        setSubmitted(false);
                        setName("");
                        setEmail("");
                        setPhone("");
                        setSubject("general");
                        setMessage("");
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                    >
                      {t.another}
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-foreground mb-6">{t.formTitle}</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">{t.name}</Label>
                          <Input
                            id="name"
                            placeholder={t.namePlaceholder}
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-border"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">{t.emailLabel}</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t.emailPlaceholder}
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-border"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone">{t.phone}</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+221 7X XXX XX XX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-border"
                          />
                        </div>
                        <div>
                          <Label htmlFor="subject">{t.subject}</Label>
                          <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="mt-1 h-11 rounded-xl border-border">
                              <SelectValue placeholder={t.subjectPlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                              {SUBJECTS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {t.subjects[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="message">{t.message}</Label>
                        <Textarea
                          id="message"
                          placeholder={t.messagePlaceholder}
                          required
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="mt-1 rounded-xl border-border resize-none"
                          rows={5}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t.sending}
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            {t.send}
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map & Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardContent className="space-y-4 p-6">
                <h3 className="font-bold text-foreground">{t.projectTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {t.projectText(CARRIER_NAME, CARRIER_SHORT)}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <Button asChild className="rounded-lg">
                    <Link to="/proposer">{t.propose}</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-lg">
                    <Link to="/partenaires">{t.partners}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-brand border-0 text-white shadow-md">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3">{t.methodsTitle}</h3>
                <p className="text-white/80 text-sm mb-4">
                  {t.methodsText}
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold">CB</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.card}</p>
                      <p className="text-xs text-white/60">Visa, Mastercard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-[#FF6600]/25 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#FFB27A]">OM</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Orange Money</p>
                      <p className="text-xs text-white/60">{t.mobile}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-[#1DC3E2]/25 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#8BE6F5]">W</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Wave</p>
                      <p className="text-xs text-white/60">{t.mobile}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}