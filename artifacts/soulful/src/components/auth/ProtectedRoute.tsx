import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePractitioner?: boolean;
};

export default function ProtectedRoute({ children, requireAdmin = false, requirePractitioner = false }: Props) {
  const { isAuthenticated, isAdminUser, isPractitionerUser, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(requirePractitioner ? "/practitioner/login" : "/dashboard/login");
    } else if (requirePractitioner && !isPractitionerUser) {
      navigate("/practitioner/login");
    } else if (requireAdmin && !isAdminUser) {
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdminUser, isPractitionerUser, requireAdmin, requirePractitioner, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requirePractitioner && !isPractitionerUser) return null;
  if (requireAdmin && !isAdminUser) return null;

  return <>{children}</>;
}
