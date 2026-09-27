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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, Project } from "@/api";
import { categoryLabels, formatCFA, projectStatuses } from "./format";
import ProjectFormDialog from "./ProjectFormDialog";

function ProjectBadges({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {project.status === "paused" && (
        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-xs">
          En pause · masqué du site
        </Badge>
      )}
      {project.status === "completed" && (
        <Badge variant="outline" className="text-[#1A1A2E] border-gray-300 bg-gray-50 text-xs">
          Terminé
        </Badge>
      )}
      {project.is_featured && (
        <Badge variant="outline" className="text-[#0D7C66] border-[#0D7C66]/30 text-xs">
          Mis en avant
        </Badge>
      )}
      {project.urgent && (
        <Badge variant="outline" className="text-red-600 border-red-200 text-xs">
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
        <span className="font-semibold text-[#1A1A2E]">{formatCFA(project.raised)}</span>
        <span className="text-[#6B7280]">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#0D7C66] rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <p className="text-xs text-[#6B7280] mt-1 tabular-nums">
        sur {formatCFA(project.goal)} · {donors} donateur{donors > 1 ? "s" : ""}
      </p>
    </div>
  );
}

interface ProjectActionsProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

function ProjectActions({ project, onEdit, onDelete }: ProjectActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => onEdit(project)} aria-label="Modifier">
        <Pencil className="w-4 h-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <AlertDialogAction onClick={() => onDelete(project)} className="bg-red-600 hover:bg-red-700">
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
}

export default function ProjectsTab({ projects, onChange }: ProjectsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

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
      toast.success("Projet supprimé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm text-[#6B7280]">
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </p>
          <Button onClick={openCreate} className="bg-[#0D7C66] hover:bg-[#095C4B] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau projet
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="text-center text-[#6B7280] py-12">Aucun projet. Créez le premier !</p>
        ) : (
          <>
            {/* Mobile: one card per project instead of a wide table */}
            <div className="md:hidden space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[#1A1A2E]">{p.title}</p>
                      <p className="text-xs text-[#6B7280]">
                        {[categoryLabels[p.category] ?? p.category, p.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ProjectActions project={p} onEdit={openEdit} onDelete={remove} />
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
                    <TableHead>Projet</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="min-w-48">Collecte</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium text-[#1A1A2E]">{p.title}</p>
                        {p.location && <p className="text-xs text-[#6B7280]">{p.location}</p>}
                        <ProjectBadges project={p} />
                      </TableCell>
                      <TableCell>{categoryLabels[p.category] ?? p.category}</TableCell>
                      <TableCell>
                        <ProjectProgress project={p} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {projectStatuses[p.status ?? ""] ?? p.status ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ProjectActions project={p} onEdit={openEdit} onDelete={remove} />
                      </TableCell>
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
    </Card>
  );
}
