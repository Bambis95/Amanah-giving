import { useQuery } from "@tanstack/react-query";
import { getSiteSettings, SiteSettings } from "@/api";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/contact";

// Shown until the settings arrive, or if they cannot be loaded: the values the site was built with
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  contact_email: CONTACT_EMAIL,
  contact_phones: CONTACT_PHONES,
  whatsapp_number: CONTACT_PHONES[0],
  facebook_url: null,
  instagram_url: null,
  tiktok_url: null,
  youtube_url: null,
  hero_subtitle: null,
  membership_fee: null,
  membership_fee_label: "Cotisation annuelle",
  announcement: null,
  announcement_link: null,
};

export const SITE_SETTINGS_KEY = ["site-settings"];

/** Contacts, social links and home texts set by admins in Tableau de bord > Réglages du site */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery({ queryKey: SITE_SETTINGS_KEY, queryFn: getSiteSettings, staleTime: 5 * 60_000, retry: 1 });
  return data ?? DEFAULT_SITE_SETTINGS;
}

/** wa.me link for a displayed number ("+221 78 571 82 81" → "https://wa.me/221785718281") */
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
