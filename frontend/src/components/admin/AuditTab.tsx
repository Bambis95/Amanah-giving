import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, FolderOpen, HandCoins, Landmark, Loader2, Mail, Settings, ShieldAlert, Users } from "lucide-react";
import { adminApi, AuditCategory, AuditLogEntry } from "@/api";
import { formatDate } from "./format";

const categories: { value: AuditCategory | "all"; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "project", label: "Campagnes" },
  { value: "donation", label: "Dons" },
  { value: "finance", label: "Finances" },
  { value: "message", label: "Messages" },
  { value: "user", label: "Utilisateurs" },
  { value: "setting", label: "Paramètres" },
  { value: "security", label: "Sécurité" },
];

const categoryIcons: Record<string, React.ElementType> = {
  project: FolderOpen,
  donation: HandCoins,
  finance: Landmark,
  message: Mail,
  user: Users,
  setting: Settings,
  security: ShieldAlert,
};

const fieldLabels: Record<string, string> = {
  title: "Titre",
  description: "Description",
  image: "Image",
  category: "Catégorie",
  icon: "Icône",
  raised: "Collecté",
  goal: "Objectif",
  donors: "Donateurs",
  location: "Lieu",
  urgent: "Urgent",
  is_featured: "Mis en avant",
  status: "Statut",
  is_read: "Lu",
  role: "Rôle",
  name: "Nom",
  email: "Email",
  subject: "Sujet",
  compte_existant: "Compte existant",
  gallery: "Galerie",
  kind: "Type",
  entry_date: "Date",
  amount: "Montant",
  label: "Libellé",
  project_id: "Campagne",
  payment_method: "Moyen de paiement",
  reference: "Référence",
  document_id: "Justificatif",
  total: "Total",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value);
  return String(value);
}

type Change = { avant: unknown; apres: unknown };
const isChange = (v: unknown): v is Change => typeof v === "object" && v !== null && "avant" in v && "apres" in v;

function Details({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  const isDiff = entries.every(([, v]) => isChange(v));
  return (
    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs overflow-x-auto">
      <table className="w-full">
        <tbody>
          {entries.map(([field, value]) => (
            <tr key={field} className="align-top">
              <td className="py-1 pr-4 text-muted-foreground whitespace-nowrap">{fieldLabels[field] ?? field}</td>
              {isDiff && isChange(value) ? (
                <td className="py-1 text-foreground/80">
                  <span className="line-through text-destructive/80">{formatValue(value.avant)}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-primary font-medium">{formatValue(value.apres)}</span>
                </td>
              ) : (
                <td className="py-1 text-foreground/80 break-words">{formatValue(value)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Entry({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const category = entry.action.split(".")[0];
  const Icon = categoryIcons[category] ?? Settings;
  const security = category === "security";
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <div className={`rounded-lg border p-4 ${security ? "border-warning/30 bg-warning/5" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            security ? "bg-warning/15 text-warning" : "bg-accent text-primary"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground break-words">{entry.summary}</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">
            {formatDate(entry.created_at)} · {entry.actor_email ?? "Système"}
            {entry.ip_address ? ` · IP ${entry.ip_address}` : ""}
          </p>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              {open ? "Masquer le détail" : "Voir le détail"}
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
          {open && hasDetails && <Details details={entry.details!} />}
        </div>
      </div>
    </div>
  );
}

export default function AuditTab() {
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (beforeId?: number) => {
      setLoading(true);
      setError(null);
      try {
        const page = await adminApi.getAuditLogs(category === "all" ? undefined : category, beforeId);
        setEntries((current) => (beforeId ? [...current, ...page.items] : page.items));
        setNextBeforeId(page.next_before_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chargement impossible");
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === c.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:bg-muted/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Toutes les actions d'administration et les événements de sécurité, du plus récent au plus ancien. Le
          journal ne peut pas être modifié.
        </p>

        {error ? (
          <div className="text-center py-10">
            <p className="text-destructive mb-3">{error}</p>
            <Button variant="outline" onClick={() => load()}>
              Réessayer
            </Button>
          </div>
        ) : entries.length === 0 && !loading ? (
          <p className="text-center text-muted-foreground py-12">Aucune action enregistrée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!loading && nextBeforeId && (
          <div className="text-center mt-4">
            <Button variant="outline" onClick={() => load(nextBeforeId)}>
              Charger les entrées plus anciennes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
