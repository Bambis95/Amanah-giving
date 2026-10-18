import { getAPIBaseURL } from "./config";

// A JavaScript error in a visitor's browser (blank page, broken button) is sent to the server, so the
// admins see it in Tableau de bord → Santé du système. Only the message, where it happened in the code
// and the page path: never the address's query string, the form contents or who the visitor is.
const MAX_PER_PAGE = 5;
const sent = new Set<string>();

function report(message: string, stack: string) {
  const key = `${message}|${stack.split("\n")[1] ?? ""}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);
  try {
    void fetch(`${getAPIBaseURL()}/api/v1/monitoring/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.slice(0, 1000), stack: stack.slice(0, 8000), page: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // reporting must never break the page
  }
}

export function startErrorReporting() {
  if (import.meta.env.DEV) return;
  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) return; // a picture or script that did not load
    const error = event.error instanceof Error ? event.error : null;
    report(error ? `${error.name}: ${error.message}` : String(event.message), error?.stack ?? `${event.filename}:${event.lineno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    // Network failures are the server being away: the uptime watch covers them
    if (reason instanceof TypeError && /fetch|network|load failed/i.test(reason.message)) return;
    const error = reason instanceof Error ? reason : null;
    report(error ? `${error.name}: ${error.message}` : `Promesse rejetée : ${String(reason).slice(0, 300)}`, error?.stack ?? "");
  });
}
