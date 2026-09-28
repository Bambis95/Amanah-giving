import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, Project, ProjectInput } from "@/api";
import { projectStatuses } from "./format";
import { CATEGORIES, categoryLabel, iconNameFor } from "@/lib/categories";
import { regionOf } from "@/lib/regions";

const emptyForm = {
  title: "",
  description: "",
  category: "agriculture",
  image: "",
  location: "",
  goal: "",
  raised: "0",
  donors: "0",
  status: "active",
  urgent: false,
  is_featured: false,
};

type FormState = typeof emptyForm;

function toForm(project: Project): FormState {
  return {
    title: project.title,
    description: project.description,
    category: project.category,
    image: project.image ?? "",
    location: project.location ?? "",
    goal: String(project.goal),
    raised: String(project.raised),
    donors: String(project.donors ?? 0),
    status: project.status ?? "active",
    urgent: !!project.urgent,
    is_featured: !!project.is_featured,
  };
}

interface ProjectFormDialogProps {
  open: boolean;
  project: Project | null; // null = creation
  onOpenChange: (open: boolean) => void;
  onSaved: (project: Project) => void;
}

export default function ProjectFormDialog({ open, project, onOpenChange, onSaved }: ProjectFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(project ? toForm(project) : emptyForm);
  }, [open, project]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const goal = parseInt(form.goal, 10);
    const raised = parseInt(form.raised || "0", 10);
    const donors = parseInt(form.donors || "0", 10);
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Le titre et la description sont obligatoires");
      return;
    }
    if (!(goal > 0) || raised < 0 || donors < 0) {
      toast.error("L'objectif doit être positif et les montants ne peuvent pas être négatifs");
      return;
    }

    const data: ProjectInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      // The public pages pick the card icon from this field
      icon: iconNameFor(form.category),
      image: form.image.trim() || null,
      location: form.location.trim() || null,
      goal,
      raised,
      donors,
      status: form.status,
      urgent: form.urgent,
      is_featured: form.is_featured,
    };

    setSaving(true);
    try {
      // The API ignores null on update, so send "" to clear an optional text field
      const saved = project
        ? await adminApi.updateProject(project.id, {
            ...data,
            image: data.image ?? "",
            location: data.location ?? "",
          })
        : await adminApi.createProject(data);
      onSaved(saved);
      toast.success(project ? "Projet mis à jour" : "Projet créé");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
          <DialogDescription>
            Les modifications sont visibles immédiatement sur la page « Nos Projets ».
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">Titre *</Label>
            <Input id="project-title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description *</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                  {/* A project in a category no longer offered keeps it until changed */}
                  {!CATEGORIES.some((c) => c.value === form.category) && (
                    <SelectItem value={form.category}>{categoryLabel(form.category)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(projectStatuses).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.status === "paused"
                  ? "Masqué du site public."
                  : form.status === "completed"
                    ? "Visible sur le site, dons désactivés."
                    : "Visible sur le site, ouvert aux dons."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-location">Lieu</Label>
              <Input
                id="project-location"
                placeholder="Ex. : Thiès, Sénégal"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                aria-describedby="project-location-hint"
              />
              {/* The public "projects by region" grid reads the region from this text */}
              <p id="project-location-hint" className="text-xs text-muted-foreground">
                {regionOf(form.location)
                  ? `Classé dans la région : ${regionOf(form.location)}`
                  : "Indiquez la région (ex. : Thiès) pour classer le projet par région."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-image">URL de l'image</Label>
              <Input
                id="project-image"
                type="url"
                placeholder="https://…"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-goal">Objectif (FCFA) *</Label>
              <Input
                id="project-goal"
                type="number"
                min={1}
                value={form.goal}
                onChange={(e) => set("goal", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-raised">Collecté (FCFA)</Label>
              <Input
                id="project-raised"
                type="number"
                min={0}
                value={form.raised}
                onChange={(e) => set("raised", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-donors">Donateurs</Label>
              <Input
                id="project-donors"
                type="number"
                min={0}
                value={form.donors}
                onChange={(e) => set("donors", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 pt-1">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.is_featured} onCheckedChange={(v) => set("is_featured", v)} />
              Mis en avant sur l'accueil
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.urgent} onCheckedChange={(v) => set("urgent", v)} />
              Urgent
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {project ? "Enregistrer" : "Créer le projet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
