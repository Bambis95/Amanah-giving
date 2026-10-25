import type { TontineMethod, TontineRole } from "@/api";

export const ROLE_LABELS: Record<TontineRole, string> = {
  admin: "Supervision SENJAPO",
  president: "Président(e)",
  treasurer: "Trésorier(ère)",
  member: "Membre",
};

export const METHOD_LABELS: Record<TontineMethod, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  bank_transfer: "Virement bancaire",
};

export const KIND_LABELS = { contribution: "Cotisation", deposit: "Dépôt à la banque", payout: "Versement à un membre" } as const;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
export const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
/** Today's date in the visitor's time zone, as the server expects it (YYYY-MM-DD) */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
