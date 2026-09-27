import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Veuillez saisir votre email");
      return;
    }
    setLoading(true);
    try {
      setSentMessage(await api.forgotPassword(email.trim()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La demande a échoué");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 flex items-start justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#0D7C66] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              {sentMessage ? <MailCheck className="w-7 h-7 text-white" /> : <KeyRound className="w-7 h-7 text-white" />}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A2E]">
              {sentMessage ? "Vérifiez votre boîte mail" : "Mot de passe oublié"}
            </h1>
            <p className="text-[#6B7280] mt-2">
              {sentMessage
                ? sentMessage
                : "Saisissez l'email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."}
            </p>
          </div>

          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 md:p-8">
              {sentMessage ? (
                <div className="space-y-4 text-sm text-[#374151]">
                  <p>Le lien est valable 1 heure et ne peut servir qu'une fois.</p>
                  <p className="text-[#6B7280]">
                    Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables, ou refaites une demande.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setSentMessage(null)}>
                    Refaire une demande
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0D7C66] hover:bg-[#095C4B] text-white font-semibold h-11"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Envoyer le lien
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-[#6B7280] mt-6">
            <Link to="/login" className="text-[#0D7C66] font-medium hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
