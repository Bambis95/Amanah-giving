import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  ChevronRight,
  Droplets,
  GraduationCap,
  Heart,
  Home,
  Stethoscope,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Project } from "@/api";

const iconMap: Record<string, React.ElementType> = {
  GraduationCap,
  Stethoscope,
  Droplets,
  UtensilsCrossed,
  Home,
};

function formatCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

export default function ProjectCard({ project }: { project: Project }) {
  const progress = project.goal > 0 ? Math.round((project.raised / project.goal) * 100) : 0;
  const IconComponent = iconMap[project.icon || ""] || Heart;
  const completed = project.status === "completed";

  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden">
        {project.image ? (
          <img
            src={project.image}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#E8F5F0] to-[#C8E6DC] flex items-center justify-center">
            <IconComponent className="w-14 h-14 text-[#0D7C66]/40" />
          </div>
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2">
            <IconComponent className="w-4 h-4 text-[#0D7C66]" />
          </div>
          {completed ? (
            <Badge className="bg-[#1A1A2E] text-white border-0 text-xs gap-1">
              <CheckCircle className="w-3 h-3" />
              Terminé
            </Badge>
          ) : (
            project.urgent && <Badge className="bg-red-500 text-white border-0 text-xs">Urgent</Badge>
          )}
        </div>
        {project.location && (
          <div className="absolute bottom-4 right-4">
            <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-[#374151] text-xs">
              {project.location}
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-5">
        <h3 className="text-lg font-bold text-[#1A1A2E] mb-2 group-hover:text-[#0D7C66] transition-colors">
          {project.title}
        </h3>
        <p className="text-sm text-[#6B7280] mb-4 leading-relaxed line-clamp-2">{project.description}</p>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold text-[#0D7C66]">{formatCFA(project.raised)} FCFA</span>
            <span className="text-[#6B7280]">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0D7C66] to-[#10B981] rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-[#6B7280]">Objectif: {formatCFA(project.goal)} FCFA</span>
            <span className="text-xs text-[#6B7280] flex items-center gap-1">
              <Users className="w-3 h-3" />
              {project.donors || 0}
            </span>
          </div>
        </div>

        {completed ? (
          <Button disabled variant="outline" className="w-full rounded-lg font-semibold">
            <CheckCircle className="w-4 h-4 mr-2" />
            Projet terminé
          </Button>
        ) : (
          <Link to={`/donate?project=${project.id}`}>
            <Button className="w-full bg-[#0D7C66] hover:bg-[#095C4B] text-white rounded-lg font-semibold">
              <Heart className="w-4 h-4 mr-2" />
              Contribuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
