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
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-lg w-full border-0 shadow-xl text-center">
          <CardContent className="p-10">
            {state === "loading" && (
              <div className="py-8">
                <Loader2 className="w-12 h-12 text-[#0D7C66] animate-spin mx-auto mb-4" />
                <p className="text-[#6B7280]">Vérification du paiement…</p>
              </div>
            )}

            {state === "paid" && (
              <>
                <div className="w-20 h-20 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-[#0D7C66]" />
                </div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">Merci pour votre don !</h2>
                <p className="text-[#6B7280] mb-8">
                  Votre don
                  {amount !== null && (
                    <>
                      {" "}de <span className="font-bold text-[#0D7C66]">{formatCFA(amount)}</span>
                    </>
                  )}{" "}
                  a bien été reçu. Un email de confirmation vous sera envoyé si vous avez indiqué votre adresse.
                </p>
              </>
            )}

            {state === "pending" && (
              <>
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">Paiement en cours de confirmation</h2>
                <p className="text-[#6B7280] mb-6">
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
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">Paiement non confirmé</h2>
                <p className="text-sm text-[#6B7280] mb-8">{message}</p>
              </>
            )}

            {state !== "loading" && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Retour à l'accueil
                  </Button>
                </Link>
                <Link to={state === "failed" ? "/donate" : "/projects"}>
                  <Button className="w-full sm:w-auto bg-[#0D7C66] hover:bg-[#095C4B] text-white">
                    <Heart className="w-4 h-4 mr-2" />
                    {state === "failed" ? "Réessayer le don" : "Découvrir nos projets"}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
