import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Loader2, Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { newsletterApi, NewsletterDraft, NewsletterOverview, Project } from "@/api";
import { formatDate } from "./format";

const NONE = "none";

/** Compose and send the newsletter to people who asked for news (presidents and admins) */
export default function NewsletterTab({ projects }: { projects: Project[] }) {
  const [overview, setOverview] = useState<NewsletterOverview | null>(null);
  const [draft, setDraft] = useState<NewsletterDraft>({ subject: "", body: "", project_id: null });
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = () =>
    newsletterApi
      .overview()
      .then(setOverview)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));

  useEffect(() => {
    load();
  }, []);

  const ready = draft.subject.trim().length >= 3 && draft.body.trim().length >= 10;
  const clean = { ...draft, subject: draft.subject.trim(), body: draft.body.trim() };

  const test = async () => {
    setBusy("test");
    try {
      toast.success((await newsletterApi.test(clean)).message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setConfirm(false);
    setBusy("send");
    try {
      toast.success((await newsletterApi.send(clean)).message);
      setDraft({ subject: "", body: "", project_id: null });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setBusy(null);
    }
  };

  if (!overview) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="shadow-sm"><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Abonnés</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{overview.active}</p>
          <p className="text-xs text-muted-foreground">{overview.by_source.donation ?? 0} via un don · {overview.by_source.notify ?? 0} via « Être informé »</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Désabonnés</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{overview.unsubscribed}</p>
        </CardContent></Card>
        <Card className="col-span-2 shadow-sm sm:col-span-1"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Envois réalisés</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{overview.issues.length}</p>
        </CardContent></Card>
      </div>

      {!overview.email_enabled && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          L'envoi d'emails n'est pas configuré sur le serveur (réglages SMTP dans Render) : la newsletter ne peut pas partir.
        </p>
      )}

      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-foreground"><Mail className="h-4 w-4 text-primary" />Nouvel envoi</h3>
          <div className="space-y-2">
            <Label htmlFor="nl-subject">Objet *</Label>
            <Input id="nl-subject" maxLength={150} placeholder="Ex. : Les premières tables sont arrivées à Touba" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nl-body">Message *</Label>
            <Textarea id="nl-body" rows={8} maxLength={5000} placeholder="Racontez ce que les dons ont permis, et ce qui vient. Laissez une ligne vide entre deux paragraphes." value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <p className="text-xs text-muted-foreground">« Bonjour Prénom, » est ajouté au début, et un lien de désabonnement à la fin.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nl-project">Bouton vers une campagne</Label>
            <Select value={draft.project_id ? String(draft.project_id) : NONE} onValueChange={(v) => setDraft({ ...draft, project_id: v === NONE ? null : Number(v) })}>
              <SelectTrigger id="nl-project" className="sm:max-w-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Aucun bouton</SelectItem>
                {projects.filter((p) => p.status !== "paused").map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={test} disabled={!ready || busy !== null || !overview.email_enabled}>
              {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              M'envoyer un test
            </Button>
            <Button type="button" onClick={() => setConfirm(true)} disabled={!ready || busy !== null || overview.active === 0 || !overview.email_enabled}>
              {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Envoyer à {overview.active} abonné{overview.active > 1 ? "s" : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {overview.issues.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4 md:p-6">
            <h3 className="mb-3 font-semibold text-foreground">Historique</h3>
            <ul className="divide-y divide-border text-sm">
              {overview.issues.map((i) => (
                <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <span className="font-medium text-foreground">{i.subject}</span>
                  <span className="text-muted-foreground">{formatDate(i.sent_at)} · {i.recipients} destinataire{i.recipients > 1 ? "s" : ""}{i.sent_by && ` · ${i.sent_by}`}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer « {draft.subject.trim()} » à {overview.active} abonné{overview.active > 1 ? "s" : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>L'envoi ne peut pas être annulé. Envoyez-vous d'abord un test si ce n'est pas fait.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Envoyer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
