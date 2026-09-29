import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH, passwordScore } from "@/lib/password";

const LEVELS = [
  { label: "Trop court", color: "bg-destructive", text: "text-destructive" },
  { label: "Faible", color: "bg-destructive", text: "text-destructive" },
  { label: "Moyen", color: "bg-highlight", text: "text-warning" },
  { label: "Bon", color: "bg-success", text: "text-success" },
  { label: "Excellent", color: "bg-success", text: "text-success" },
];

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** Strength bar under the field (new passwords) */
  showStrength?: boolean;
  /** Content aligned right of the label (e.g. "Mot de passe oublié ?") */
  labelAside?: React.ReactNode;
  error?: string | null;
}

export default function PasswordField({
  id, label, value, onChange, autoComplete, showStrength, labelAside, error,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value);
  const level = LEVELS[score];
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 pr-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={showStrength || error ? hintId : undefined}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={hintId} className="text-xs text-destructive">{error}</p>
      ) : (
        showStrength && (
          <div id={hintId} aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", value && score >= i && level.color)}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {value ? (
                <>
                  Solidité : <span className={cn("font-medium", level.text)}>{level.label}</span>
                  {score < 3 && " · mélangez majuscules, chiffres et symboles"}
                </>
              ) : (
                `Au moins ${MIN_PASSWORD_LENGTH} caractères.`
              )}
            </p>
          </div>
        )
      )}
    </div>
  );
}
