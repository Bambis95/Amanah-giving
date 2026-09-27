import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/*
 * Automatic logout after inactivity, mirroring the server's sliding session
 * (15 min for admins, 60 min for other users: the value comes from the server).
 * - Activity (mouse, keyboard, touch, scroll) in any tab of the site counts.
 * - While the user is active, the server session is extended regularly.
 * - One minute before the end, a dialog offers to stay logged in.
 * The server enforces the same limit, so this is the visible side of a real protection.
 */

const ACTIVITY_KEY = "amanah-last-activity"; // shared between tabs
const WARNING_MS = 60_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;

function readSharedActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export default function SessionTimeout() {
  const { user, logout, keepAlive } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const lastActivity = useRef(Date.now());
  const lastShared = useRef(0);
  const lastPing = useRef(Date.now());
  const warning = useRef(false);
  const endingRef = useRef(false);

  const idleMs = (user?.idle_minutes ?? 60) * 60_000;
  // Extend the server session a few times per idle window while the user is active
  const pingEveryMs = Math.min(5 * 60_000, idleMs / 3);

  const markActive = useCallback((now = Date.now()) => {
    lastActivity.current = now;
    if (now - lastShared.current > 5_000) {
      lastShared.current = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // Storage unavailable: this tab still tracks its own activity
      }
    }
  }, []);

  const endSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    warning.current = false;
    setSecondsLeft(null);
    const from = location.pathname;
    await logout();
    toast.info(`Vous avez été déconnecté après ${Math.round(idleMs / 60_000)} minutes d'inactivité.`);
    navigate("/login", { replace: true, state: { from } });
  }, [logout, navigate, location.pathname, idleMs]);

  const stayLoggedIn = useCallback(async () => {
    warning.current = false;
    setSecondsLeft(null);
    markActive();
    lastPing.current = Date.now();
    if (!(await keepAlive())) endSession();
  }, [keepAlive, markActive, endSession]);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    endingRef.current = false;
    markActive();
    lastPing.current = Date.now();

    // Passive activity is ignored while the warning is shown: staying requires the button
    const onActivity = () => {
      if (!warning.current) markActive();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY && !warning.current) {
        lastActivity.current = Math.max(lastActivity.current, readSharedActivity());
      }
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(async () => {
      const now = Date.now();
      // Another tab may have been active more recently
      lastActivity.current = Math.max(lastActivity.current, readSharedActivity());
      const idle = now - lastActivity.current;

      if (idle >= idleMs) {
        endSession();
      } else if (idle >= idleMs - WARNING_MS) {
        warning.current = true;
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      } else {
        if (warning.current) {
          warning.current = false; // another tab kept the session alive
          setSecondsLeft(null);
        }
        // Recently active: extend the server session so it doesn't expire under the user
        if (idle < 60_000 && now - lastPing.current > pingEveryMs) {
          lastPing.current = now;
          if (!(await keepAlive())) endSession();
        }
      }
    }, 1_000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [userId, idleMs, pingEveryMs, markActive, endSession, keepAlive]);

  if (!user) return null;

  return (
    <AlertDialog open={secondsLeft !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Êtes-vous toujours là ?</AlertDialogTitle>
          <AlertDialogDescription aria-live="polite">
            Pour protéger votre compte, vous serez déconnecté automatiquement dans{" "}
            <span className="font-semibold tabular-nums text-foreground">{secondsLeft} s</span> faute d'activité.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={endSession}>Se déconnecter</AlertDialogCancel>
          <AlertDialogAction onClick={stayLoggedIn}>Rester connecté</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
