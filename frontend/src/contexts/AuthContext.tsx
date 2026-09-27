import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api, AuthUser } from "@/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Extend the server session (sliding idle timeout). False if it had already expired. */
  keepAlive: () => Promise<boolean>;
}

// Where the token used to be stored before sessions moved to an httpOnly cookie
const LEGACY_TOKEN_KEY = "amanah_auth_token";

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // The session cookie is httpOnly: ask the server who is logged in
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Storage unavailable: nothing to clean
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await api.register(email, password, name);
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout(); // the server deletes the cookie
    } finally {
      setUser(null);
    }
  }, []);

  const keepAlive = useCallback(async () => {
    try {
      const me = await api.getMe(); // any authenticated request slides the session
      setUser(me);
      return me !== null;
    } catch {
      return true; // network hiccup: don't log the user out for that
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, keepAlive }}>
      {children}
    </AuthContext.Provider>
  );
}
