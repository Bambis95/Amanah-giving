import {
  BookOpen,
  Droplets,
  GraduationCap,
  Hammer,
  Handshake,
  HandHeart,
  Heart,
  Home,
  LucideIcon,
  Recycle,
  Sparkles,
  Sprout,
  Stethoscope,
  Users,
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

// The causes SENJAPO supports
export const CATEGORIES: Category[] = [
  { value: "youth", label: "Jeunes & formation", causeLabel: "Jeunes & formation", iconName: "GraduationCap", icon: GraduationCap },
  { value: "education", label: "Daaras & éducation", causeLabel: "Daaras & éducation", iconName: "BookOpen", icon: BookOpen },
  { value: "entrepreneurship", label: "Artisans & entrepreneurs", causeLabel: "Artisans & entrepreneurs", iconName: "Hammer", icon: Hammer },
  { value: "agriculture", label: "Agriculteurs", causeLabel: "Agriculteurs & élevage", iconName: "Sprout", icon: Sprout },
  { value: "women", label: "Femmes & groupements", causeLabel: "Femmes & groupements", iconName: "Users", icon: Users },
  { value: "vulnerable", label: "Personnes vulnérables", causeLabel: "Personnes vulnérables", iconName: "HandHeart", icon: HandHeart },
  { value: "community", label: "Projets communautaires", causeLabel: "Projets communautaires à impact", iconName: "Handshake", icon: Handshake },
];

// No longer offered for new campaigns, still displayed for existing ones
const LEGACY: Category[] = [
  { value: "sanitation", label: "Assainissement", causeLabel: "Assainissement & cadre de vie", iconName: "Recycle", icon: Recycle },
  { value: "health", label: "Santé", causeLabel: "Santé", iconName: "Stethoscope", icon: Stethoscope },
  { value: "water", label: "Eau potable", causeLabel: "Eau potable", iconName: "Droplets", icon: Droplets },
  { value: "other", label: "Autres projets", causeLabel: "Autres projets", iconName: "Sparkles", icon: Sparkles },
  { value: "food", label: "Alimentation", causeLabel: "Alimentation", iconName: "UtensilsCrossed", icon: UtensilsCrossed },
  { value: "housing", label: "Logement", causeLabel: "Logement", iconName: "Home", icon: Home },
];

/** Donation without a specific campaign: allocated where it is most needed */
export const GENERAL_CAUSE = {
  value: "general",
  label: "Don général",
  causeLabel: "Don général (affecté aux campagnes qui en ont le plus besoin)",
};

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
