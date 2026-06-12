import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

export default function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const { isAuthenticated, isAdminUser, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/dashboard/login");
    } else if (requireAdmin && !isAdminUser) {
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdminUser, requireAdmin, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requireAdmin && !isAdminUser) return null;

  return <>{children}</>;
}
