import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronRight, Heart, Users } from "lucide-react";
import { Project } from "@/api";
import { iconByName } from "@/lib/categories";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

export default function ProjectCard({ project }: { project: Project }) {
  const progress = project.goal > 0 ? Math.round((project.raised / project.goal) * 100) : 0;
  const IconComponent = iconByName(project.icon);
  const completed = project.status === "completed";

  return (
    <Card className="group flex flex-col overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md motion-safe:hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden">
        {project.image ? (
          <img
            src={project.image}
            alt={project.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-accent/40">
            <IconComponent className="h-14 w-14 text-primary/40" aria-hidden="true" />
          </div>
        )}
        {/* Chips over the photo use the theme background, so they stay readable in both modes */}
        <div className="absolute left-4 top-4 flex gap-2">
          <div className="rounded-lg bg-background/90 p-2 shadow-sm backdrop-blur-sm">
            <IconComponent className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          {completed ? (
            <Badge className="gap-1 border-0 bg-foreground text-xs text-background hover:bg-foreground">
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              Terminé
            </Badge>
          ) : (
            project.urgent && (
              <Badge className="border-0 bg-destructive text-xs text-destructive-foreground hover:bg-destructive">Urgent</Badge>
            )
          )}
        </div>
        {project.location && (
          <div className="absolute bottom-4 right-4">
            <Badge variant="secondary" className="bg-background/90 text-xs text-foreground/80 backdrop-blur-sm">
              {project.location}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {project.title}
        </h3>
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{project.description}</p>

        {/* Progress (mt-auto keeps buttons aligned across cards of different text length) */}
        <div className="mb-4 mt-auto">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold tabular-nums text-primary">{formatCFA(project.raised)} FCFA</span>
            <span className="tabular-nums text-muted-foreground">{progress}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(progress, 100)}
            aria-label={`Collecte : ${progress} % de l'objectif`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">Objectif: {formatCFA(project.goal)} FCFA</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {project.donors || 0}
            </span>
          </div>
        </div>

        {completed ? (
          <Button disabled variant="outline" className="h-11 w-full font-semibold">
            <CheckCircle className="mr-2 h-4 w-4" />
            Projet terminé
          </Button>
        ) : (
          <Button asChild className="h-11 w-full font-semibold">
            <Link to={`/donate?project=${project.id}`} aria-label={`Contribuer au projet ${project.title}`}>
              <Heart className="mr-2 h-4 w-4" />
              Contribuer
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
