import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { XCircle, Heart, ArrowLeft } from "lucide-react";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-lg w-full border-0 shadow-xl text-center">
          <CardContent className="p-10">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">
              Paiement Annulé
            </h2>
            <p className="text-[#6B7280] mb-8">
              Votre paiement a été annulé. Aucun montant n'a été débité de votre compte.
              Vous pouvez réessayer à tout moment.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/">
                <Button variant="outline" className="rounded-lg border-[#0D7C66] text-[#0D7C66]">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à l'Accueil
                </Button>
              </Link>
              <Link to="/donate">
                <Button className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg">
                  <Heart className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}