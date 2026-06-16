import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

export type HrSession = {
  user: AuthUser;
  companyId: number;
  companyName: string;
  role: string;
};

export type PractitionerSession = {
  id: number;
  name: string;
  email: string;
  specialism: string;
  avatarUrl: string | null;
  isActive: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  hrSession: HrSession | null;
  practitionerSession: PractitionerSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHrUser: boolean;
  isAdminUser: boolean;
  isPractitionerUser: boolean;
  loginWithReplit: () => void;
  loginPractitioner: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hrSession, setHrSession] = useState<HrSession | null>(null);
  const [practitionerSession, setPractitionerSession] = useState<PractitionerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuthState = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const authUser: AuthUser | null = data.user ?? null;
      setUser(authUser);

      if (authUser?.id?.startsWith("hr:")) {
        setPractitionerSession(null);
        const hrRes = await fetch("/api/hr/me", { credentials: "include" });
        if (hrRes.ok) {
          const hrData = await hrRes.json();
          setHrSession({
            user: authUser,
            companyId: hrData.companyId,
            companyName: hrData.companyName,
            role: hrData.role,
          });
        }
      } else if (authUser?.id?.startsWith("pract:")) {
        setHrSession(null);
        const pRes = await fetch("/api/practitioner/me", { credentials: "include" });
        if (pRes.ok) {
          setPractitionerSession((await pRes.json()) as PractitionerSession);
        }
      } else {
        setHrSession(null);
        setPractitionerSession(null);
      }
    } catch {
      setUser(null);
      setHrSession(null);
      setPractitionerSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthState();
  }, [fetchAuthState]);

  const loginWithReplit = useCallback(() => {
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/+$/, "") || "";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base + "/dashboard")}`;
  }, []);

  const loginPractitioner = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/practitioner/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Login failed");
    }
    await fetchAuthState();
  }, [fetchAuthState]);

  const logout = useCallback(async () => {
    const id = user?.id ?? "";
    if (id.startsWith("hr:")) {
      await fetch("/api/hr/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setHrSession(null);
      window.location.href = "/dashboard/login";
    } else if (id.startsWith("pract:")) {
      await fetch("/api/practitioner/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setPractitionerSession(null);
      window.location.href = "/practitioner/login";
    } else {
      window.location.href = "/api/logout";
    }
  }, [user]);

  const isHrUser = !!hrSession;
  const isPractitionerUser = !!practitionerSession;
  const isAdminUser = !!user && !user.id.startsWith("hr:") && !user.id.startsWith("pract:");

  return (
    <AuthContext.Provider value={{
      user,
      hrSession,
      practitionerSession,
      isLoading,
      isAuthenticated: !!user,
      isHrUser,
      isAdminUser,
      isPractitionerUser,
      loginWithReplit,
      loginPractitioner,
      logout,
      refetch: fetchAuthState,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
