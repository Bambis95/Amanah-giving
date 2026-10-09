import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { financeApi, FinanceComment, FinanceEntry } from "@/api";
import { formatDate } from "../format";

interface CommentsDialogProps {
  entry: FinanceEntry | null;
  /** Treasurer, accountant and admins write; the president reads */
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onCommented: (entryId: number) => void;
}

/** Discussion about one entry between the treasurer and the accountant ("the receipt is blurry...") */
export default function CommentsDialog({ entry, canWrite, onOpenChange, onCommented }: CommentsDialogProps) {
  const [comments, setComments] = useState<FinanceComment[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setComments(null);
    setBody("");
    financeApi
      .comments(entry.id)
      .then(setComments)
      .catch(() => setComments([]));
  }, [entry]);

  const send = async () => {
    if (!entry || !body.trim()) return;
    setSending(true);
    try {
      const comment = await financeApi.addComment(entry.id, body.trim());
      setComments((list) => [...(list ?? []), comment]);
      setBody("");
      onCommented(entry.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Commentaires · {entry?.label}</DialogTitle>
          <DialogDescription>Visibles par l'équipe des finances et le président. Les autres sont prévenus par email.</DialogDescription>
        </DialogHeader>
        {comments === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
        ) : (
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="text-xs text-muted-foreground">{c.author_name} · {formatDate(c.created_at)}</p>
                <p className="mt-1 whitespace-pre-line text-foreground">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <div className="space-y-2">
            <Textarea
              aria-label="Votre commentaire"
              placeholder="Ex. : le reçu est flou, peux-tu le renvoyer ?"
              value={body}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button onClick={send} disabled={sending || !body.trim()} className="w-full">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Envoyer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
