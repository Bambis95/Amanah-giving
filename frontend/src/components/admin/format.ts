export function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export { categoryLabel } from "@/lib/categories";

// Request types the club handles separately (contact message subjects); the rest are plain messages
export const MESSAGE_KINDS: { id: string; label: string; subjects: string[] }[] = [
  { id: "membership", label: "Adhésions", subjects: ["membership"] },
  { id: "join", label: "Campagnes proposées", subjects: ["join", "project"] },
  { id: "partnership", label: "Partenariats", subjects: ["partnership"] },
  { id: "notify", label: "Tenez-moi informé", subjects: ["notify"] },
];

export const paymentMethodLabels: Record<string, string> = {
  stripe: "Carte bancaire",
  card: "Carte bancaire",
  wave: "Wave",
  orange_money: "Orange Money",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Payé",
  pending: "En attente",
  failed: "Échoué",
  cancelled: "Annulé",
};

export const paymentStatuses = Object.entries(paymentStatusLabels).map(([value, label]) => ({ value, label }));

export const projectStatuses: Record<string, string> = {
  active: "Actif",
  paused: "En pause",
  completed: "Terminé",
};
