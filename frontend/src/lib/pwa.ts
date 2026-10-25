import { useEffect, useState } from "react";

// Installable site: the service worker (public/sw.js) and the "Installer l'application" button.
// Android/Chrome offers its own install prompt (kept here until the visitor clicks the button);
// iPhone has none, so the button shows the steps for Safari instead.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // our button asks, not a banner from the browser
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** What the install button can do here: ask the browser (Android), explain Safari's steps (iPhone), or nothing */
export function useInstallApp() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const installed = isStandalone();
  const mode: "prompt" | "ios" | null = installed ? null : deferred ? "prompt" : isIos() ? "ios" : null;

  const install = async () => {
    if (!deferred) return;
    const event = deferred;
    deferred = null;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    notify();
  };

  return { mode, install };
}
