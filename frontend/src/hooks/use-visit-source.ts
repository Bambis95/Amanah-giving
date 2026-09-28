import { useSearchParams } from "react-router-dom";

/**
 * Where the visitor came from, from ?source=... (e.g. the QR codes of the Thiès fair stand).
 * Added to campaign proposals, partnership and "keep me informed" requests so the team knows what worked.
 */
export function useVisitSource(): string | null {
  const [params] = useSearchParams();
  const source = params.get("source")?.trim();
  return source ? source.slice(0, 60) : null;
}

export const sourceLine = (source: string | null) => (source ? `Rencontré via : ${source}` : null);
