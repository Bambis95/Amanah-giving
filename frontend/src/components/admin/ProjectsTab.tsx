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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Newspaper, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, Project } from "@/api";
import { categoryLabel, formatCFA, projectStatuses } from "./format";
import ProjectFormDialog from "./ProjectFormDialog";
import NewsDialog from "./NewsDialog";

function ProjectBadges({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {project.status === "paused" && (
        <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-xs">
          En pause · masqué du site
        </Badge>
      )}
      {project.status === "completed" && (
        <Badge variant="outline" className="text-foreground border-border bg-muted/50 text-xs">
          Terminé
        </Badge>
      )}
      {project.is_featured && (
        <Badge variant="outline" className="text-primary border-primary/30 text-xs">
          Mis en avant
        </Badge>
      )}
      {project.urgent && (
        <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
          Urgent
        </Badge>
      )}
    </div>
  );
}

function ProjectProgress({ project }: { project: Project }) {
  const progress = project.goal > 0 ? Math.round((project.raised / project.goal) * 100) : 0;
  const donors = project.donors ?? 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1 tabular-nums">
        <span className="font-semibold text-foreground">{formatCFA(project.raised)}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
        sur {formatCFA(project.goal)} · {donors} donateur{donors > 1 ? "s" : ""}
      </p>
    </div>
  );
}

interface ProjectActionsProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onNews: (project: Project) => void;
}

function ProjectActions({ project, onEdit, onDelete, onNews }: ProjectActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => onNews(project)} aria-label={`Actualités de ${project.title}`} title="Actualités">
        <Newspaper className="w-4 h-4" />
      </Button>
      {/* Printable A4 poster with a QR code straight to this campaign's donation form */}
      {project.status !== "paused" && (
        <Button asChild variant="outline" size="sm" title="Affiche avec QR code">
          <a href={`/affiche/campagne/${project.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Affiche à imprimer de ${project.title}`}>
            <QrCode className="w-4 h-4" />
          </a>
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => onEdit(project)} aria-label="Modifier">
        <Pencil className="w-4 h-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {project.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le projet disparaîtra du site. Les dons déjà reçus sont conservés. Pour le masquer
              temporairement, passez plutôt son statut à « En pause ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(project)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ProjectsTabProps {
  projects: Project[];
  onChange: (projects: Project[]) => void;
  /** Members of the club see the campaigns without editing them */
  readOnly?: boolean;
}

export default function ProjectsTab({ projects, onChange, readOnly = false }: ProjectsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [newsFor, setNewsFor] = useState<Project | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setDialogOpen(true);
  };

  const handleSaved = (saved: Project) => {
    const exists = projects.some((p) => p.id === saved.id);
    onChange(exists ? projects.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...projects]);
  };

  const remove = async (project: Project) => {
    try {
      await adminApi.deleteProject(project.id);
      onChange(projects.filter((p) => p.id !== project.id));
      toast.success("Campagne supprimée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-muted-foreground">
            {projects.length} campagne{projects.length > 1 ? "s" : ""}
          </p>
          {!readOnly && (<Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle campagne
          </Button>)}
        </div>

        {projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucune campagne pour le moment.</p>
        ) : (
          <>
            {/* Mobile: one card per project instead of a wide table */}
            <div className="md:hidden space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[categoryLabel(p.category), p.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {!readOnly && <ProjectActions project={p} onEdit={openEdit} onDelete={remove} onNews={setNewsFor} />}
                  </div>
                  <ProjectBadges project={p} />
                  <div className="mt-3">
                    <ProjectProgress project={p} />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campagne</TableHead>
                    <TableHead>Cause</TableHead>
                    <TableHead className="min-w-48">Collecte</TableHead>
                    <TableHead>Statut</TableHead>
                    {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{p.title}</p>
                        {p.location && <p className="text-xs text-muted-foreground">{p.location}</p>}
                        <ProjectBadges project={p} />
                      </TableCell>
                      <TableCell>{categoryLabel(p.category)}</TableCell>
                      <TableCell>
                        <ProjectProgress project={p} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {projectStatuses[p.status ?? ""] ?? p.status ?? "—"}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <ProjectActions project={p} onEdit={openEdit} onDelete={remove} onNews={setNewsFor} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <ProjectFormDialog
        open={dialogOpen}
        project={editing}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
      <NewsDialog project={newsFor} onOpenChange={(open) => !open && setNewsFor(null)} />
    </Card>
  );
}
