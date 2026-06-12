import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

export default function DashboardLogin() {
  const { loginWithReplit, refetch } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"replit" | "hr">("hr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleHrLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/hr/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      await refetch();
      navigate("/dashboard");
    } catch {
      setError("Network error – please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src="/images/logo.png" alt="Soulful" className="h-12 w-12 rounded-xl mx-auto mb-3 object-cover" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Soulful</h1>
          <p className="text-muted-foreground text-sm mt-1">Corporate Wellbeing Platform</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex rounded-lg border p-1 gap-1">
              <button
                onClick={() => setTab("hr")}
                className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${tab === "hr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                HR Portal
              </button>
              <button
                onClick={() => setTab("replit")}
                className={`flex-1 text-sm py-1.5 rounded-md transition-colors font-medium ${tab === "replit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Soulful Admin
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {tab === "hr" ? (
              <form onSubmit={handleHrLogin} className="space-y-4">
                <CardDescription className="text-xs text-muted-foreground mb-2">
                  Log in with your company HR credentials
                </CardDescription>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="hr@yourcompany.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Sign in to HR Portal
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <CardDescription className="text-xs text-muted-foreground">
                  Soulful platform administrators sign in with their Replit account
                </CardDescription>
                <Button className="w-full" onClick={loginWithReplit}>
                  Sign in with Replit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Soulful. All rights reserved.
        </p>
      </div>
    </div>
  );
}
