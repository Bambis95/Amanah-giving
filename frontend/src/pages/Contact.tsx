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
  MapPin,
  Clock,
  Send,
  MessageCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";

const contactInfo = [
  {
    icon: Phone,
    title: "Téléphone",
    details: ["+221 77 939 43 44"],
    subtitle: "Orange Money & Wave",
    color: "#0D7C66",
  },
  {
    icon: Mail,
    title: "Email",
    details: ["Khadimbaeft@gmail.com"],
    subtitle: "Réponse sous 24h",
    color: "#3B82F6",
  },
  {
    icon: MapPin,
    title: "Adresse",
    details: ["Sacré Cœur 3, Mermoz", "Dakar, Sénégal"],
    subtitle: "",
    color: "#F59E0B",
  },
  {
    icon: Clock,
    title: "Horaires",
    details: ["Lun - Ven: 9h - 18h", "Sam: 9h - 13h"],
    subtitle: "Fuseau GMT",
    color: "#EF4444",
  },
];

const subjects = [
  { value: "general", label: "Question Générale" },
  { value: "donation", label: "Question sur un Don" },
  { value: "project", label: "Proposer un Projet" },
  { value: "partnership", label: "Partenariat" },
  { value: "volunteer", label: "Bénévolat" },
  { value: "other", label: "Autre" },
];

export default function ContactPage() {
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
      toast.error("Veuillez remplir tous les champs obligatoires");
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
      toast.success("Message envoyé avec succès !");
    } catch (error) {
      toast.error("Erreur lors de l'envoi du message. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-[#1A1A2E] to-[#2D2D4E] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <MessageCircle className="w-4 h-4 inline mr-1" />
            Contactez-nous
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Nous Sommes à Votre Écoute</h1>
          <p className="text-white/70 max-w-xl mx-auto">
            Une question, une suggestion ou un projet à proposer ? N'hésitez pas à nous contacter.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-8 px-4 -mt-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map((info) => (
              <Card key={info.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-5 text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: info.color + "15" }}
                  >
                    <info.icon className="w-6 h-6" style={{ color: info.color }} />
                  </div>
                  <h3 className="font-bold text-[#1A1A2E] text-sm mb-1">{info.title}</h3>
                  {info.details.map((d) => (
                    <p key={d} className="text-sm text-[#374151]">{d}</p>
                  ))}
                  {info.subtitle && (
                    <p className="text-xs text-[#6B7280] mt-1">{info.subtitle}</p>
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
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-[#0D7C66]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1A1A2E] mb-2">Message Envoyé !</h3>
                    <p className="text-[#6B7280] mb-6">
                      Merci de nous avoir contactés. Nous vous répondrons dans les plus brefs délais.
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
                      className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg"
                    >
                      Envoyer un Autre Message
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-[#1A1A2E] mb-6">Envoyez-nous un Message</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Nom Complet *</Label>
                          <Input
                            id="name"
                            placeholder="Votre nom"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-gray-200"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="votre@email.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone">Téléphone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+221 7X XXX XX XX"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1 h-11 rounded-xl border-gray-200"
                          />
                        </div>
                        <div>
                          <Label htmlFor="subject">Sujet</Label>
                          <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="mt-1 h-11 rounded-xl border-gray-200">
                              <SelectValue placeholder="Choisir un sujet" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="message">Message *</Label>
                        <Textarea
                          id="message"
                          placeholder="Écrivez votre message ici..."
                          required
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="mt-1 rounded-xl border-gray-200 resize-none"
                          rows={5}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={loading}
                        className="w-full bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-xl font-semibold"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Envoyer le Message
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
            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="h-64 bg-gray-200">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3859.0!2d-17.4677!3d14.7167!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTTCsDQzJzAwLjEiTiAxN8KwMjgnMDMuNyJX!5e0!3m2!1sfr!2ssn!4v1!5m2!1sfr!2ssn"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localisation Amanah Giving"
                />
              </div>
              <CardContent className="p-5">
                <h3 className="font-bold text-[#1A1A2E] mb-2">Notre Bureau</h3>
                <p className="text-sm text-[#6B7280]">
                  Sacré Cœur 3, Mermoz<br />
                  Dakar, Sénégal
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-[#0D7C66] to-[#095C4B] text-white">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-3">Modes de Paiement</h3>
                <p className="text-white/80 text-sm mb-4">
                  Nous acceptons plusieurs modes de paiement pour faciliter vos dons :
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold">S</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Stripe</p>
                      <p className="text-xs text-white/60">Carte bancaire internationale</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-[#FF6600]/30 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#FF6600]">OM</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Orange Money</p>
                      <p className="text-xs text-white/60">+221 77 939 43 44</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <div className="w-8 h-8 bg-[#1DC3E2]/30 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#1DC3E2]">W</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Wave</p>
                      <p className="text-xs text-white/60">+221 77 939 43 44</p>
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