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
import { formatDate } from "./format";

const subjectLabels: Record<string, string> = {
  general: "Question générale",
  donation: "Question sur un don",
  project: "Proposer un projet",
  partnership: "Partenariat",
  volunteer: "Bénévolat",
  other: "Autre",
};

interface MessagesTabProps {
  messages: ContactMessage[];
  onChange: (messages: ContactMessage[]) => void;
}

export default function MessagesTab({ messages, onChange }: MessagesTabProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const visible = unreadOnly ? messages.filter((m) => !m.is_read) : messages;
  const unreadCount = messages.filter((m) => !m.is_read).length;

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
      <div className="flex gap-2">
        <Button
          variant={unreadOnly ? "outline" : "default"}
          size="sm"
          onClick={() => setUnreadOnly(false)}
          className={unreadOnly ? "" : "bg-[#0D7C66] hover:bg-[#095C4B]"}
        >
          Tous ({messages.length})
        </Button>
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly(true)}
          className={unreadOnly ? "bg-[#0D7C66] hover:bg-[#095C4B]" : ""}
        >
          Non lus ({unreadCount})
        </Button>
      </div>

      {visible.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center text-[#6B7280]">
            {unreadOnly ? "Aucun message non lu." : "Aucun message pour le moment."}
          </CardContent>
        </Card>
      )}

      {visible.map((m) => (
        <Card key={m.id} className={`border-0 shadow-md ${m.is_read ? "" : "ring-1 ring-[#0D7C66]/30"}`}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[#1A1A2E]">{m.name}</h3>
                  {!m.is_read && (
                    <Badge className="bg-[#E8F5F0] text-[#0D7C66] border-0 hover:bg-[#E8F5F0]">Nouveau</Badge>
                  )}
                  {m.subject && (
                    <Badge variant="outline" className="text-[#374151]">
                      {subjectLabels[m.subject] ?? m.subject}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#6B7280]">
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1 hover:text-[#0D7C66]">
                    <Mail className="w-3.5 h-3.5" />
                    {m.email}
                  </a>
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-[#0D7C66]">
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                      <AlertDialogAction onClick={() => remove(m)} className="bg-red-600 hover:bg-red-700">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <p className="text-sm text-[#374151] whitespace-pre-line leading-relaxed">{m.message}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
