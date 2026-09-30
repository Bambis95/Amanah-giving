import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CampaignNews, newsApi, Project } from "@/api";
import ImageUploadField from "./ImageUploadField";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const empty = { title: "", body: "", image: "" };

interface NewsDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
}

/** News of one campaign: publish, edit, delete (shown on the campaign and on the home page) */
export default function NewsDialog({ project, onOpenChange }: NewsDialogProps) {
  const [items, setItems] = useState<CampaignNews[] | null>(null);
  const [editing, setEditing] = useState<CampaignNews | null>(null);
  const [form, setForm] = useState(empty);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setItems(null);
    setFormOpen(false);
    newsApi
      .list(project.id)
      .then(setItems)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, [project]);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setFormOpen(true);
  };

  const startEdit = (item: CampaignNews) => {
    setEditing(item);
    setForm({ title: item.title, body: item.body, image: item.image ?? "" });
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (form.title.trim().length < 3 || form.body.trim().length < 3) {
      toast.error("Un titre et un texte sont nécessaires");
      return;
    }
    setSaving(true);
    try {
      const data = { title: form.title.trim(), body: form.body.trim(), image: form.image.trim() || null };
      const saved = editing ? await newsApi.update(editing.id, data) : await newsApi.create(project.id, data);
      setItems((list) => (editing ? (list ?? []).map((n) => (n.id === saved.id ? saved : n)) : [saved, ...(list ?? [])]));
      toast.success(editing ? "Actualité modifiée" : "Actualité publiée");
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publication impossible");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: CampaignNews) => {
    if (!window.confirm(`Supprimer l'actualité « ${item.title} » ?`)) return;
    try {
      await newsApi.remove(item.id);
      setItems((list) => (list ?? []).filter((n) => n.id !== item.id));
      toast.success("Actualité supprimée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  };

  return (
    <Dialog open={project !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actualités · {project?.title}</DialogTitle>
          <DialogDescription>
            Racontez l'avancement aux donateurs : elles s'affichent sur la campagne et sur la page d'accueil.
          </DialogDescription>
        </DialogHeader>

        {formOpen ? (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">Titre *</Label>
              <Input id="news-title" maxLength={150} placeholder="Ex. : Les fondations du bâtiment A sont posées" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-body">Texte *</Label>
              <Textarea id="news-body" rows={5} maxLength={3000} placeholder="Ce qui a été fait, grâce à qui, et la prochaine étape." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </div>
            <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {editing ? "Enregistrer" : "Publier"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <Button onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle actualité
            </Button>
            {items === null ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune actualité pour cette campagne.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id} className="flex gap-3 py-3">
                    {n.image && <img src={n.image} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{dateFormat.format(new Date(n.published_at))}</p>
                      <p className="font-medium text-foreground">{n.title}</p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(n)} aria-label={`Modifier ${n.title}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(n)} aria-label={`Supprimer ${n.title}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
