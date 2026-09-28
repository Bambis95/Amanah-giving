import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Mail, MailOpen, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, ContactMessage } from "@/api";
import { cn } from "@/lib/utils";
import { formatDate, MESSAGE_KINDS } from "./format";

const subjectLabels: Record<string, string> = {
  membership: "Adhésion au club",
  join: "Proposition de campagne",
  notify: "Être tenu informé",
  general: "Question générale",
  donation: "Question sur un don",
  project: "Proposer un projet",
  partnership: "Partenariat",
  volunteer: "Bénévolat",
  other: "Autre",
};

const KNOWN = MESSAGE_KINDS.flatMap((k) => k.subjects);

interface MessagesTabProps {
  messages: ContactMessage[];
  onChange: (messages: ContactMessage[]) => void;
  /** Open on one request type (from the dashboard overview) */
  initialKind?: string;
}

export default function MessagesTab({ messages, onChange, initialKind = "all" }: MessagesTabProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [kind, setKind] = useState(initialKind);
  const [busyId, setBusyId] = useState<number | null>(null);

  const ofKind = (k: string) =>
    k === "all"
      ? messages
      : k === "other"
        ? messages.filter((m) => !KNOWN.includes(m.subject ?? ""))
        : messages.filter((m) => MESSAGE_KINDS.find((x) => x.id === k)?.subjects.includes(m.subject ?? ""));
  const byKind = ofKind(kind);
  const visible = unreadOnly ? byKind.filter((m) => !m.is_read) : byKind;
  const unreadCount = byKind.filter((m) => !m.is_read).length;
  const kinds = [
    { id: "all", label: "Tout" },
    ...MESSAGE_KINDS,
    { id: "other", label: "Autres messages" },
  ].map((k) => ({ ...k, unread: ofKind(k.id).filter((m) => !m.is_read).length }));

  const toggleRead = async (message: ContactMessage) => {
    setBusyId(message.id);
    try {
      const updated = await adminApi.setMessageRead(message.id, !message.is_read);
      onChange(messages.map((m) => (m.id === updated.id ? updated : m)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (message: ContactMessage) => {
    setBusyId(message.id);
    try {
      await adminApi.deleteContactMessage(message.id);
      onChange(messages.filter((m) => m.id !== message.id));
      toast.success("Message supprimé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Type de demande">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors",
              kind === k.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:text-foreground"
            )}
          >
            {k.label}
            {k.unread > 0 && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", kind === k.id ? "bg-white/25" : "bg-highlight text-highlight-foreground")}>
                {k.unread}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant={unreadOnly ? "outline" : "default"}
          size="sm"
          onClick={() => setUnreadOnly(false)}
          className={unreadOnly ? "" : "bg-primary hover:bg-primary/90"}
        >
          Tous ({byKind.length})
        </Button>
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly(true)}
          className={unreadOnly ? "bg-primary hover:bg-primary/90" : ""}
        >
          Non lus ({unreadCount})
        </Button>
      </div>

      {visible.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            {unreadOnly ? "Aucun message non lu." : "Aucun message pour le moment."}
          </CardContent>
        </Card>
      )}

      {visible.map((m) => (
        <Card key={m.id} className={`border-0 shadow-md ${m.is_read ? "" : "ring-1 ring-primary/30"}`}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{m.name}</h3>
                  {!m.is_read && (
                    <Badge className="bg-accent text-primary border-0 hover:bg-accent">Nouveau</Badge>
                  )}
                  {m.subject && (
                    <Badge variant="outline" className="text-foreground/80">
                      {subjectLabels[m.subject] ?? m.subject}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                  {/* "Keep me informed" requests may come with a phone number only */}
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="flex items-center gap-1 hover:text-primary">
                      <Mail className="w-3.5 h-3.5" />
                      {m.email}
                    </a>
                  )}
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-primary">
                      <Phone className="w-3.5 h-3.5" />
                      {m.phone}
                    </a>
                  )}
                  <span>{formatDate(m.created_at)}</span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" disabled={busyId === m.id} onClick={() => toggleRead(m)}>
                  {m.is_read ? <Mail className="w-4 h-4 mr-1.5" /> : <MailOpen className="w-4 h-4 mr-1.5" />}
                  {m.is_read ? "Marquer non lu" : "Marquer lu"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === m.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      aria-label="Supprimer le message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le message de {m.name} sera définitivement supprimé.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(m)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{m.message}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
