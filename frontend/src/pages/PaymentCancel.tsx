import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { XCircle, Heart, ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";

export default function PaymentCancelPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20 px-4 flex items-center justify-center min-h-screen">
        <Card className="max-w-lg w-full shadow-sm text-center">
          <CardContent className="p-10">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {t.cancel.title}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t.cancel.text}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" className="rounded-lg border-primary text-primary"><Link to="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t.donate.backHome}
                </Link></Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"><Link to="/donate">
                  <Heart className="w-4 h-4 mr-2" />
                  {t.cancel.retry}
                </Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}