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
import { Search } from "lucide-react";
import { Donation } from "@/api";
import PaymentStatusBadge from "./PaymentStatusBadge";
import {
  categoryLabels,
  formatCFA,
  formatDate,
  paymentMethodLabels,
  paymentStatuses,
} from "./format";

function donorName(d: Donation) {
  return [d.donor_first_name, d.donor_last_name].filter(Boolean).join(" ");
}

export default function DonationsTab({ donations }: { donations: Donation[] }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return donations.filter((d) => {
      if (status !== "all" && d.payment_status !== status) return false;
      if (!term) return true;
      return [donorName(d), d.donor_email, d.donor_phone, d.cause]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [donations, status, search]);

  const filteredTotal = filtered.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
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

        <p className="text-sm text-[#6B7280] mb-3">
          {filtered.length} don{filtered.length > 1 ? "s" : ""} · {formatCFA(filteredTotal)}
        </p>

        {filtered.length === 0 ? (
          <p className="text-center text-[#6B7280] py-12">Aucun don ne correspond à ces critères.</p>
        ) : (
          <>
          {/* Mobile: one card per donation instead of a wide table */}
          <div className="md:hidden space-y-3">
            {filtered.map((d) => (
              <div key={d.id} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1A1A2E] truncate">
                      {donorName(d) || <span className="italic text-[#6B7280]">Anonyme</span>}
                    </p>
                    {d.donor_email && <p className="text-xs text-[#6B7280] truncate">{d.donor_email}</p>}
                  </div>
                  <p className="font-semibold text-[#1A1A2E] whitespace-nowrap tabular-nums">{formatCFA(d.amount)}</p>
                </div>
                <p className="text-sm text-[#374151] mt-2">
                  {categoryLabels[d.cause] ?? d.cause} · {paymentMethodLabels[d.payment_method] ?? d.payment_method}
                </p>
                {d.message && <p className="text-xs text-[#6B7280] italic mt-1">« {d.message} »</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-[#6B7280]">{formatDate(d.created_at)}</span>
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
                  <TableCell className="whitespace-nowrap text-[#6B7280]">{formatDate(d.created_at)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-[#1A1A2E]">
                      {donorName(d) || <span className="italic text-[#6B7280]">Anonyme</span>}
                    </p>
                    {d.donor_email && <p className="text-xs text-[#6B7280]">{d.donor_email}</p>}
                    {d.message && (
                      <p className="text-xs text-[#6B7280] italic mt-1 max-w-xs truncate" title={d.message}>
                        « {d.message} »
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-[#1A1A2E] whitespace-nowrap tabular-nums">
                    {formatCFA(d.amount)}
                  </TableCell>
                  <TableCell>{categoryLabels[d.cause] ?? d.cause}</TableCell>
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
