// Club roles, same levels as the server (backend/dependencies/auth.py): the server enforces them,
// the website only hides what a role cannot use.
export type Role = "user" | "member" | "treasurer" | "president" | "admin";

const LEVELS: Record<string, number> = { user: 0, member: 1, treasurer: 1, president: 2, admin: 3 };

export const ROLE_LABELS: Record<Role, string> = {
  user: "Utilisateur",
  member: "Membre du club",
  treasurer: "Trésorier",
  president: "Président",
  admin: "Administrateur",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  user: "Compte donateur, sans accès au tableau de bord.",
  member: "Consulte le tableau de bord : chiffres, campagnes et dons, sans les coordonnées des donateurs.",
  treasurer: "Tient les comptes : recettes, dépenses, justificatifs, budgets des campagnes et pointage des dons.",
  president: "Gère le club : campagnes, dépôts, messages, adhésions, journal, et nomme les membres. Consulte les finances.",
  admin: "Tous les droits, y compris les finances, les réglages techniques et la nomination des présidents.",
};

const level = (role?: string | null) => LEVELS[role ?? "user"] ?? 0;

/** Sees the dashboard (member, treasurer, president, admin) */
export const isStaff = (role?: string | null) => level(role) >= LEVELS.member;
/** Manages campaigns, deposits, messages, members (president, admin) */
export const canManage = (role?: string | null) => level(role) >= LEVELS.president;
export const isAdminRole = (role?: string | null) => role === "admin";
/** Finances: the treasurer and admins keep the accounts, the president reads them */
export const canReadFinance = (role?: string | null) => role === "treasurer" || role === "president" || role === "admin";
export const canEditFinance = (role?: string | null) => role === "treasurer" || role === "admin";

/** Roles a manager may give or take away: a president handles membership only */
export const assignableRoles = (managerRole?: string | null): Role[] =>
  isAdminRole(managerRole) ? ["user", "member", "treasurer", "president", "admin"] : ["user", "member"];
