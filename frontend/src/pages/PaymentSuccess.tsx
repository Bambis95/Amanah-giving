import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, XCircle, Clock, Heart, Loader2, RefreshCw } from "lucide-react";
import { api, VerifyPaymentResponse } from "@/api";

// Amounts are stored in FCFA (XOF has no cents): display them as they are
function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

type State = "loading" | "paid" | "pending" | "failed";

// PayDunya can take a moment to confirm Wave / Orange Money: re-check a few times
const PENDING_RETRIES = 6;
const RETRY_DELAY_MS = 5000;

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id"); // Stripe
  const donationId = Number(searchParams.get("donation_id")) || null; // PayDunya
  const isPaydunya = searchParams.get("provider") === "paydunya";

  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const check = useCallback(async () => {
    let result: VerifyPaymentResponse;
    try {
      if (sessionId) {
        result = await api.verifyPayment(sessionId);
      } else if (isPaydunya && donationId) {
        result = await api.verifyPaydunyaPayment(donationId);
      } else {
        setState("failed");
        setMessage("Lien de retour de paiement incomplet.");
        return;
      }
    } catch {
      setState("failed");
      setMessage("Impossible de vérifier le paiement pour le moment. Réessayez dans quelques instants.");
      return;
    }

    if (result.amount !== null) setAmount(result.amount);
    if (result.payment_status === "paid") {
      setState("paid");
    } else if (result.payment_status === "pending" && isPaydunya) {
      setState("pending");
      if (retries.current < PENDING_RETRIES) {
        retries.current += 1;
        timer.current = setTimeout(check, RETRY_DELAY_MS);
      }
    } else {
      setState("failed");
      setMessage(
        result.payment_status === "cancelled"
          ? "Le paiement a été annulé. Aucun montant n'a été débité."
          : "Le paiement n'a pas été confirmé."
      );
    }
  }, [sessionId, donationId, isPaydunya]);

  useEffect(() => {
    check();
    return () => clearTimeout(timer.current);
  }, [check]);

  const recheck = () => {
    clearTimeout(timer.current);
    retries.current = 0;
    setState("loading");
    check();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-lg w-full shadow-sm text-center">
          <CardContent className="p-10">
            {state === "loading" && (
              <div className="py-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Vérification du paiement…</p>
              </div>
            )}

            {state === "paid" && (
              <>
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Merci pour votre don !</h2>
                <p className="text-muted-foreground mb-8">
                  Votre don
                  {amount !== null && (
                    <>
                      {" "}de <span className="font-bold text-primary">{formatCFA(amount)}</span>
                    </>
                  )}{" "}
                  a bien été reçu. Un email de confirmation vous sera envoyé si vous avez indiqué votre adresse.
                </p>
              </>
            )}

            {state === "pending" && (
              <>
                <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-warning" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Paiement en cours de confirmation</h2>
                <p className="text-muted-foreground mb-6">
                  Nous attendons la confirmation de votre opérateur
                  {amount !== null && <> pour votre don de {formatCFA(amount)}</>}. Cela peut prendre quelques
                  minutes.
                </p>
                <Button variant="outline" onClick={recheck} className="mb-6">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Vérifier à nouveau
                </Button>
              </>
            )}

            {state === "failed" && (
              <>
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Paiement non confirmé</h2>
                <p className="text-sm text-muted-foreground mb-8">{message}</p>
              </>
            )}

            {state !== "loading" && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="outline" className="w-full sm:w-auto"><Link to="/">
                    Retour à l'accueil
                  </Link></Button>
                <Button asChild className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"><Link to={state === "failed" ? "/donate" : "/projects"}>
                    <Heart className="w-4 h-4 mr-2" />
                    {state === "failed" ? "Réessayer le don" : "Découvrir nos projets"}
                  </Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
