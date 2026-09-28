import {
  Droplets,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  LucideIcon,
  Recycle,
  Sparkles,
  Sprout,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";

// Project categories, shared by the public pages, the donation form and the admin.
// `value` is stored in the database (projects.category, donations.cause): never rename one.
export interface Category {
  value: string;
  label: string;
  /** Longer wording in the donation form */
  causeLabel: string;
  /** lucide icon name stored in projects.icon (picked by the admin form from the category) */
  iconName: string;
  icon: LucideIcon;
}

export const CATEGORIES: Category[] = [
  { value: "agriculture", label: "Agriculture", causeLabel: "Agriculture & élevage", iconName: "Sprout", icon: Sprout },
  { value: "education", label: "Éducation", causeLabel: "Éducation", iconName: "GraduationCap", icon: GraduationCap },
  { value: "sanitation", label: "Assainissement", causeLabel: "Assainissement & cadre de vie", iconName: "Recycle", icon: Recycle },
  { value: "entrepreneurship", label: "Création d'activités", causeLabel: "Création d'activités & emploi", iconName: "Lightbulb", icon: Lightbulb },
  { value: "health", label: "Santé", causeLabel: "Santé", iconName: "Stethoscope", icon: Stethoscope },
  { value: "water", label: "Eau potable", causeLabel: "Eau potable", iconName: "Droplets", icon: Droplets },
  { value: "other", label: "Autres projets", causeLabel: "Autres projets nationaux et régionaux", iconName: "Sparkles", icon: Sparkles },
];

// No longer offered for new projects, still displayed for existing ones
const LEGACY: Category[] = [
  { value: "food", label: "Alimentation", causeLabel: "Alimentation", iconName: "UtensilsCrossed", icon: UtensilsCrossed },
  { value: "housing", label: "Logement", causeLabel: "Logement", iconName: "Home", icon: Home },
];

/** Donation without a specific project: the club allocates it where it is most needed */
export const GENERAL_CAUSE = { value: "general", label: "Don général", causeLabel: "Don général (le club l'affecte là où c'est le plus utile)" };

const ALL = [...CATEGORIES, ...LEGACY];

export function categoryLabel(value: string): string {
  if (value === GENERAL_CAUSE.value) return GENERAL_CAUSE.label;
  return ALL.find((c) => c.value === value)?.label ?? value;
}

export function causeLabel(value: string): string {
  if (value === GENERAL_CAUSE.value) return GENERAL_CAUSE.causeLabel;
  return ALL.find((c) => c.value === value)?.causeLabel ?? value;
}

export function iconNameFor(category: string): string {
  return ALL.find((c) => c.value === category)?.iconName ?? "Heart";
}

/** Icon stored on a project (by name), with a heart as fallback */
export function iconByName(name: string | null | undefined): LucideIcon {
  return ALL.find((c) => c.iconName === name)?.icon ?? Heart;
}
