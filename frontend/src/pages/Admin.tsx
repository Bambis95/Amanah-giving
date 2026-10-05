import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import {
  Clock,
  FolderOpen,
  Heart,
  History,
  Landmark,
  LayoutDashboard,
  Loader2,
  Mail,
  PieChart,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, AdminUser, ContactMessage, Donation, Project } from "@/api";
import DonationsTab from "@/components/admin/DonationsTab";
import MessagesTab from "@/components/admin/MessagesTab";
import ProjectsTab from "@/components/admin/ProjectsTab";
import UsersTab from "@/components/admin/UsersTab";
import AuditTab from "@/components/admin/AuditTab";
import OverviewTab, { OverviewTarget } from "@/components/admin/OverviewTab";
import { formatCFA } from "@/components/admin/format";
import { canEditFinance, canManage as roleCanManage, canReadFinance, isAdminRole, isStaff, Role, ROLE_LABELS } from "@/lib/roles";
import SiteSettingsTab from "@/components/admin/SiteSettingsTab";
import DataExportCard from "@/components/admin/DataExportCard";
import NewsletterTab from "@/components/admin/NewsletterTab";
import FinanceTab from "@/components/admin/finance/FinanceTab";
import { cn } from "@/lib/utils";
import { softTone, Tone } from "@/lib/tones";

type Section = "overview" | "donations" | "messages" | "projects" | "finances" | "users" | "audit" | "settings" | "newsletter";

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

