import { useState } from "react";
import { useLocation } from "wouter";
import { useResolveInviteCode, useRegisterEmployee, useLoginEmployee } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf, ArrowRight, CheckCircle2, Building2 } from "lucide-react";
import { Link } from "wouter";

type Step = "code" | "register" | "done";

export default function Join() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [company, setCompany] = useState<{ id: number; name: string; inviteCode: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  const resolveCode = useResolveInviteCode(code.toUpperCase(), {
    query: { enabled: false }
  });

  const registerEmployee = useRegisterEmployee();
  const loginEmployee = useLoginEmployee();

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeError("");
    try {
      const result = await resolveCode.refetch();
      if (result.data) {
        setCompany(result.data as any);
        setStep("register");
      } else {
        setCodeError("That invite code doesn't match any company. Please check and try again.");
      }
    } catch {
      setCodeError("That invite code doesn't match any company. Please check and try again.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !name.trim() || !email.trim()) return;

    if (isReturning) {
      loginEmployee.mutate(
        { data: { email, companyId: company.id } },
        {
          onSuccess: (employee) => {
            localStorage.setItem("soulful_employee", JSON.stringify({ id: employee.id, companyId: employee.companyId, name: employee.name, email: employee.email }));
            navigate("/employee");
          },
          onError: () => {
            setCodeError("No account found with that email for this company.");
          }
        }
      );
    } else {
      registerEmployee.mutate(
        { data: { name, email, companyId: company.id } },
        {
          onSuccess: (employee) => {
            localStorage.setItem("soulful_employee", JSON.stringify({ id: employee.id, companyId: employee.companyId, name: employee.name, email: employee.email }));
            navigate("/employee");
          }
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b flex items-center px-6">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <Leaf className="h-5 w-5" />
          <span className="font-serif text-xl font-bold tracking-tight">Soulful</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">

          {step === "code" && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-3xl font-serif text-foreground">Join your team</h1>
                <p className="text-muted-foreground">
                  Enter the invite code your HR team shared with you to access your wellbeing sessions.
                </p>
              </div>

              <Card className="border-none shadow-md">
                <CardContent className="pt-6">
                  <form onSubmit={handleCodeSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Company invite code</Label>
                      <Input
                        id="code"
                        value={code}
                        onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(""); }}
                        placeholder="e.g. MERIDIAN24"
                        className="text-center text-lg font-mono tracking-widest uppercase h-12"
                        autoComplete="off"
                      />
                      {codeError && <p className="text-sm text-destructive">{codeError}</p>}
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-full text-base"
                      disabled={resolveCode.isLoading || !code.trim()}
                    >
                      {resolveCode.isLoading ? "Checking..." : "Continue"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="bg-muted/50 rounded-2xl p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Demo invite codes</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { code: "MERIDIAN24", label: "Meridian Capital" },
                    { code: "BLOOMAGENCY24", label: "Bloom Agency" },
                    { code: "VERTEX24", label: "Vertex Legal" },
                  ].map(({ code: c, label }) => (
                    <button
                      key={c}
                      onClick={() => setCode(c)}
                      className="text-xs bg-background border rounded-full px-3 py-1.5 hover:border-primary/50 hover:text-primary transition-colors font-mono"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "register" && company && (
            <>
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 rounded-full px-4 py-2 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {company.name}
                </div>
                <h1 className="text-3xl font-serif text-foreground">
                  {isReturning ? "Welcome back" : "Create your account"}
                </h1>
                <p className="text-muted-foreground">
                  {isReturning
                    ? "Enter your work email to access your sessions."
                    : "Set up your employee wellbeing account to start booking sessions."
                  }
                </p>
              </div>

              <Card className="border-none shadow-md">
                <CardContent className="pt-6">
                  <form onSubmit={handleRegister} className="space-y-4">
                    {!isReturning && (
                      <div className="space-y-2">
                        <Label htmlFor="name">Your name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="Your full name"
                          className="h-12"
                          required
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setCodeError(""); }}
                        placeholder="you@company.co.uk"
                        className="h-12"
                        required
                      />
                      {codeError && <p className="text-sm text-destructive">{codeError}</p>}
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-full text-base"
                      disabled={registerEmployee.isPending || loginEmployee.isPending}
                    >
                      {registerEmployee.isPending || loginEmployee.isPending
                        ? "Please wait..."
                        : isReturning ? "Sign in" : "Get started"
                      }
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                {isReturning ? "New to Soulful?" : "Already have an account?"}{" "}
                <button
                  onClick={() => { setIsReturning(!isReturning); setCodeError(""); }}
                  className="text-primary underline underline-offset-4 hover:no-underline"
                >
                  {isReturning ? "Create an account" : "Sign in instead"}
                </button>
              </p>
              <p className="text-center">
                <button
                  onClick={() => { setStep("code"); setCompany(null); setCodeError(""); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change invite code
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
