export function formatCFA(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export { categoryLabel } from "@/lib/categories";

export const paymentMethodLabels: Record<string, string> = {
  stripe: "Carte (Stripe)",
  card: "Carte (Stripe)",
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
