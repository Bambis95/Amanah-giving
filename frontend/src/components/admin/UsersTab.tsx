import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ban, Clock, KeyRound, RotateCcw, Search, ShieldCheck, Smartphone, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi, AdminUser, Invitation, twoFactorApi } from "@/api";
import InviteDialog from "./InviteDialog";
import { assignableRoles, isStaff, Role, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";

interface UsersTabProps {
  users: AdminUser[];
  currentUserId: string;
  /** Role of the person using the dashboard: a president manages membership only */
  currentRole: string;
  onChange: (users: AdminUser[]) => void;
}

const roleBadgeClass: Record<string, string> = {
  admin: "bg-primary text-primary-foreground hover:bg-primary",
  president: "bg-highlight text-highlight-foreground hover:bg-highlight",
  treasurer: "bg-success text-success-foreground hover:bg-success",
  accountant: "bg-success text-success-foreground hover:bg-success",
  member: "bg-accent text-accent-foreground hover:bg-accent",
};

function RoleBadge({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const role = (user.role as Role) in ROLE_LABELS ? (user.role as Role) : "user";
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={role === "user" ? "outline" : "default"} className={cn("gap-1 border-0", roleBadgeClass[role])}>
        {isStaff(role) && <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
        {ROLE_LABELS[role]}
      </Badge>
      {user.is_technical_owner && (
        <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          Propriétaire technique
        </Badge>
      )}
      {user.two_factor && (
        <Badge variant="outline" className="gap-1 border-success/40 text-success" title="Double authentification activée">
          <Smartphone className="h-3 w-3" aria-hidden="true" />
          2FA
        </Badge>
      )}
      {isSelf && (
        <Badge variant="outline" className="text-muted-foreground">
          Vous
        </Badge>
      )}
      {user.suspended_at && (
        <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
          <Ban className="h-3 w-3" aria-hidden="true" />
          Suspendu
        </Badge>
      )}
    </div>
  );
}

interface SuspendToggleProps {
  user: AdminUser;
  isSelf: boolean;
  currentRole: string;
  busy: boolean;
  onAsk: (user: AdminUser, suspend: boolean) => void;
}

/** Suspend / reactivate: same reach as role changes (a president handles members only) */
function SuspendToggle({ user, isSelf, currentRole, busy, onAsk }: SuspendToggleProps) {
  if (isSelf || user.is_technical_owner || !assignableRoles(currentRole).includes(user.role as Role)) return null;
  const suspended = !!user.suspended_at;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => onAsk(user, !suspended)}
      className={cn("h-9 shrink-0", !suspended && "text-destructive hover:text-destructive")}
    >
      {suspended ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Ban className="mr-1.5 h-4 w-4" />}
      {suspended ? "Réactiver" : "Suspendre"}
    </Button>
  );
}

interface RoleControlProps {
  user: AdminUser;
  isSelf: boolean;
  currentRole: string;
  busy: boolean;
  onChoose: (user: AdminUser, role: Role) => void;
}

