import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api, AuthUser, LoginCodeChallenge } from "@/api";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  /** The signed-in user, or the code step for presidents and admins */
  login: (email: string, password: string) => Promise<AuthUser | LoginCodeChallenge>;
  loginWithCode: (challenge: string, code: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  /** Create the invited account (role set by the invitation) and open its session */
  acceptInvitation: (token: string, password: string, name?: string) => Promise<AuthUser>;
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
    if ("code_required" in result) return result; // presidents and admins: second step
    setUser(result.user);
    return result.user;
  }, []);

  const loginWithCode = useCallback(async (challenge: string, code: string) => {
    const result = await api.loginWithCode(challenge, code);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await api.register(email, password, name);
      const result = await login(email, password);
      // A new account is a donor account: it never needs a code
      if ("code_required" in result) throw new Error("Compte créé : connectez-vous pour continuer");
      return result;
    },
    [login]
  );

  const acceptInvitation = useCallback(async (token: string, password: string, name?: string) => {
    const result = await api.acceptInvitation(token, password, name);
    setUser(result.user);
    return result.user;
  }, []);

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
    <AuthContext.Provider value={{ user, loading, login, loginWithCode, register, acceptInvitation, logout, keepAlive }}>
      {children}
    </AuthContext.Provider>
  );
}
