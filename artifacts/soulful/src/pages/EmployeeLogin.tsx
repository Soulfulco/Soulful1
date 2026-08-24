import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Leaf } from "lucide-react";

export default function EmployeeLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState(() => {
    try {
      const stored = localStorage.getItem("soulful_employee");
      if (stored) return JSON.parse(stored).email ?? "";
    } catch {
      /* ignore */
    }
    return "";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Employees are scoped by company, but we don't ask for the invite
      // code again here — look up their existing record by email alone
      // to find which company they belong to before logging in.
      const lookupRes = await fetch(`https://api.soulfulco.uk/api/employees/lookup?email=${encodeURIComponent(email)}`);
      if (!lookupRes.ok) {
        throw new Error("No account found with that email. Have you joined with your invite code yet?");
      }
      const { companyId } = await lookupRes.json();

      const res = await fetch("https://api.soulfulco.uk/api/employees/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Login failed");
      }
      localStorage.setItem(
        "soulful_employee",
        JSON.stringify({ id: data.user.id.replace("employee:", ""), companyId, name: data.user.firstName, email }),
      );
      navigate("/employee");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Soulful</h1>
          <p className="text-muted-foreground text-sm mt-1">Employee Portal</p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardDescription className="text-xs text-muted-foreground">
              Sign in to access your wellbeing sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.co.uk"
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
                Sign in
              </Button>
            </form>
            <p className="text-center text-sm mt-4">
              <Link href="/forgot-password?type=employee" className="text-muted-foreground hover:underline">
                Forgot password?
              </Link>
            </p>
            <p className="text-center text-sm mt-2 text-muted-foreground">
              New here?{" "}
              <Link href="/join" className="text-primary underline underline-offset-4 hover:no-underline">
                Join with your invite code
              </Link>
            </p>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Soulful. All rights reserved.
        </p>
      </div>
    </div>
  );
}
