import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, Loader2, MailX } from "lucide-react";
import { unsubscribeNewsletter } from "@/api";

/** One-click unsubscribe (link at the bottom of every newsletter) */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "done" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    unsubscribeNewsletter(token)
      .then((m) => {
        setMessage(m);
        setState("done");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex justify-center px-4 pb-20 pt-32">
        <Card className="w-full max-w-md text-center shadow-sm">
          <CardContent className="p-8">
            {state === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-label="Désabonnement en cours" />}
            {state === "done" && (
              <>
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" aria-hidden="true" />
                <h1 className="mb-2 text-xl font-bold text-foreground">Désabonnement confirmé</h1>
                <p className="mb-6 text-muted-foreground">{message}</p>
              </>
            )}
            {state === "error" && (
              <>
                <MailX className="mx-auto mb-4 h-12 w-12 text-destructive" aria-hidden="true" />
                <h1 className="mb-2 text-xl font-bold text-foreground">Lien incomplet</h1>
                <p className="mb-6 text-muted-foreground">Utilisez le lien « Se désabonner » en bas d'un email de SENJAPO, ou contactez-nous.</p>
              </>
            )}
            {state !== "loading" && (
              <Button asChild variant="outline">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
