import { getAPIBaseURL } from '../lib/config';

const getAPIBase = () => `${getAPIBaseURL()}/api/v1`;

// The session lives in an httpOnly cookie set by the server: JavaScript never sees the token.
// Every request sends it; "include" also covers an API served from another origin in production.
const apiFetch = (url: string, init: RequestInit = {}) => fetch(url, { ...init, credentials: "include" });

const errorDetail = async (response: Response, fallback: string) => {
  const error = await response.json().catch(() => null);
  if (typeof error?.detail === "string") return error.detail;
  // FastAPI validation errors (422) come as a list of { loc, msg }
  if (Array.isArray(error?.detail)) {
    const fields: string[] = error.detail.map((d: { loc?: string[] }) => d.loc?.[d.loc.length - 1] ?? "");
    if (fields.includes("email")) return "Adresse email invalide";
  }
  return fallback;
};

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  /** Inactivity before automatic logout (set by the server: shorter for admins) */
  idle_minutes?: number;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  image: string | null;
  category: string;
  icon: string | null;
  raised: number;
  goal: number;
  donors: number | null;
  location: string | null;
  urgent: boolean | null;
  is_featured: boolean | null;
  status: string | null;
  created_at: string | null;
}

export interface ProjectsListResponse {
  items: Project[];
  total: number;
  skip: number;
  limit: number;
}

export interface DonationCheckoutRequest {
  amount: number;
  cause: string;
  payment_method: string;
  project_id?: number;
  donor_first_name?: string;
  donor_last_name?: string;
  donor_email?: string;
  donor_phone?: string;
  message?: string;
}

export interface DonationCheckoutResponse {
  checkout_url: string | null;
  session_id: string | null;
  donation_id: number | null;
  payment_method: string;
  instructions: string | null;
}

export interface VerifyPaymentResponse {
  status: string;
  payment_status: string;
  donation_id: number | null;
  amount: number | null;
}

export interface ContactMessageRequest {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface Donation {
  id: number;
  user_id: string | null;
  project_id: number | null;
  amount: number;
  cause: string;
  payment_method: string;
  payment_status: string;
  /** "mobile_qr" = deposit made with the Wave / Orange Money QR code, confirmed by an admin */
  payment_provider?: string | null;
  payment_reference?: string | null;
  donor_first_name: string | null;
  donor_last_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  message: string | null;
  created_at: string | null;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean | null;
  created_at: string | null;
}

export type ProjectInput = Omit<Project, "id" | "created_at">;

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "member" | "president" | "admin";
  created_at: string | null;
  last_login: string | null;
  /** Set while the account is suspended */
  suspended_at?: string | null;
}

