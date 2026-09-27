import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-[#E8F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-[#0D7C66]" />
        </div>
        <h1 className="text-6xl font-bold text-[#1A1A2E] mb-4">404</h1>
        <h2 className="text-xl font-semibold text-[#374151] mb-3">Page Non Trouvée</h2>
        <p className="text-[#6B7280] mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button className="bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg px-6">
              <Home className="w-4 h-4 mr-2" />
              Retour à l'Accueil
            </Button>
          </Link>
          <Link to="/donate">
            <Button variant="outline" className="rounded-lg border-[#0D7C66] text-[#0D7C66] px-6">
              <Heart className="w-4 h-4 mr-2" />
              Faire un Don
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}