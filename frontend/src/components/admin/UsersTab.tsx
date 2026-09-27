import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { adminApi, AdminUser } from "@/api";
import { formatDate } from "./format";

interface UsersTabProps {
  users: AdminUser[];
  currentUserId: string;
  onChange: (users: AdminUser[]) => void;
}

function RoleBadge({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {user.role === "admin" ? (
        <Badge className="bg-accent text-primary border-0 hover:bg-accent gap-1">
          <ShieldCheck className="w-3 h-3" />
          Administrateur
        </Badge>
      ) : (
        <Badge variant="outline" className="text-foreground/80">
          Utilisateur
        </Badge>
      )}
      {isSelf && (
        <Badge variant="outline" className="text-muted-foreground">
          Vous
        </Badge>
      )}
    </div>
  );
}

interface RoleActionProps {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  onConfirm: (user: AdminUser) => void;
}

function RoleAction({ user, isSelf, busy, onConfirm }: RoleActionProps) {
  if (isSelf) {
    return <span className="text-xs text-muted-foreground">Votre propre rôle ne peut pas être modifié</span>;
  }
  const promote = user.role !== "admin";
  const who = user.name || user.email;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className={promote ? "" : "text-destructive hover:text-destructive hover:bg-destructive/10"}
        >
          {promote ? <ShieldCheck className="w-4 h-4 mr-1.5" /> : <ShieldOff className="w-4 h-4 mr-1.5" />}
          {promote ? "Promouvoir admin" : "Retirer les droits"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {promote ? `Promouvoir ${who} administrateur ?` : `Retirer les droits d'administration de ${who} ?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {promote
              ? "Ce compte pourra consulter les dons et les messages, et gérer les projets et les utilisateurs. Il devra se reconnecter pour voir le menu « Administration »."
              : "Ce compte perd immédiatement l'accès au tableau de bord et aux données d'administration."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(user)}
            className={promote ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
          >
            {promote ? "Promouvoir" : "Retirer les droits"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function UsersTab({ users, currentUserId, onChange }: UsersTabProps) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => [u.email, u.name].filter(Boolean).some((v) => v!.toLowerCase().includes(term)));
  }, [users, search]);

  const adminCount = users.filter((u) => u.role === "admin").length;

  const changeRole = async (user: AdminUser) => {
    const role = user.role === "admin" ? "user" : "admin";
    setBusyId(user.id);
    try {
      const updated = await adminApi.setUserRole(user.id, role);
      onChange(users.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(role === "admin" ? "Compte promu administrateur" : "Droits d'administration retirés");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un nom ou un email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          {users.length} compte{users.length > 1 ? "s" : ""} · {adminCount} administrateur{adminCount > 1 ? "s" : ""}
        </p>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucun compte ne correspond à cette recherche.</p>
        ) : (
          <>
            {/* Mobile: one card per account instead of a wide table */}
            <div className="md:hidden space-y-3">
              {filtered.map((u) => (
                <div key={u.id} className="rounded-lg border border-border p-4">
                  <p className="font-medium text-foreground">{u.name || <span className="italic text-muted-foreground">Sans nom</span>}</p>
                  <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                  <div className="mt-2">
                    <RoleBadge user={u} isSelf={u.id === currentUserId} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Inscrit le {formatDate(u.created_at)} · Dernière connexion : {formatDate(u.last_login)}
                  </p>
                  <div className="mt-3">
                    <RoleAction user={u} isSelf={u.id === currentUserId} busy={busyId === u.id} onConfirm={changeRole} />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {u.name || <span className="italic text-muted-foreground">Sans nom</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <RoleBadge user={u} isSelf={u.id === currentUserId} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(u.last_login)}</TableCell>
                      <TableCell className="text-right">
                        <RoleAction user={u} isSelf={u.id === currentUserId} busy={busyId === u.id} onConfirm={changeRole} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
