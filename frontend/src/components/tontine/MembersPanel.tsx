import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, Loader2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { tontineApi, TontineGroup, TontineMemberRow, TontineRole } from "@/api";
import { formatCFA } from "@/components/admin/format";
import { ROLE_LABELS } from "./labels";
import { cn } from "@/lib/utils";

type Form = { name: string; phone: string; email: string; role: "member" | "treasurer" | "president"; rotation_order: string; joined_at: string; left_at: string };

function MemberDialog({ group, role, member, open, onClose, onSaved }: {
  group: TontineGroup; role: TontineRole; member: TontineMemberRow | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const leader = role === "admin" || role === "president";
  const [form, setForm] = useState<Form>(() => ({
    name: member?.name ?? "", phone: member?.phone ?? "", email: member?.email ?? "", role: member?.role ?? "member",
    rotation_order: member?.rotation_order ? String(member.rotation_order) : "", joined_at: member?.joined_at ?? "", left_at: member?.left_at ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const data = {
      name: form.name, phone: form.phone || null, email: form.email || null, role: form.role,
      rotation_order: form.rotation_order ? Number(form.rotation_order) : null,
      joined_at: form.joined_at || null, left_at: form.left_at || null,
    };
    try {
      if (member) await tontineApi.updateMember(group.id, member.id, data);
      else await tontineApi.addMember(group.id, data);
      toast.success(member ? "Membre modifié" : "Membre ajouté");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? `Modifier ${member.name}` : "Ajouter un membre"}</DialogTitle>
          <DialogDescription>Avec son email, le membre voit ses cotisations en se connectant à SENJAPO avec cette adresse.</DialogDescription>
        </DialogHeader>
        <form id="member-form" onSubmit={submit} className="grid gap-3">
          <div className="space-y-1.5"><Label htmlFor="m-name">Nom</Label><Input id="m-name" required minLength={2} value={form.name} onChange={set("name")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="m-phone">Téléphone</Label><Input id="m-phone" type="tel" value={form.phone} onChange={set("phone")} /></div>
            <div className="space-y-1.5"><Label htmlFor="m-email">Email</Label><Input id="m-email" type="email" value={form.email} onChange={set("email")} /></div>
          </div>
          {leader && (
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Form["role"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="treasurer">Trésorier(ère)</SelectItem>
                  <SelectItem value="president">Président(e)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {group.kind === "rotating" && (
            <div className="space-y-1.5">
              <Label htmlFor="m-order">Rang dans le tour (vide = à la fin)</Label>
              <Input id="m-order" type="number" min={1} value={form.rotation_order} onChange={set("rotation_order")} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="m-joined">Entré(e) le</Label><Input id="m-joined" type="date" value={form.joined_at} onChange={set("joined_at")} /></div>
            {member && <div className="space-y-1.5"><Label htmlFor="m-left">Parti(e) le</Label><Input id="m-left" type="date" value={form.left_at} onChange={set("left_at")} /></div>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="member-form" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Every member's month: paid / owed, what is late, what they get back (savings) or their turn (natt) */
export default function MembersPanel({ group, role, members, onChange }: {
  group: TontineGroup; role: TontineRole; members: TontineMemberRow[]; onChange: () => void;
}) {
  const leader = role === "admin" || role === "president";
  const [editing, setEditing] = useState<TontineMemberRow | null | "new">(null);
  const total = members.reduce((s, m) => s + m.contributed, 0);

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{members.length} membre(s) · {formatCFA(total)} cotisés ce mois</p>
          <Button size="sm" onClick={() => setEditing("new")}><UserPlus className="mr-2 h-4 w-4" />Ajouter un membre</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Cotisé</TableHead>
                <TableHead className="text-right">Retard</TableHead>
                <TableHead className="text-right">{group.kind === "savings" ? "À recevoir" : "Rang"}</TableHead>
                <TableHead className="w-10"><span className="sr-only">Modifier</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className={cn(m.left_at && "opacity-60")}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      {m.name}
                      {m.linked && <Link2 className="h-3.5 w-3.5 text-primary" aria-label="Compte SENJAPO relié" />}
                    </div>
                    {m.role !== "member" && <Badge variant="outline" className="mt-1 text-[11px]">{ROLE_LABELS[m.role]}</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.paid_count}/{m.expected_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCFA(m.contributed)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", m.late > 0 && "font-semibold text-warning")}>{m.late ? formatCFA(m.late) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{group.kind === "savings" ? formatCFA(m.to_receive ?? 0) : m.rotation_order ?? "—"}</TableCell>
                  <TableCell>
                    {(leader || m.role === "member") && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(m)} aria-label={`Modifier ${m.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {editing && (
        <MemberDialog
          key={editing === "new" ? "new" : editing.id}
          group={group}
          role={role}
          member={editing === "new" ? null : editing}
          open
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}
    </Card>
  );
}
