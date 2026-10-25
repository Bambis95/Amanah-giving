import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useInstallApp } from "@/lib/pwa";
import { cn } from "@/lib/utils";

/** "Installer l'application": the browser's install on Android, Safari's steps on iPhone, hidden once installed */
export default function InstallAppButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const { mode, install } = useInstallApp();
  const [steps, setSteps] = useState(false);
  if (!mode) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("h-10 gap-2", className)}
        onClick={() => (mode === "prompt" ? install() : setSteps(true))}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t.install.button}
      </Button>
      <Dialog open={steps} onOpenChange={setSteps}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.install.iosTitle}</DialogTitle>
            <DialogDescription>{t.install.iosIntro}</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 ps-5 text-sm text-foreground">
            <li>{t.install.iosStep1}</li>
            <li>{t.install.iosStep2}</li>
            <li>{t.install.iosStep3}</li>
          </ol>
          <DialogFooter>
            <Button type="button" onClick={() => setSteps(false)}>
              {t.install.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
