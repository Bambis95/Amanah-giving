import { useEffect, useRef, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, KeyRound, Loader2, MailCheck, RotateCw, ShieldCheck, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LoginCodeChallenge } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

const LENGTH = 6;

interface LoginCodeStepProps {
  step: LoginCodeChallenge;
  /** Sign in again with the same email and password: sends a new code */
  onResend: () => Promise<void>;
  onBack: () => void;
}

/** Second sign-in step: the 6-digit code received by email, or shown by the authenticator app */
export default function LoginCodeStep({ step, onResend, onBack }: LoginCodeStepProps) {
  const { loginWithCode } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const app = step.method === "totp";
  // Lost phone: one of the recovery codes given when the app was turned on (e.g. k7m2-p9xq)
  const [recovery, setRecovery] = useState(false);

  // The field is disabled while checking, which drops the focus: give it back for the next try
  useEffect(() => {
    if (!loading && !resending) input.current?.focus();
  }, [loading, resending]);

  const submit = async (value = code) => {
    if ((recovery ? value.trim().length < 8 : value.length !== LENGTH) || loading) return;
    setLoading(true);
    setError(null);
    try {
      const me = await loginWithCode(step.challenge, value);
      toast.success(`Bienvenue${me.name ? `, ${me.name}` : ""} !`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code refusé");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setCode("");
    try {
      await onResend();
      toast.success("Nouveau code envoyé");
    } finally {
      setResending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <div className="flex gap-3 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
        {app ? (
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        {app ? (
          <p>
            {recovery
              ? "Saisissez l'un de vos codes de secours (chacun ne sert qu'une fois)."
              : "Ouvrez Google Authenticator (ou votre application d'authentification) et saisissez le code à 6 chiffres affiché pour SENJAPO."}
          </p>
        ) : (
          <p>
            Un code à 6 chiffres vient d'être envoyé à <span className="font-semibold">{step.email_hint}</span>. Il est
            valable {step.expires_in_minutes} minutes.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {recovery ? (
          <Input
            ref={input}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="ex. k7m2-p9xq"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Code de secours"
            aria-invalid={error ? true : undefined}
            disabled={loading}
            className="h-12 max-w-xs text-center font-mono text-lg tracking-widest"
          />
        ) : (
        <InputOTP
          ref={input}
          maxLength={LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={(value) => {
            setCode(value);
            setError(null);
          }}
          onComplete={(value: string) => submit(value)}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          aria-label="Code de connexion à 6 chiffres"
          aria-invalid={error ? true : undefined}
          disabled={loading}
        >
          <InputOTPGroup>
            {Array.from({ length: LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="h-14 w-11 text-xl font-semibold sm:h-14 sm:w-12" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        )}
        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading || (recovery ? code.trim().length < 8 : code.length !== LENGTH)}
        className="h-12 w-full text-base font-semibold"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        Valider le code
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Changer de compte
        </button>
        {app ? (
          <button
            type="button"
            onClick={() => {
              setRecovery((r) => !r);
              setCode("");
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            {recovery ? <Smartphone className="h-4 w-4" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            {recovery ? "Utiliser l'application" : "Téléphone perdu ? Code de secours"}
          </button>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60"
          >
            {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" aria-hidden="true" />}
            Renvoyer un code
          </button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {app
          ? "Sans téléphone ni code de secours, un administrateur peut retirer la double authentification de votre compte."
          : "Rien reçu ? Regardez dans les courriers indésirables. Ce code protège l'accès aux données des donateurs."}
      </p>
    </form>
  );
}