export interface UploadedImage {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

export type StaffRole = "member" | "president" | "admin";

export interface Invitation {
  id: number;
  email: string;
  name: string | null;
  role: StaffRole;
  expires_at: string;
  created_at: string | null;
}

export interface InvitationCreated {
  invitation: Invitation;
  /** Shown once, so the link can also be sent by WhatsApp */
  invite_url: string;
  email_sent: boolean;
}

export interface InvitationPreview {
  email: string;
  name: string | null;
  role: StaffRole;
  expires_at: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
}

export type AuditCategory = "project" | "donation" | "message" | "user" | "setting" | "security";

export interface MobileDepositDeclaration {
  amount: number;
  payment_method: "wave" | "orange_money";
  transaction_ref: string;
  donor_phone: string;
  donor_first_name?: string;
  donor_last_name?: string;
  donor_email?: string;
  project_id?: number;
  cause?: string;
  message?: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  next_before_id: number | null;
}

// Authenticated JSON request for admin endpoints
async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${getAPIBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (response.status === 401) throw new Error("Session expirée, veuillez vous reconnecter");
  // The server says why (role too low, blocked origin...): show its reason
  if (response.status === 403) throw new Error(await errorDetail(response, "Accès réservé aux administrateurs"));
  if (!response.ok) throw new Error(await errorDetail(response, "La requête a échoué"));
  return response.json();
}

export const adminApi = {
  async getDonations(): Promise<Donation[]> {
    return (await adminRequest<ListResponse<Donation>>("/entities/donations/all?limit=2000&sort=-id")).items;
  },

  async getContactMessages(): Promise<ContactMessage[]> {
    return (await adminRequest<ListResponse<ContactMessage>>("/entities/contact_messages/all?limit=2000&sort=-id"))
      .items;
  },

  setMessageRead(id: number, isRead: boolean): Promise<ContactMessage> {
    return adminRequest(`/entities/contact_messages/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_read: isRead }),
    });
  },

  deleteContactMessage(id: number): Promise<unknown> {
    return adminRequest(`/entities/contact_messages/${id}`, { method: "DELETE" });
  },

  async getProjects(): Promise<Project[]> {
    return (await adminRequest<ListResponse<Project>>("/entities/projects/all?limit=2000&sort=-id")).items;
  },

  createProject(data: ProjectInput): Promise<Project> {
    return adminRequest("/entities/projects", { method: "POST", body: JSON.stringify(data) });
  },

  updateProject(id: number, data: Partial<ProjectInput>): Promise<Project> {
    return adminRequest(`/entities/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteProject(id: number): Promise<unknown> {
    return adminRequest(`/entities/projects/${id}`, { method: "DELETE" });
  },

  getAuditLogs(category?: AuditCategory, beforeId?: number): Promise<AuditLogPage> {
    const params = new URLSearchParams({ limit: "50" });
    if (category) params.set("category", category);
    if (beforeId) params.set("before_id", String(beforeId));
    return adminRequest(`/admin/audit-logs?${params}`);
  },

  getUsers(): Promise<AdminUser[]> {
    return adminRequest("/users");
  },

  setUserRole(id: string, role: AdminUser["role"]): Promise<AdminUser> {
    return adminRequest(`/users/${encodeURIComponent(id)}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  setSuspension(id: string, suspended: boolean): Promise<AdminUser> {
    return adminRequest(`/users/${encodeURIComponent(id)}/suspension`, {
      method: "PUT",
      body: JSON.stringify({ suspended }),
    });
  },

  /** Campaign photo: the server resizes it and returns its public URL */
  async uploadImage(file: File): Promise<UploadedImage> {
    const body = new FormData();
    body.append("file", file);
    // No Content-Type header: the browser sets the multipart boundary itself
    const response = await apiFetch(`${getAPIBase()}/images`, { method: "POST", body });
    if (response.status === 401) throw new Error("Session expirée, veuillez vous reconnecter");
    if (response.status === 413) throw new Error("Photo trop lourde (12 Mo au maximum)");
    if (!response.ok) throw new Error(await errorDetail(response, "L'envoi de la photo a échoué"));
    return response.json();
  },

  getInvitations(): Promise<Invitation[]> {
    return adminRequest("/invitations");
  },

  createInvitation(data: { email: string; name?: string; role: StaffRole }): Promise<InvitationCreated> {
    return adminRequest("/invitations", { method: "POST", body: JSON.stringify(data) });
  },

  revokeInvitation(id: number): Promise<unknown> {
    return adminRequest(`/invitations/${id}`, { method: "DELETE" });
  },

  // Wave / Orange Money QR deposits: checked in the operator app, then confirmed or rejected here
  confirmDeposit(donationId: number): Promise<{ donation_id: number; payment_status: string }> {
    return adminRequest(`/payment/mobile-deposit/${donationId}/confirm`, { method: "POST" });
  },

  rejectDeposit(donationId: number): Promise<{ donation_id: number; payment_status: string }> {
    return adminRequest(`/payment/mobile-deposit/${donationId}/reject`, { method: "POST" });
  },
};

export interface PublicStats {
  total_raised: number;
  donors: number;
  paid_donations: number;
  active_projects: number;
  funded_projects: number;
}

export interface SiteStatus {
  donations_enabled: boolean;
}

export const api = {
  // Public site switches (donations closed before the official launch)
  async getSiteStatus(): Promise<SiteStatus> {
    const response = await apiFetch(`${getAPIBase()}/site`);
    if (!response.ok) throw new Error("Failed to fetch site status");
    return response.json();
  },

  // Public platform statistics (aggregates of paid donations and projects)
  async getStats(): Promise<PublicStats> {
    const response = await apiFetch(`${getAPIBase()}/stats`);
    if (!response.ok) throw new Error("Failed to fetch stats");
    return response.json();
  },

  // Authentication
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiFetch(`${getAPIBase()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.status === 401) throw new Error("Email ou mot de passe incorrect");
    if (!response.ok) throw new Error(await errorDetail(response, "Échec de la connexion"));
    return response.json();
  },

  async register(email: string, password: string, name?: string): Promise<AuthUser> {
    const response = await apiFetch(`${getAPIBase()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!response.ok) {
      const detail = await errorDetail(response, "Échec de la création du compte");
      throw new Error(detail === "Email already registered" ? "Un compte existe déjà avec cet email" : detail);
    }
    return (await response.json()).user;
  },

  async logout(): Promise<void> {
    await apiFetch(`${getAPIBase()}/auth/logout`, { method: "POST" });
  },

  async forgotPassword(email: string): Promise<string> {
    const response = await apiFetch(`${getAPIBase()}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error(await errorDetail(response, "La demande a échoué"));
    return (await response.json()).message;
  },

  async resetPassword(token: string, password: string): Promise<string> {
    const response = await apiFetch(`${getAPIBase()}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) throw new Error(await errorDetail(response, "La réinitialisation a échoué"));
    return (await response.json()).message;
  },

  // Staff invitation link (public: the token is the proof)
  async getInvitation(token: string): Promise<InvitationPreview> {
    const response = await apiFetch(`${getAPIBase()}/invitations/preview?token=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error(await errorDetail(response, "Invitation introuvable"));
    return response.json();
  },

  async acceptInvitation(token: string, password: string, name?: string): Promise<LoginResponse> {
    const response = await apiFetch(`${getAPIBase()}/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, name }),
    });
    if (!response.ok) throw new Error(await errorDetail(response, "L'activation a échoué"));
    return response.json();
  },

  async getMe(): Promise<AuthUser | null> {
    const response = await apiFetch(`${getAPIBase()}/auth/me`);
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Failed to fetch current user");
    return response.json();
  },

  // Projects
  async getProjects(category?: string): Promise<ProjectsListResponse> {
    let url = `${getAPIBase()}/entities/projects/all?limit=50&sort=-created_at`;
    if (category && category !== "all") {
      url += `&query=${encodeURIComponent(JSON.stringify({ category }))}`;
    }
    const response = await apiFetch(url);
    if (!response.ok) throw new Error("Failed to fetch projects");
    return response.json();
  },

  async getFeaturedProjects(): Promise<ProjectsListResponse> {
    const url = `${getAPIBase()}/entities/projects/all?limit=6&query=${encodeURIComponent(JSON.stringify({ is_featured: true }))}`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error("Failed to fetch featured projects");
    return response.json();
  },

  // Donations / Payment
  async createDonationCheckout(data: DonationCheckoutRequest): Promise<DonationCheckoutResponse> {
    const response = await apiFetch(`${getAPIBase()}/payment/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await errorDetail(response, "Erreur lors de la création du paiement"));
    return response.json();
  },

  async verifyPayment(sessionId: string): Promise<VerifyPaymentResponse> {
    const response = await apiFetch(`${getAPIBase()}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!response.ok) throw new Error("Failed to verify payment");
    return response.json();
  },

  /** Wave / Orange Money / card through an aggregator: PayDunya asks the provider, PayTech reads the IPN result */
  async verifyMobilePayment(provider: "paydunya" | "paytech", donationId: number): Promise<VerifyPaymentResponse> {
    const response = await apiFetch(`${getAPIBase()}/payment/${provider}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ donation_id: donationId }),
    });
    if (!response.ok) throw new Error("Failed to verify payment");
    return response.json();
  },

  // Contact Messages
  async declareMobileDeposit(data: MobileDepositDeclaration): Promise<{ donation_id: number; payment_status: string }> {
    const response = await apiFetch(`${getAPIBase()}/payment/mobile-deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.status === 409) throw new Error("Cette transaction a déjà été déclarée.");
    if (!response.ok) throw new Error(await errorDetail(response, "La déclaration n'a pas pu être envoyée."));
    return response.json();
  },

  async sendContactMessage(data: ContactMessageRequest): Promise<{ id: number }> {
    const response = await apiFetch(`${getAPIBase()}/entities/contact_messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to send message");
    return response.json();
  },
};