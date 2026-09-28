// The 14 regions of Senegal (membership form, projects by region)
export const REGIONS = [
  "Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou", "Kolda", "Louga", "Matam",
  "Saint-Louis", "Sédhiou", "Tambacounda", "Thiès", "Ziguinchor",
];

// Departments and main towns of each region, so "Mbour" or "Pikine" is classified too
const PLACES: Record<string, string[]> = {
  Dakar: ["Pikine", "Guédiawaye", "Rufisque", "Keur Massar"],
  Diourbel: ["Bambey", "Mbacké", "Touba"],
  Fatick: ["Foundiougne", "Gossas"],
  Kaffrine: ["Birkelane", "Koungheul", "Malem Hodar"],
  Kaolack: ["Guinguinéo", "Nioro du Rip"],
  Kédougou: ["Salémata", "Saraya"],
  Kolda: ["Médina Yoro Foulah", "Vélingara"],
  Louga: ["Kébémer", "Linguère"],
  Matam: ["Kanel", "Ranérou"],
  "Saint-Louis": ["Dagana", "Podor", "Richard Toll"],
  Sédhiou: ["Bounkiling", "Goudomp"],
  Tambacounda: ["Bakel", "Goudiry", "Koumpentoum"],
  Thiès: ["Mbour", "Tivaouane", "Joal", "Saly", "Pout", "Khombole"],
  Ziguinchor: ["Bignona", "Oussouye"],
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/-/g, " ").toLowerCase();

const PATTERNS = REGIONS.map((region) => ({
  region,
  pattern: new RegExp(`\\b(${[region, ...(PLACES[region] ?? [])].map(normalize).join("|")})\\b`),
}));

/** Region of a project from its free-text location ("Mbour, Sénégal" → "Thiès"), if recognised */
export function regionOf(location: string | null | undefined): string | null {
  if (!location) return null;
  const text = normalize(location);
  return PATTERNS.find(({ pattern }) => pattern.test(text))?.region ?? null;
}
