import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { getSiteSettings, saveSiteSettings, SiteSettings } from "@/api";
import { SITE_SETTINGS_KEY } from "@/hooks/use-site-settings";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Contacts, social links and home texts of the public site, changed without a developer (admins) */
export default function SiteSettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSiteSettings()
      .then(setForm)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);

  if (!form) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const text = (value: string) => value.trim() || null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveSiteSettings({ ...form, contact_phones: form.contact_phones.filter((p) => p.trim()) });
      setForm(saved);
      queryClient.setQueryData(SITE_SETTINGS_KEY, saved); // the whole site shows the new values at once
      toast.success("Réglages enregistrés : ils sont visibles sur le site");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="space-y-5 p-4 md:p-6">
          <h3 className="font-semibold text-foreground">Coordonnées</h3>
          <Field id="set-email" label="Email de contact" hint="Affiché dans le bas de page, la page Contact et les pages légales.">
            <Input id="set-email" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} required />
          </Field>
          <div className="space-y-2">
            <Label>Téléphones</Label>
            {form.contact_phones.map((phone, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Téléphone ${i + 1}`}
                  inputMode="tel"
                  placeholder="+221 77 000 00 00"
                  value={phone}
                  onChange={(e) => set("contact_phones", form.contact_phones.map((p, j) => (j === i ? e.target.value : p)))}
                />
                {form.contact_phones.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("contact_phones", form.contact_phones.filter((_, j) => j !== i))} aria-label={`Retirer le téléphone ${i + 1}`}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {form.contact_phones.length < 4 && (
              <Button type="button" variant="outline" size="sm" onClick={() => set("contact_phones", [...form.contact_phones, ""])}>
                <Plus className="mr-1.5 h-4 w-4" />
                Ajouter un numéro
              </Button>
            )}
          </div>
          <Field id="set-whatsapp" label="Numéro WhatsApp" hint="Lien « Nous écrire sur WhatsApp » du bas de page. Vide = pas de lien.">
            <Input id="set-whatsapp" inputMode="tel" placeholder="+221 78 000 00 00" value={form.whatsapp_number ?? ""} onChange={(e) => set("whatsapp_number", text(e.target.value))} />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="grid gap-5 p-4 sm:grid-cols-2 md:p-6">
          <h3 className="font-semibold text-foreground sm:col-span-2">Réseaux sociaux <span className="font-normal text-muted-foreground">(vide = non affiché)</span></h3>
          {([
            ["facebook_url", "Facebook"],
            ["instagram_url", "Instagram"],
            ["tiktok_url", "TikTok"],
            ["youtube_url", "YouTube"],
          ] as const).map(([key, label]) => (
            <Field key={key} id={`set-${key}`} label={label}>
              <Input id={`set-${key}`} type="url" placeholder="https://…" value={form[key] ?? ""} onChange={(e) => set(key, text(e.target.value))} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="grid gap-5 p-4 sm:grid-cols-2 md:p-6">
          <h3 className="font-semibold text-foreground sm:col-span-2">Cotisation des membres</h3>
          <Field id="set-fee" label="Montant (FCFA)" hint="Payé en ligne sur la page Adhérer. Vide = paiement en ligne non proposé.">
            <Input
              id="set-fee"
              inputMode="numeric"
              placeholder="Ex. : 10000"
              value={form.membership_fee ?? ""}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                set("membership_fee", Number.isFinite(n) ? n : null);
              }}
            />
          </Field>
          <Field id="set-fee-label" label="Intitulé" hint="Ex. : Cotisation annuelle 2026">
            <Input id="set-fee-label" maxLength={60} value={form.membership_fee_label ?? ""} onChange={(e) => set("membership_fee_label", text(e.target.value))} />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-5 p-4 md:p-6">
          <h3 className="font-semibold text-foreground">Page d'accueil</h3>
          <Field id="set-hero" label="Texte sous le titre" hint="Vide = le texte d'origine.">
            <Textarea id="set-hero" rows={3} maxLength={300} value={form.hero_subtitle ?? ""} onChange={(e) => set("hero_subtitle", text(e.target.value))} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
            <Field id="set-announce" label="Bandeau d'annonce" hint="Ex. : Retrouvez-nous à la Foire de Thiès, stand 14. Vide = pas de bandeau.">
              <Input id="set-announce" maxLength={200} value={form.announcement ?? ""} onChange={(e) => set("announcement", text(e.target.value))} />
            </Field>
            <Field id="set-announce-link" label="Lien du bandeau" hint="Une page du site (/projects) ou https://…">
              <Input id="set-announce-link" placeholder="/projects" value={form.announcement_link ?? ""} onChange={(e) => set("announcement_link", text(e.target.value))} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="h-11">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Enregistrer les réglages
        </Button>
      </div>
    </form>
  );
}
