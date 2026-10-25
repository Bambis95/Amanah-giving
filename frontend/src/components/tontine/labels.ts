// Helpers of the tontine screens (texts: src/i18n/tontine.ts)
import type { TontineGroup, TontineOperation } from "@/api";
import type { TontineText } from "@/i18n/tontine";

/** A payout is called an aid in a mbootaay */
export const opLabel = (tt: TontineText, kind: TontineOperation["kind"], group: TontineGroup) =>
  kind === "payout" && group.kind === "mbootaay" ? tt.ops.aid : tt.ops[kind];

/** Today's date in the visitor's time zone, as the server expects it (YYYY-MM-DD) */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** WhatsApp link with the message already written (Senegalese numbers without +221 get it added) */
export function whatsappLink(phone: string, text: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && /^[37]/.test(digits)) digits = `221${digits}`;
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
