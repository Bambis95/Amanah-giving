// Club roles, same levels as the server (backend/dependencies/auth.py): the server enforces them,
// the website only hides what a role cannot use.
export type Role = "user" | "member" | "president" | "admin";

const LEVELS: Record<string, number> = { user: 0, member: 1, president: 2, admin: 3 };

export const ROLE_LABELS: Record<Role, string> = {
  user: "Utilisateur",
  member: "Membre du club",
  president: "Président",
  admin: "Administrateur",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  user: "Compte donateur, sans accès au tableau de bord.",
  member: "Consulte le tableau de bord : chiffres, campagnes et dons, sans les coordonnées des donateurs.",
  president: "Gère le club : campagnes, dépôts, messages, adhésions, journal, et nomme les membres.",
  admin: "Tous les droits, y compris les réglages techniques et la nomination des présidents.",
};

const level = (role?: string | null) => LEVELS[role ?? "user"] ?? 0;

/** Sees the dashboard (member, president, admin) */
export const isStaff = (role?: string | null) => level(role) >= LEVELS.member;
/** Manages campaigns, deposits, messages, members (president, admin) */
export const canManage = (role?: string | null) => level(role) >= LEVELS.president;
export const isAdminRole = (role?: string | null) => role === "admin";

/** Roles a manager may give or take away: a president handles membership only */
export const assignableRoles = (managerRole?: string | null): Role[] =>
  isAdminRole(managerRole) ? ["user", "member", "president", "admin"] : ["user", "member"];
