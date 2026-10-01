import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import fr, { Dictionary } from "./fr";
import en from "./en";
import wo from "./wo";
import ar from "./ar";

export type { Dictionary };

export type Lang = "fr" | "en" | "wo" | "ar";
export const LANGS: Lang[] = ["fr", "en", "wo", "ar"];
const DICTIONARIES: Record<Lang, Dictionary> = { fr, en, wo, ar };
/** Languages written right to left: the whole page is mirrored (dir="rtl") */
export const isRtl = (lang: Lang) => lang === "ar";
const STORAGE_KEY = "senjapo-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as string[]).includes(saved)) return saved as Lang;
  } catch {
    // storage blocked: fall through to the browser language
  }
  // French unless the browser asks for English (diaspora) or Arabic; Wolof is always an explicit choice
  const browser = navigator.language?.toLowerCase() ?? "";
  if (browser.startsWith("en")) return "en";
  if (browser.startsWith("ar")) return "ar";
  return "fr";
}

const I18nContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: Dictionary }>({
  lang: "fr",
  setLang: () => {},
  t: fr,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // the choice then only lasts for this visit
    }
  };

  return <I18nContext.Provider value={{ lang, setLang, t: DICTIONARIES[lang] }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** Locale for dates and numbers; Wolof readers are used to the French formats */
export const dateLocale = (lang: Lang) => (lang === "en" ? "en-GB" : lang === "ar" ? "ar-u-nu-latn" : "fr-FR");
