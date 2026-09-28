import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Download, Loader2, QrCode, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi, Donation } from "@/api";
import PaymentStatusBadge from "./PaymentStatusBadge";
import {
  categoryLabel,
  formatCFA,
  formatDate,
  paymentMethodLabels,
  paymentStatusLabels,
  paymentStatuses,
} from "./format";

function donorName(d: Donation) {
  return [d.donor_first_name, d.donor_last_name].filter(Boolean).join(" ");
}

// Wave / Orange Money deposits made with the QR code, waiting for a check in the operator app
const isPendingDeposit = (d: Donation) => d.payment_provider === "mobile_qr" && d.payment_status === "pending";

function PendingDeposits({ donations, onChange }: { donations: Donation[]; onChange: (donations: Donation[]) => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const pending = donations.filter(isPendingDeposit);
  if (pending.length === 0) return null;

  const decide = async (d: Donation, confirm: boolean) => {
    setBusyId(d.id);
    try {
      const result = confirm ? await adminApi.confirmDeposit(d.id) : await adminApi.rejectDeposit(d.id);
      onChange(donations.map((x) => (x.id === d.id ? { ...x, payment_status: result.payment_status } : x)));
      toast.success(confirm ? "Dépôt confirmé : il est compté dans la campagne" : "Dépôt rejeté");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-highlight/40 bg-highlight/10 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <QrCode className="h-4 w-4" aria-hidden="true" />
        Dépôts par QR code à confirmer ({pending.length})
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Vérifiez chaque transaction dans l'application Wave ou Orange Money du compte officiel avant de la confirmer.
      </p>
      <ul className="space-y-2">
        {pending.map((d) => (
          <li key={d.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {formatCFA(d.amount)} · {paymentMethodLabels[d.payment_method] ?? d.payment_method} · réf.{" "}
                <span className="font-mono">{d.payment_reference}</span>
              </p>
              <p className="text-muted-foreground">
                {[donorName(d) || "Donateur", d.donor_phone, categoryLabel(d.cause), formatDate(d.created_at)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={busyId === d.id} onClick={() => decide(d, true)}>
                {busyId === d.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Confirmer
              </Button>
              <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => decide(d, false)}>
                <X className="mr-1.5 h-4 w-4" />
                Rejeter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// CSV for Excel (French locale): ";" separator, UTF-8 with BOM so accents display correctly
function exportCsv(rows: Donation[]) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Date", "Donateur", "Email", "Téléphone", "Montant (FCFA)", "Cause", "Moyen", "Statut", "Référence"];
  const lines = rows.map((d) => [
    d.created_at ? new Date(d.created_at).toLocaleString("fr-FR") : "",
    donorName(d),
    d.donor_email,
    d.donor_phone,
    d.amount,
    categoryLabel(d.cause),
    paymentMethodLabels[d.payment_method] ?? d.payment_method,
    paymentStatusLabels[d.payment_status] ?? d.payment_status,
    d.payment_reference,
  ].map(cell).join(";"));
  const blob = new Blob(["﻿" + [header.map(cell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dons-senjapo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DonationsTab({
  donations,
  onChange,
  canManage = false,
}: {
  donations: Donation[];
  onChange: (donations: Donation[]) => void;
  /** President / admin: confirms the QR deposits */
  canManage?: boolean;
}) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return donations.filter((d) => {
      if (status !== "all" && d.payment_status !== status) return false;
      if (!term) return true;
      return [donorName(d), d.donor_email, d.donor_phone, d.cause, d.payment_reference]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [donations, status, search]);

  const filteredTotal = filtered.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        {canManage && <PendingDeposits donations={donations} onChange={onChange} />}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un donateur, un email, une cause…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {paymentStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} don{filtered.length > 1 ? "s" : ""} · {formatCFA(filteredTotal)}
          </p>
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Exporter (Excel)
          </Button>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucun don ne correspond à ces critères.</p>
        ) : (
          <>
          {/* Mobile: one card per donation instead of a wide table */}
          <div className="md:hidden space-y-3">
            {filtered.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {donorName(d) || <span className="italic text-muted-foreground">Anonyme</span>}
                    </p>
                    {d.donor_email && <p className="text-xs text-muted-foreground truncate">{d.donor_email}</p>}
                  </div>
                  <p className="font-semibold text-foreground whitespace-nowrap tabular-nums">{formatCFA(d.amount)}</p>
                </div>
                <p className="text-sm text-foreground/80 mt-2">
                  {categoryLabel(d.cause)} · {paymentMethodLabels[d.payment_method] ?? d.payment_method}
                </p>
                {d.message && <p className="text-xs text-muted-foreground italic mt-1">« {d.message} »</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                  <PaymentStatusBadge status={d.payment_status} />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donateur</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Cause</TableHead>
                <TableHead>Moyen</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">
                      {donorName(d) || <span className="italic text-muted-foreground">Anonyme</span>}
                    </p>
                    {d.donor_email && <p className="text-xs text-muted-foreground">{d.donor_email}</p>}
                    {d.message && (
                      <p className="text-xs text-muted-foreground italic mt-1 max-w-xs truncate" title={d.message}>
                        « {d.message} »
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground whitespace-nowrap tabular-nums">
                    {formatCFA(d.amount)}
                  </TableCell>
                  <TableCell>{categoryLabel(d.cause)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {paymentMethodLabels[d.payment_method] ?? d.payment_method}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={d.payment_status} />
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
