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

type AuthContextType = {
  user: AuthUser | null;
  hrSession: HrSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHrUser: boolean;
  isAdminUser: boolean;
  loginWithReplit: () => void;
  logout: () => Promise<void>;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hrSession, setHrSession] = useState<HrSession | null>(null);
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
      } else {
        setHrSession(null);
      }
    } catch {
      setUser(null);
      setHrSession(null);
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

  const logout = useCallback(async () => {
    const isHr = user?.id?.startsWith("hr:");
    if (isHr) {
      await fetch("/api/hr/logout", { method: "POST", credentials: "include" });
      setUser(null);
      setHrSession(null);
      window.location.href = "/dashboard/login";
    } else {
      window.location.href = "/api/logout";
    }
  }, [user]);

  const isHrUser = !!hrSession;
  const isAdminUser = !!user && !user.id.startsWith("hr:");

  return (
    <AuthContext.Provider value={{
      user,
      hrSession,
      isLoading,
      isAuthenticated: !!user,
      isHrUser,
      isAdminUser,
      loginWithReplit,
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
