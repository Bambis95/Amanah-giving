import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, XCircle, ArrowLeft, Heart, Loader2 } from "lucide-react";
import { api } from "@/api";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    async function verifyPayment() {
      if (!sessionId) {
        setError("Session de paiement manquante");
        setLoading(false);
        return;
      }
      try {
        const result = await api.verifyPayment(sessionId);
        if (result.payment_status === "paid") {
          setVerified(true);
          // Si tu es en USD: result.amount / 100
          // Si tu es en XOF: result.amount direct
          setAmount(result.amount / 100);
        } else {
          setError("Paiement non confirmé");
        }
      } catch (e) {
        setError("Échec de vérification du paiement");
      } finally {
        setLoading(false);
      }
    }
    verifyPayment();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-lg w-full border-0 shadow-xl text-center">
          <CardContent className="p-10">
            {loading? (
              <div className="py-8">
                <Loader2 className="w-12 h-12 text-[#0D7C66] animate-spin mx-auto mb-4" />
                <p className="text-[#6B7280]">Vérification du paiement...</p>
              </div>
            ) : error? (
              <>
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Paiement échoué</h2>
                <p className="text-sm text-[#6B7280] mb-8">{error}</p>
              </>
            ) : verified? (
              <>
                <div className="w-20 h-20 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-[#0D7C66]" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Paiement Confirmé!</h2>
                <p className="text-[#6B7280] mb-8">
                  Votre don de <span className="font-bold text-[#0D7C66]">{amount!== null? formatCFA(amount) : ""}</span> a été traité.
                </p>
              </>
            ) : null}
            {/*... tes boutons avec asChild */}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}