function StatTile({ icon: Icon, label, value, detail, tone }: StatTileProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", softTone[tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="truncate text-xl font-bold tabular-nums text-foreground sm:text-2xl xl:text-3xl">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [messageKind, setMessageKind] = useState("all");

  const staff = isStaff(user?.role);
  // President and admins run the club; members read the dashboard only
  const manager = roleCanManage(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, p, m, u] = await Promise.all([
        adminApi.getDonations(),
        adminApi.getProjects(),
        manager ? adminApi.getContactMessages() : Promise.resolve([] as ContactMessage[]),
        manager ? adminApi.getUsers() : Promise.resolve([] as AdminUser[]),
      ]);
      setDonations(d);
      setProjects(p);
      setMessages(m);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [manager]);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Chargement" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: "/admin" }} />;

  if (!staff) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center px-4 pt-32">
          <Card className="w-full max-w-md text-center shadow-sm">
            <CardContent className="p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
              </div>
              <h1 className="mb-2 text-xl font-bold text-foreground">Accès réservé</h1>
              <p className="mb-6 text-muted-foreground">
                Le tableau de bord est réservé aux membres du club. Le compte {user.email} n'y a pas accès.
              </p>
              <Button asChild>
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paid = donations.filter((d) => d.payment_status === "paid");
  const pending = donations.filter((d) => d.payment_status === "pending");
  const unread = messages.filter((m) => !m.is_read).length;
  const activeCampaigns = projects.filter((p) => !p.status || p.status === "active").length;
  const pendingDeposits = donations.filter((d) => d.payment_provider === "mobile_qr" && d.payment_status === "pending").length;

  const sections: { id: Section; label: string; icon: React.ElementType; count?: number; alert?: boolean }[] = [
    { id: "overview", label: "Vue d'ensemble", icon: PieChart },
    { id: "donations", label: "Dons", icon: Heart, count: manager && pendingDeposits ? pendingDeposits : donations.length, alert: manager && pendingDeposits > 0 },
    ...(manager ? [{ id: "messages" as Section, label: "Messages", icon: Mail, count: unread || undefined, alert: unread > 0 }] : []),
    ...(manager ? [{ id: "newsletter" as Section, label: "Newsletter", icon: Send }] : []),
    { id: "projects", label: "Campagnes", icon: FolderOpen, count: projects.length },
    ...(canReadFinance(user.role) ? [{ id: "finances" as Section, label: "Finances", icon: Landmark }] : []),
    ...(manager
      ? [
          { id: "users" as Section, label: "Membres & comptes", icon: Users, count: users.length },
          { id: "audit" as Section, label: "Journal", icon: History },
          ...(isAdminRole(user.role) ? [{ id: "settings" as Section, label: "Réglages du site", icon: SlidersHorizontal }] : []),
        ]
      : []),
  ];
  const current = sections.find((s) => s.id === section) ?? sections[0];
  const initialLoading = loading && donations.length === 0 && projects.length === 0;

  const go = (target: OverviewTarget) => {
    if (target.section === "messages") setMessageKind(target.kind);
    setSection(target.section);
  };

  const navButton = (s: (typeof sections)[number], layout: "sidebar" | "bar") => {
    const active = s.id === current.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => {
          if (s.id === "messages") setMessageKind("all");
          setSection(s.id);
        }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
          layout === "sidebar" ? "w-full px-3 py-2.5" : "h-10 shrink-0 px-3.5",
          active ? "bg-accent text-accent-foreground" : "text-foreground/75 hover:bg-muted hover:text-foreground"
        )}
      >
        <s.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={layout === "sidebar" ? "flex-1 text-left" : ""}>{s.label}</span>
        {s.count !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 text-xs tabular-nums",
              s.alert ? "bg-highlight text-highlight-foreground" : "bg-muted text-muted-foreground",
              active && !s.alert && "bg-background/70"
            )}
          >
            {s.count}
          </span>
        )}
      </button>
    );
  };

  const role = (user.role as Role) in ROLE_LABELS ? (user.role as Role) : "user";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pt-24">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block">
          <nav aria-label="Sections du tableau de bord" className="sticky top-24 space-y-1 rounded-xl border border-border bg-card p-3 shadow-sm">
            <p className="flex items-center gap-2 px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Tableau de bord
            </p>
            {sections.map((s) => navButton(s, "sidebar"))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex items-start justify-between gap-4 pt-4 lg:pt-0">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Tableau de bord</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:text-base">
                Bonjour {user.name || user.email}
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {ROLE_LABELS[role]}
                </Badge>
              </p>
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="shrink-0" aria-label="Actualiser les données">
              <RefreshCw className={cn("h-4 w-4 sm:mr-2", loading && "animate-spin")} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>

          {error ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center">
                <p className="mb-4 text-destructive">{error}</p>
                <Button onClick={load} variant="outline">
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-busy={initialLoading}>
                {initialLoading ? (
                  [0, 1, 2, 3].map((i) => <div key={i} className="h-[7.5rem] animate-pulse rounded-xl border border-border bg-muted/60" />)
                ) : (
                  <>
                    <StatTile
                      icon={Wallet}
                      tone="primary"
                      label="Total collecté"
                      value={formatCFA(paid.reduce((sum, d) => sum + d.amount, 0))}
                      detail={`${paid.length} don${paid.length > 1 ? "s" : ""} confirmé${paid.length > 1 ? "s" : ""}`}
                    />
                    <StatTile
                      icon={Clock}
                      tone="highlight"
                      label="En attente"
                      value={String(pending.length)}
                      detail={`${formatCFA(pending.reduce((sum, d) => sum + d.amount, 0))}${pendingDeposits ? ` · ${pendingDeposits} dépôt${pendingDeposits > 1 ? "s" : ""} QR` : ""}`}
                    />
                    <StatTile
                      icon={FolderOpen}
                      tone="info"
                      label="Campagnes actives"
                      value={String(activeCampaigns)}
                      detail={`sur ${projects.length} campagne${projects.length > 1 ? "s" : ""}`}
                    />
                    {manager ? (
                      <StatTile
                        icon={Mail}
                        tone="destructive"
                        label="Messages non lus"
                        value={String(unread)}
                        detail={`sur ${messages.length} message${messages.length > 1 ? "s" : ""}`}
                      />
                    ) : (
                      <StatTile
                        icon={Users}
                        tone="destructive"
                        label="Donateurs"
                        value={String(new Set(paid.map((d) => d.user_id || d.donor_first_name || d.id)).size)}
                        detail="ayant un don confirmé"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Section bar (mobile & tablet): same navigation as the sidebar */}
              <nav
                aria-label="Sections du tableau de bord"
                className="scrollbar-hide -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-3 sm:-mx-6 sm:px-6 lg:hidden"
              >
                {sections.map((s) => navButton(s, "bar"))}
              </nav>

              <h2 className="sr-only">{current.label}</h2>
              {!initialLoading && (
                <div key={`${current.id}-${messageKind}`} className="animate-in fade-in-0 duration-200">
                  {current.id === "overview" && (
                    <OverviewTab
                      donations={donations}
                      messages={messages}
                      projects={projects}
                      canManage={manager}
                      showFinance={canReadFinance(user.role)}
                      onGo={go}
                    />
                  )}
                  {current.id === "donations" && <DonationsTab donations={donations} onChange={setDonations} canManage={manager} />}
                  {current.id === "messages" && <MessagesTab messages={messages} onChange={setMessages} initialKind={messageKind} />}
                  {current.id === "projects" && <ProjectsTab projects={projects} onChange={setProjects} readOnly={!manager} />}
                  {current.id === "finances" && <FinanceTab projects={projects} canEdit={canEditFinance(user.role)} canSetCommission={isAdminRole(user.role)} />}
                  {current.id === "users" && (
                    <UsersTab users={users} currentUserId={user.id} currentRole={user.role} onChange={setUsers} />
                  )}
                  {current.id === "audit" && <AuditTab />}
                  {current.id === "settings" && (
                    <div className="space-y-4">
                      <SiteSettingsTab />
                      <DataExportCard />
                    </div>
                  )}
                  {current.id === "newsletter" && <NewsletterTab projects={projects} />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