function RoleControl({ user, isSelf, currentRole, busy, onChoose }: RoleControlProps) {
  const options = assignableRoles(currentRole);
  if (isSelf) return <span className="text-xs text-muted-foreground">Votre propre rôle ne peut pas être modifié</span>;
  if (user.is_technical_owner) return <span className="text-xs text-muted-foreground">Protégé (propriétaire technique)</span>;
  if (!options.includes(user.role as Role)) {
    return <span className="text-xs text-muted-foreground">Géré par un administrateur</span>;
  }
  return (
    <Select value={user.role} onValueChange={(v) => onChoose(user, v as Role)} disabled={busy}>
      <SelectTrigger className="h-9 w-full md:w-48" aria-label={`Rôle de ${user.name || user.email}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function UsersTab({ users, currentUserId, currentRole, onChange }: UsersTabProps) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ user: AdminUser; role: Role } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [suspension, setSuspension] = useState<{ user: AdminUser; suspend: boolean } | null>(null);
  // Admins: remove the authenticator of someone who lost their phone and recovery codes
  const [tfaReset, setTfaReset] = useState<AdminUser | null>(null);
  const canResetTfa = (u: AdminUser) => currentRole === "admin" && !!u.two_factor && !u.is_technical_owner && u.id !== currentUserId;
  const applyTfaReset = async () => {
    if (!tfaReset) return;
    const target = tfaReset;
    setTfaReset(null);
    try {
      await twoFactorApi.resetFor(target.id);
      onChange(users.map((u) => (u.id === target.id ? { ...u, two_factor: false } : u)));
      toast.success(`Double authentification retirée : ${target.name || target.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    }
  };
  // Technical owner: handing over to an admin ("" = giving the status up)
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const owner = users.find((u) => u.is_technical_owner) ?? null;
  const iAmOwner = owner?.id === currentUserId;
  const successors = users.filter((u) => u.role === "admin" && !u.suspended_at && u.id !== currentUserId);

  const applyTransfer = async () => {
    if (transferTo === null) return;
    const target = transferTo || null;
    setTransferTo(null);
    try {
      const updated = await adminApi.transferTechnicalOwner(target);
      onChange(users.map((u) => updated.find((x) => x.id === u.id) ?? u));
      toast.success(target ? "Statut de propriétaire technique transféré" : "Vous avez renoncé au statut de propriétaire technique");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfert impossible");
    }
  };

  const applySuspension = async () => {
    if (!suspension) return;
    const { user, suspend } = suspension;
    setSuspension(null);
    setBusyId(user.id);
    try {
      const updated = await adminApi.setSuspension(user.id, suspend);
      onChange(users.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${user.name || user.email} : compte ${suspend ? "suspendu" : "réactivé"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    adminApi
      .getInvitations()
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }, []);

  const revokeInvitation = async () => {
    if (!revoking) return;
    const invitation = revoking;
    setRevoking(null);
    try {
      await adminApi.revokeInvitation(invitation.id);
      setInvitations((list) => list.filter((i) => i.id !== invitation.id));
      toast.success(`Invitation de ${invitation.email} annulée`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible");
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => [u.email, u.name].filter(Boolean).some((v) => v!.toLowerCase().includes(term)));
  }, [users, search]);

  const plurals: Record<string, [string, string]> = {
    member: ["membre", "membres"],
    treasurer: ["trésorier", "trésoriers"],
    accountant: ["comptable", "comptables"],
    president: ["président", "présidents"],
    admin: ["administrateur", "administrateurs"],
  };
  const counts = Object.entries(plurals)
    .map(([r, [one, many]]) => {
      const n = users.filter((u) => u.role === r).length;
      return n ? `${n} ${n > 1 ? many : one}` : null;
    })
    .filter(Boolean);

  const applyRole = async () => {
    if (!pending) return;
    const { user, role } = pending;
    setPending(null);
    setBusyId(user.id);
    try {
      const updated = await adminApi.setUserRole(user.id, role);
      onChange(users.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${user.name || user.email} est maintenant : ${ROLE_LABELS[role].toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible");
    } finally {
      setBusyId(null);
    }
  };

  const choose = (user: AdminUser, role: Role) => {
    if (role !== user.role) setPending({ user, role });
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="mb-4 grid gap-2 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {(["member", "treasurer", "accountant", "president", "admin"] as Role[]).map((r) => (
            <p key={r}>
              <span className="font-semibold text-foreground">{ROLE_LABELS[r]} : </span>
              <span className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
            </p>
          ))}
        </div>

        {owner && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-accent/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
              Propriétaire technique : {owner.name || owner.email}
              {owner.name && <span className="font-normal text-muted-foreground">({owner.email})</span>}
            </p>
            <p className="mt-1 text-muted-foreground">
              Prestataire qui développe et héberge la plateforme, selon le contrat de prestation. Son rôle ne peut être ni
              changé ni suspendu par un autre compte ; lui seul peut transférer ce statut (fin de contrat, passation).
              Toutes ses actions figurent au Journal, comme celles de chacun.
            </p>
            {iAmOwner && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={successors.length === 0} onClick={() => setTransferTo(successors[0]?.id ?? "")}>
                  Transférer à un administrateur
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setTransferTo("")}>
                  Renoncer au statut
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-semibold text-foreground">Donner un accès à l'équipe</p>
            <p className="text-muted-foreground">
              Invitez la personne par email : elle choisit son mot de passe et arrive avec le bon rôle.
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="shrink-0">
            <UserPlus className="mr-2 h-4 w-4" />
            Inviter
          </Button>
        </div>

        {invitations.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Invitations en attente ({invitations.length})
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{inv.name || inv.email}</p>
                    {inv.name && <p className="truncate text-xs text-muted-foreground">{inv.email}</p>}
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Expire le {formatDate(inv.expires_at)}
                  </span>
                  {assignableRoles(currentRole).includes(inv.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRevoking(inv)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Annuler
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un nom ou un email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {users.length} compte{users.length > 1 ? "s" : ""}
          {counts.length > 0 && ` · ${counts.join(" · ")}`}
        </p>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Aucun compte ne correspond à cette recherche.</p>
        ) : (
          <>
            {/* Mobile: one card per account instead of a wide table */}
            <div className="space-y-3 md:hidden">
              {filtered.map((u) => (
                <div key={u.id} className="rounded-lg border border-border p-4">
                  <p className="font-medium text-foreground">{u.name || <span className="italic text-muted-foreground">Sans nom</span>}</p>
                  <p className="break-all text-xs text-muted-foreground">{u.email}</p>
                  <div className="mt-2">
                    <RoleBadge user={u} isSelf={u.id === currentUserId} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Inscrit le {formatDate(u.created_at)} · Dernière connexion : {formatDate(u.last_login)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <div className="min-w-0 flex-1">
                      <RoleControl user={u} isSelf={u.id === currentUserId} currentRole={currentRole} busy={busyId === u.id} onChoose={choose} />
                    </div>
                    <SuspendToggle user={u} isSelf={u.id === currentUserId} currentRole={currentRole} busy={busyId === u.id} onAsk={(user, suspend) => setSuspension({ user, suspend })} />
                  </div>
                  {canResetTfa(u) && (
                    <Button variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs text-muted-foreground" onClick={() => setTfaReset(u)}>
                      Retirer la 2FA (téléphone perdu)
                    </Button>
                  )}
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
                    <TableHead className="text-right">Rôle et accès</TableHead>
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
                        <div className="flex items-center justify-end gap-2">
                          <RoleControl user={u} isSelf={u.id === currentUserId} currentRole={currentRole} busy={busyId === u.id} onChoose={choose} />
                          <SuspendToggle user={u} isSelf={u.id === currentUserId} currentRole={currentRole} busy={busyId === u.id} onAsk={(user, suspend) => setSuspension({ user, suspend })} />
                          {canResetTfa(u) && (
                            <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground" title="Retirer la double authentification (téléphone perdu)" aria-label={`Retirer la double authentification de ${u.name || u.email}`} onClick={() => setTfaReset(u)}>
                              <Smartphone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pending && `${pending.user.name || pending.user.email} : ${ROLE_LABELS[pending.role].toLowerCase()} ?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pending && ROLE_DESCRIPTIONS[pending.role]} Le changement prend effet immédiatement ; la personne doit se
                reconnecter pour voir ou perdre le menu « Tableau de bord ».
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={applyRole}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={suspension !== null} onOpenChange={(open) => !open && setSuspension(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {suspension &&
                  `${suspension.suspend ? "Suspendre" : "Réactiver"} le compte de ${suspension.user.name || suspension.user.email} ?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {suspension?.suspend
                  ? "La personne est déconnectée tout de suite, sur tous ses appareils, et ne peut plus se connecter. Son compte, son rôle et son historique sont conservés : vous pourrez le réactiver."
                  : "La personne pourra de nouveau se connecter, avec le même rôle qu'avant."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={applySuspension}
                className={suspension?.suspend ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              >
                {suspension?.suspend ? "Suspendre" : "Réactiver"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={transferTo !== null} onOpenChange={(open) => !open && setTransferTo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{transferTo ? "Transférer le statut de propriétaire technique ?" : "Renoncer au statut de propriétaire technique ?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {transferTo
                  ? "La personne choisie devient propriétaire technique ; vous restez administrateur, mais votre rôle pourra alors être changé par les autres administrateurs."
                  : "Plus personne n'aura ce statut ; vous restez administrateur, mais votre rôle pourra être changé par les autres administrateurs. À faire lors de la passation prévue au contrat."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {transferTo ? (
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger aria-label="Nouveau propriétaire technique">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {successors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={applyTransfer}>{transferTo ? "Transférer" : "Renoncer"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={tfaReset !== null} onOpenChange={(open) => !open && setTfaReset(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retirer la double authentification de {tfaReset?.name || tfaReset?.email} ?</AlertDialogTitle>
              <AlertDialogDescription>
                À faire seulement si la personne a perdu son téléphone et ses codes de secours, et après avoir vérifié son
                identité (par téléphone ou en personne). Elle est déconnectée, se reconnecte avec son mot de passe et pourra
                réactiver la protection. L'action est inscrite au Journal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={applyTfaReset}>Retirer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler l'invitation de {revoking?.email} ?</AlertDialogTitle>
              <AlertDialogDescription>Le lien envoyé ne fonctionnera plus. Vous pourrez l'inviter à nouveau.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Garder</AlertDialogCancel>
              <AlertDialogAction onClick={revokeInvitation}>Annuler l'invitation</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          currentRole={currentRole}
          onInvited={(inv) => setInvitations((list) => [inv, ...list.filter((i) => i.email !== inv.email)])}
        />
      </CardContent>
    </Card>
  );
}
