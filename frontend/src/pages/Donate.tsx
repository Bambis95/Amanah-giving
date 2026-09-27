import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Heart,
  CreditCard,
  Smartphone,
  Shield,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Copy,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, Project } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

const presetAmounts = [5000, 10000, 25000, 50000, 100000, 250000];

const causes = [
  { value: "education", label: "Éducation pour Tous" },
  { value: "health", label: "Santé & Bien-être" },
  { value: "water", label: "Eau Potable" },
  { value: "food", label: "Alimentation" },
  { value: "housing", label: "Logement" },
  { value: "general", label: "Don Général (là où c'est le plus nécessaire)" },
];

// Select value for "donate to a cause, not a specific project"
const NO_PROJECT = "none";

const causeLabel = (value: string) => causes.find((c) => c.value === value)?.label ?? value;

const paymentMethods = [
  {
    id: "stripe",
    name: "Carte Bancaire (Stripe)",
    icon: CreditCard,
    description: "Visa, Mastercard, etc.",
    color: "#635BFF",
  },
  {
    id: "orange_money",
    name: "Orange Money",
    icon: Smartphone,
    description: "+221 77 939 43 44",
    color: "#FF6600",
  },
  {
    id: "wave",
    name: "Wave",
    icon: Smartphone,
    description: "+221 77 939 43 44",
    color: "#1DC3E2",
  },
];

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(25000);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [cause, setCause] = useState("general");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileInstructions, setMobileInstructions] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(searchParams.get("project") ?? NO_PROJECT);

  // Only projects still open to donations can be chosen
  useEffect(() => {
    api
      .getProjects()
      .then((res) => {
        const open = res.items.filter((p) => !p.status || p.status === "active");
        setProjects(open);
        // A link to a paused/completed/deleted project falls back to "no project"
        setProjectId((current) =>
          current !== NO_PROJECT && !open.some((p) => String(p.id) === current) ? NO_PROJECT : current
        );
      })
      .catch((error) => console.error("Failed to fetch projects:", error));
  }, []);

  const selectedProject = projects.find((p) => String(p.id) === projectId) ?? null;
  const projectProgress =
    selectedProject && selectedProject.goal > 0
      ? Math.round((selectedProject.raised / selectedProject.goal) * 100)
      : 0;
  // Optional: a signed-in donor gets the donation linked to their account
  const { user } = useAuth();

  const finalAmount = customAmount ? parseInt(customAmount) : selectedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalAmount || finalAmount < 500) {
      toast.error("Veuillez entrer un montant minimum de 500 FCFA");
      return;
    }
    // Without an account, the email is the only way to reach the donor
    if (!user && !email.trim()) {
      toast.error("Veuillez indiquer votre email pour faire un don sans compte");
      document.getElementById("email")?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await api.createDonationCheckout({
        amount: finalAmount,
        // A chosen project sets the cause
        cause: selectedProject ? selectedProject.category : cause,
        project_id: selectedProject?.id,
        payment_method: paymentMethod,
        donor_first_name: firstName || undefined,
        donor_last_name: lastName || undefined,
        donor_email: email.trim() || user?.email || undefined,
        donor_phone: phone || undefined,
        message: message || undefined,
      });

      if (response.payment_method === "stripe" && response.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = response.checkout_url;
      } else if (response.instructions) {
        // Show mobile payment instructions
        setMobileInstructions(response.instructions);
        setSubmitted(true);
        toast.success("Don enregistré ! Suivez les instructions pour compléter le paiement.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <Navbar />
        <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
          <Card className="max-w-lg w-full border-0 shadow-xl text-center">
            <CardContent className="p-10">
              <div className="w-20 h-20 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-[#0D7C66]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">
                Don Enregistré !
              </h2>
              {mobileInstructions ? (
                <>
                  <p className="text-[#6B7280] mb-4">
                    Votre don de{" "}
                    <span className="font-bold text-[#0D7C66]">{formatCFA(finalAmount || 0)} FCFA</span>{" "}
                    a été enregistré.
                  </p>
                  <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm font-semibold text-[#92400E] mb-2">Instructions de paiement :</p>
                    <p className="text-sm text-[#78350F]">{mobileInstructions}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-[#92400E]"
                      onClick={() => {
                        navigator.clipboard.writeText(mobileInstructions);
                        toast.success("Instructions copiées !");
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copier
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[#6B7280] mb-6">
                  Votre contribution de{" "}
                  <span className="font-bold text-[#0D7C66]">{formatCFA(finalAmount || 0)} FCFA</span>{" "}
                  a été enregistrée avec succès. Qu'Allah vous récompense pour votre générosité.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/">
                  <Button variant="outline" className="rounded-lg border-[#0D7C66] text-[#0D7C66]">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour à l'Accueil
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setMobileInstructions(null);
                  }}
                  className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Faire un Autre Don
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />

      {/* Header */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-[#0D7C66] to-[#095C4B] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
            <Heart className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
            <span className="text-sm font-medium">Votre générosité change des vies</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Faire un Don</h1>
          <p className="text-white/80 max-w-xl mx-auto">
            Choisissez le montant, la cause et le mode de paiement qui vous conviennent. Chaque don est une amanah.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-12 px-4 -mt-6">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8">
          {/* Amount Selection */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1A1A2E] flex items-center gap-2">
                <span className="w-8 h-8 bg-[#0D7C66] text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Choisissez le Montant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount("");
                    }}
                    className={`p-4 rounded-xl border-2 text-center font-bold transition-all ${
                      selectedAmount === amount && !customAmount
                        ? "border-[#0D7C66] bg-[#E8F5F0] text-[#0D7C66]"
                        : "border-gray-200 hover:border-[#0D7C66]/50 text-[#374151]"
                    }`}
                  >
                    {formatCFA(amount)}
                    <span className="block text-xs font-normal text-[#6B7280]">FCFA</span>
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-sm text-[#6B7280]">Ou entrez un montant personnalisé</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    placeholder="Montant en FCFA"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(null);
                    }}
                    className="pl-4 pr-16 h-12 text-lg border-gray-200 focus:border-[#0D7C66] rounded-xl"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#6B7280] font-medium">
                    FCFA
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cause Selection */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1A1A2E] flex items-center gap-2">
                <span className="w-8 h-8 bg-[#F59E0B] text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Choisissez un Projet ou une Cause
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm text-[#374151]">Projet à soutenir</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-12 rounded-xl border-gray-200 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Aucun projet précis (choisir une cause)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                      {p.location ? ` · ${p.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProject ? (
                <div className="mt-4 rounded-xl bg-[#E8F5F0] p-4">
                  <p className="text-sm text-[#374151]">
                    Cause : <span className="font-semibold">{causeLabel(selectedProject.category)}</span>
                  </p>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-[#0D7C66] rounded-full"
                      style={{ width: `${Math.min(projectProgress, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1.5">
                    {formatCFA(selectedProject.raised)} FCFA collectés sur {formatCFA(selectedProject.goal)} FCFA (
                    {projectProgress}%)
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <Label className="text-sm text-[#374151]">Cause</Label>
                  <Select value={cause} onValueChange={setCause}>
                    <SelectTrigger className="h-12 rounded-xl border-gray-200 mt-1">
                      <SelectValue placeholder="Sélectionnez une cause" />
                    </SelectTrigger>
                    <SelectContent>
                      {causes.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1A1A2E] flex items-center gap-2">
                <span className="w-8 h-8 bg-[#3B82F6] text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Mode de Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === method.id
                        ? "border-[#0D7C66] bg-[#E8F5F0]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <RadioGroupItem value={method.id} />
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: method.color + "20" }}
                    >
                      <method.icon className="w-5 h-5" style={{ color: method.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1A2E] text-sm">{method.name}</p>
                      <p className="text-xs text-[#6B7280]">{method.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Donor Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[#1A1A2E] flex items-center gap-2">
                <span className="w-8 h-8 bg-[#EF4444] text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  4
                </span>
                Vos Informations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    placeholder="Votre prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 h-11 rounded-xl border-gray-200"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    placeholder="Votre nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 h-11 rounded-xl border-gray-200"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email{user ? "" : " *"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={user ? user.email : "votre@email.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={!user}
                  className="mt-1 h-11 rounded-xl border-gray-200 scroll-mt-28"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  {user
                    ? "Laissez vide pour utiliser l'email de votre compte."
                    : "Obligatoire pour que nous puissions vous contacter au sujet de votre don."}
                </p>
              </div>
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
                <Label htmlFor="message">Message (optionnel)</Label>
                <Textarea
                  id="message"
                  placeholder="Un mot d'encouragement..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 rounded-xl border-gray-200 resize-none"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary & Submit */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#0D7C66] to-[#095C4B] text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-white/80">Montant du don</span>
                <span className="text-3xl font-bold">
                  {finalAmount ? formatCFA(finalAmount) : "0"} FCFA
                </span>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-[#1A1A2E] rounded-xl py-6 text-lg font-bold shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 mr-2" />
                    Confirmer le Don
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-2 mt-4 text-white/60 text-sm">
                <Shield className="w-4 h-4" />
                <span>Paiement 100% sécurisé</span>
              </div>
            </CardContent>
          </Card>
        </form>
      </section>

      <Footer />
    </div>
  );
}