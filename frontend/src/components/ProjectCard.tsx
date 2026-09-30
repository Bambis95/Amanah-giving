import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { CheckCircle, ChevronRight, Heart, Images, MessageCircle, Users } from "lucide-react";
import { Project } from "@/api";
import CampaignNewsList from "./CampaignNewsList";
import ShareCampaign from "./ShareCampaign";
import { whatsappLink } from "@/lib/share";
import { iconByName } from "@/lib/categories";

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

/** `autoOpen`: open the campaign's dialog at once (shared link /projects?campagne=ID) */
export default function ProjectCard({ project, autoOpen = false }: { project: Project; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const progress = project.goal > 0 ? Math.round((project.raised / project.goal) * 100) : 0;
  const IconComponent = iconByName(project.icon);
  const completed = project.status === "completed";
  // Rough threshold for text that overflows three lines of the card
  const longDescription = project.description.length > 160 || project.description.includes("\n");
  const gallery = project.gallery ?? [];
  const photos = [project.image, ...gallery].filter((url): url is string => !!url);

  return (
    <Card id={`campagne-${project.id}`} className="group flex scroll-mt-24 flex-col overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md motion-safe:hover:-translate-y-1">
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
        {gallery.length > 0 && (
          <div className="absolute bottom-4 left-4">
            <Badge variant="secondary" className="gap-1 bg-background/90 text-xs text-foreground/80 backdrop-blur-sm">
              <Images className="h-3 w-3" aria-hidden="true" />+{gallery.length} photo{gallery.length > 1 ? "s" : ""}
            </Badge>
          </div>
        )}
        <a
          href={whatsappLink(project)}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-[#1DA851] shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          aria-label={`Partager « ${project.title} » sur WhatsApp`}
          title="Partager sur WhatsApp"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </a>
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
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{project.description}</p>
        {/* The full text, photos and news open in a dialog, so expanding one card never stretches the others in its row */}
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button" className="mt-1 self-start text-sm font-semibold text-primary hover:underline">
                {longDescription ? "Lire la suite" : gallery.length > 0 ? "Voir les photos" : "En savoir plus"}
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              {photos.length === 1 && <img src={photos[0]} alt="" className="w-full rounded-lg object-contain" />}
              {photos.length > 1 && (
                <Carousel opts={{ loop: true }} className="w-full" aria-label={`Photos de la campagne ${project.title}`}>
                  <CarouselContent>
                    {photos.map((url, i) => (
                      <CarouselItem key={`${url}-${i}`}>
                        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
                          <img
                            src={url}
                            alt={`Photo ${i + 1} sur ${photos.length}`}
                            loading={i === 0 ? "eager" : "lazy"}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-2 bg-background/90" aria-label="Photo précédente" />
                  <CarouselNext className="right-2 bg-background/90" aria-label="Photo suivante" />
                </Carousel>
              )}
              <DialogHeader>
                <DialogTitle className="text-xl">{project.title}</DialogTitle>
                {project.location && <p className="text-sm text-muted-foreground">{project.location}</p>}
              </DialogHeader>
              <DialogDescription asChild>
                <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{project.description}</div>
              </DialogDescription>
              <CampaignNewsList projectId={project.id} />
              <ShareCampaign project={project} />
              {!completed && (
                <Button asChild className="h-11 w-full font-semibold">
                  <Link to={`/donate?project=${project.id}`}>
                    <Heart className="mr-2 h-4 w-4" />
                    Contribuer
                  </Link>
                </Button>
              )}
            </DialogContent>
          </Dialog>

        {/* mt-auto keeps buttons aligned across cards of different text length */}
        <div className="mt-auto pt-4">
          {/* A past action recorded without a fundraising goal has no progress to show */}
          {project.goal > 0 && (
            <div className="mb-4">
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
          )}

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
        </div>
      </CardContent>
    </Card>
  );
}
