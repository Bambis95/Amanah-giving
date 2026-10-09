import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import PasswordField from "@/components/PasswordField";
import { Copy, Download, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { twoFactorApi, TwoFactorStatus } from "@/api";

type Mode = "idle" | "scan" | "codes" | "disable" | "renew";

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <InputOTP id={id} maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={value} onChange={onChange} inputMode="numeric" autoComplete="one-time-code" aria-label="Code à 6 chiffres de l'application">
      <InputOTPGroup>
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTPSlot key={i} index={i} className="h-12 w-10 text-lg font-semibold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** "Mon espace": turn on the authenticator app (Google Authenticator...) by scanning a QR code */
export default function TwoFactorCard({ email }: { email: string }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => twoFactorApi.status().then(setStatus).catch(() => setStatus(null));
  useEffect(() => {
    load();
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      setSetup(await twoFactorApi.setup());
      setCode("");
      setMode("scan");
    });

  const confirm = () =>
    run(async () => {
      const r = await twoFactorApi.enable(code);
      setCodes(r.recovery_codes);
      setMode("codes");
      setSetup(null);
      toast.success("Double authentification activée");
      load();
    });

  const renew = () =>
    run(async () => {
      const r = await twoFactorApi.newRecoveryCodes(code);
      setCodes(r.recovery_codes);
      setMode("codes");
      load();
    });

  const disable = () =>
    run(async () => {
      setStatus(await twoFactorApi.disable(password, code));
      setMode("idle");
      setPassword("");
      setCode("");
      toast.success("Double authentification désactivée");
    });

  const codesText = `Codes de secours SENJAPO (${email})\nChaque code ne sert qu'une fois. Gardez-les hors de votre téléphone.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([codesText], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "senjapo-codes-de-secours.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!status) return null;

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
              Double authentification
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              À chaque connexion, en plus du mot de passe, un code à 6 chiffres de Google Authenticator (ou Microsoft
              Authenticator, Authy…). Un mot de passe volé ne suffit plus.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {status.enabled ? "Activée" : "Désactivée"}
          </span>
        </div>

        {mode === "idle" && !status.enabled && (
          <Button onClick={start} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Activer avec Google Authenticator
          </Button>
        )}

        {mode === "idle" && status.enabled && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Codes de secours restants : <span className="font-semibold text-foreground">{status.recovery_left}</span> sur 8.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { setCode(""); setMode("renew"); }}>Nouveaux codes de secours</Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setCode(""); setMode("disable"); }}>
                <ShieldOff className="mr-2 h-4 w-4" />
                Désactiver
              </Button>
            </div>
          </div>
        )}

        {mode === "scan" && setup && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/90">
              <li>Installez <b>Google Authenticator</b> sur votre téléphone (Play Store ou App Store).</li>
              <li>Dans l'application, touchez <b>+</b> puis <b>Scanner un code QR</b>, et scannez ce code :</li>
            </ol>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                <QRCodeSVG value={setup.otpauth_uri} size={176} level="M" marginSize={0} title="QR code à scanner avec Google Authenticator" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Impossible de scanner ? Choisissez « Saisir une clé » et tapez :
                <br />
                <span className="select-all break-all font-mono text-sm text-foreground">{setup.secret}</span>
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-foreground/90">3. Saisissez le code à 6 chiffres affiché par l'application :</p>
              <CodeInput id="tfa-confirm" value={code} onChange={setCode} />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer et activer
              </Button>
              <Button variant="ghost" onClick={() => { setMode("idle"); setSetup(null); }}>Annuler</Button>
            </div>
          </div>
        )}

        {mode === "codes" && (
          <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-foreground">Vos codes de secours : notez-les maintenant, ils ne seront plus affichés.</p>
            <p className="text-sm text-muted-foreground">
              Si vous perdez votre téléphone, chacun de ces codes remplace une fois le code de l'application. Gardez-les sur
              papier ou dans un endroit sûr, pas dans le téléphone.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-base sm:grid-cols-4">
              {codes.map((c) => <li key={c} className="rounded bg-background px-2 py-1 text-center">{c}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Télécharger</Button>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(codesText).then(() => toast.success("Codes copiés"))}><Copy className="mr-2 h-4 w-4" />Copier</Button>
              <Button onClick={() => { setCodes([]); setMode("idle"); }}>C'est noté</Button>
            </div>
          </div>
        )}

        {mode === "renew" && (
          <div className="space-y-3">
            <p className="text-sm text-foreground/90">Code actuel de l'application (les anciens codes de secours cesseront de fonctionner) :</p>
            <CodeInput id="tfa-renew" value={code} onChange={setCode} />
            <div className="flex gap-2">
              <Button onClick={renew} disabled={busy || code.length !== 6}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Générer</Button>
              <Button variant="ghost" onClick={() => setMode("idle")}>Annuler</Button>
            </div>
          </div>
        )}

        {mode === "disable" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); disable(); }}>
            <PasswordField id="tfa-password" label="Mot de passe" value={password} onChange={setPassword} autoComplete="current-password" />
            <div className="space-y-2">
              <p className="text-sm text-foreground/90">Code de l'application :</p>
              <CodeInput id="tfa-disable" value={code} onChange={setCode} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={busy || !password || code.length !== 6}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Désactiver
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Annuler</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
