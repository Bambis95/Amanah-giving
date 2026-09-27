import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
        <h2 className="text-xl font-semibold text-foreground/80 mb-3">Page Non Trouvée</h2>
        <p className="text-muted-foreground mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6"><Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Retour à l'Accueil
            </Link></Button>
          <Button asChild variant="outline" className="rounded-lg border-primary text-primary px-6"><Link to="/donate">
              <Heart className="w-4 h-4 mr-2" />
              Faire un Don
            </Link></Button>
        </div>
      </div>
    </div>
  );
}