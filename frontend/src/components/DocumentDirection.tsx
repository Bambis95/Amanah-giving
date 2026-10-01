import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isRtl, useI18n } from "@/i18n";

// Pages that stay in French whatever the chosen language (team, sign-in, legal texts, print material)
const FRENCH_ONLY = ["/admin", "/login", "/forgot-password", "/reset-password", "/invitation", "/mon-espace", "/confidentialite", "/conditions", "/affiche", "/stand", "/adherer/imprimer", "/desabonnement"];

/** Mirrors the page (dir="rtl") for Arabic, except on the pages that are only in French */
export default function DocumentDirection() {
  const { lang } = useI18n();
  const { pathname } = useLocation();

  useEffect(() => {
    const frenchOnly = FRENCH_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    document.documentElement.dir = isRtl(lang) && !frenchOnly ? "rtl" : "ltr";
  }, [lang, pathname]);

  return null;
}
