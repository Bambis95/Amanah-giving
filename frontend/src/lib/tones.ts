/**
 * Coloured accents used by icon tiles and step badges, mapped to theme tokens so they
 * adapt to light and dark mode (instead of inline hex colours).
 */
export type Tone = "primary" | "highlight" | "info" | "destructive";

/** Soft tile: tinted background, coloured icon or text */
export const softTone: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  highlight: "bg-highlight/15 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

/** Solid badge: filled background with contrasting text */
export const solidTone: Record<Tone, string> = {
  primary: "bg-primary text-primary-foreground",
  highlight: "bg-highlight text-highlight-foreground",
  info: "bg-info text-info-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

/** Coloured text only (e.g. a key figure) */
export const textTone: Record<Tone, string> = {
  primary: "text-primary",
  highlight: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
};
