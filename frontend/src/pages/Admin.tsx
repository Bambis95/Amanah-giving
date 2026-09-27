import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { Clock, HandCoins, Heart, History, Loader2, Mail, RefreshCw, ShieldAlert, Users, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, AdminUser, ContactMessage, Donation, Project } from "@/api";
import DonationsTab from "@/components/admin/DonationsTab";
import MessagesTab from "@/components/admin/MessagesTab";
import ProjectsTab from "@/components/admin/ProjectsTab";
import UsersTab from "@/components/admin/UsersTab";
import AuditTab from "@/components/admin/AuditTab";
import { formatCFA } from "@/components/admin/format";

interface StatTileProps {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}

function StatTile({ icon: Icon, label, value, detail }: StatTileProps) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-2">
          <Icon className="w-4 h-4 text-[#0D7C66]" />
          {label}
        </div>
        <p className="text-2xl md:text-3xl font-bold text-[#1A1A2E] tabular-nums">{value}</p>
        <p className="text-xs text-[#6B7280] mt-1">{detail}</p>
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

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, m, p, u] = await Promise.all([
        adminApi.getDonations(),
        adminApi.getContactMessages(),
        adminApi.getProjects(),
        adminApi.getUsers(),
      ]);
      setDonations(d);
      setMessages(m);
      setProjects(p);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="w-8 h-8 text-[#0D7C66] animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: "/admin" }} />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <Navbar />
        <div className="pt-32 px-4 flex justify-center">
          <Card className="max-w-md w-full border-0 shadow-xl text-center">
            <CardContent className="p-8">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-7 h-7 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">Accès réservé</h1>
              <p className="text-[#6B7280] mb-6">
                Le compte {user.email} n'a pas les droits d'administration.
              </p>
              <Link to="/">
                <Button className="bg-[#0D7C66] hover:bg-[#095C4B] text-white">Retour à l'accueil</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paid = donations.filter((d) => d.payment_status === "paid");
  const pending = donations.filter((d) => d.payment_status === "pending");
  const unread = messages.filter((m) => !m.is_read).length;
  const anonymous = donations.filter((d) => !d.user_id).length;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A2E]">Tableau de bord</h1>
              <p className="text-[#6B7280] mt-1">Suivez les dons, les messages et les projets d'Amanah Giving.</p>
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="shrink-0">
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>

          {error ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={load} variant="outline">
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          ) : loading && donations.length === 0 && projects.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#0D7C66] animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatTile
                  icon={Wallet}
                  label="Total collecté"
                  value={formatCFA(paid.reduce((sum, d) => sum + d.amount, 0))}
                  detail={`${paid.length} don${paid.length > 1 ? "s" : ""} payé${paid.length > 1 ? "s" : ""}`}
                />
                <StatTile
                  icon={Clock}
                  label="En attente"
                  value={String(pending.length)}
                  detail={formatCFA(pending.reduce((sum, d) => sum + d.amount, 0))}
                />
                <StatTile
                  icon={HandCoins}
                  label="Dons enregistrés"
                  value={String(donations.length)}
                  detail={`dont ${anonymous} anonyme${anonymous > 1 ? "s" : ""}`}
                />
                <StatTile
                  icon={Mail}
                  label="Messages non lus"
                  value={String(unread)}
                  detail={`sur ${messages.length} message${messages.length > 1 ? "s" : ""}`}
                />
              </div>

              <Tabs defaultValue="donations">
                <TabsList className="mb-4 max-w-full overflow-x-auto justify-start">
                  <TabsTrigger value="donations">
                    <Heart className="w-4 h-4 mr-1.5" />
                    Dons
                  </TabsTrigger>
                  <TabsTrigger value="messages">
                    <Mail className="w-4 h-4 mr-1.5" />
                    Messages
                    {unread > 0 && (
                      <span className="ml-1.5 rounded-full bg-[#0D7C66] text-white text-xs px-1.5 tabular-nums">
                        {unread}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="projects">Projets</TabsTrigger>
                  <TabsTrigger value="users">
                    <Users className="w-4 h-4 mr-1.5" />
                    Utilisateurs
                  </TabsTrigger>
                  <TabsTrigger value="audit">
                    <History className="w-4 h-4 mr-1.5" />
                    Journal
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="donations">
                  <DonationsTab donations={donations} />
                </TabsContent>
                <TabsContent value="messages">
                  <MessagesTab messages={messages} onChange={setMessages} />
                </TabsContent>
                <TabsContent value="projects">
                  <ProjectsTab projects={projects} onChange={setProjects} />
                </TabsContent>
                <TabsContent value="users">
                  <UsersTab users={users} currentUserId={user.id} onChange={setUsers} />
                </TabsContent>
                <TabsContent value="audit">
                  <AuditTab />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
