import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Loader2, MailCheck, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { adminApi, Invitation, InvitationCreated, StaffRole } from "@/api";
import { BRAND_NAME } from "@/lib/brand";
import { assignableRoles, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Role of the person inviting: a president invites members only */
  currentRole: string;
  onInvited: (invitation: Invitation) => void;
}

export default function InviteDialog({ open, onOpenChange, currentRole, onInvited }: InviteDialogProps) {
  const roles = assignableRoles(currentRole).filter((r): r is StaffRole => r !== "user");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>(roles[0]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<InvitationCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setRole(roles[0]);
    setCreated(null);
    setCopied(false);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200); // after the closing animation
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await adminApi.createInvitation({ email: email.trim(), name: name.trim() || undefined, role });
      setCreated(result);
      onInvited(result.invitation);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'invitation a échoué");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.invite_url);
      setCopied(true);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible : sélectionnez le lien à la main");
    }
  };

  const whatsappText = created
    ? `Bonjour${created.invitation.name ? ` ${created.invitation.name}` : ""}, voici votre invitation à rejoindre l'équipe ${BRAND_NAME} (${ROLE_LABELS[created.invitation.role].toLowerCase()}). Ouvrez ce lien pour choisir votre mot de passe (valable 48 h) : ${created.invite_url}`
    : "";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <MailCheck className="h-6 w-6 text-success" aria-hidden="true" />
              </div>
              <DialogTitle>Invitation créée</DialogTitle>
              <DialogDescription>
                {created.email_sent
                  ? `Un email vient d'être envoyé à ${created.invitation.email}. Vous pouvez aussi lui transmettre le lien par WhatsApp.`
                  : `L'envoi d'emails n'est pas configuré : transmettez ce lien à ${created.invitation.email}, par exemple par WhatsApp.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-link">Lien d'invitation (valable 48 h, un seul usage)</Label>
              <div className="flex gap-2">
                <Input id="invite-link" value={created.invite_url} readOnly onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copy} aria-label="Copier le lien">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ne l'envoyez qu'à cette personne : ce lien donne accès au tableau de bord.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button asChild variant="outline">
                <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Envoyer par WhatsApp
                </a>
              </Button>
              <Button onClick={() => close(false)}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Inviter une personne dans l'équipe</DialogTitle>
              <DialogDescription>
                Elle recevra un lien pour choisir son mot de passe et arrivera directement avec le rôle choisi.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email-field">Email *</Label>
                <Input
                  id="invite-email-field"
                  type="email"
                  inputMode="email"
                  placeholder="prenom.nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name-field">Nom complet</Label>
                <Input id="invite-name-field" placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role-field">Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                  <SelectTrigger id="invite-role-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !email.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
