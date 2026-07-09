import { useState } from "react";
import { useCreateCompany, useListSubscriptions, getListSubscriptionsQueryKey, useCreateStripeCheckout, useListPractitionerShowcase, type PractitionerShowcase } from "@workspace/api-client-react";
import { LogoMarquee } from "@/components/LogoMarquee";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Building2, Info, TrendingUp } from "lucide-react";

export default function ForCorporates() {
  const c = useSiteContent();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refetch } = useAuth();

  const { data: plans, isLoading: plansLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() }
  });

  const corporatePlans = plans?.filter(p => p.planType === "corporate") || [];

  const { data: practitioners } = useListPractitionerShowcase();
  const networkPractitioners = practitioners || [];

  const createCompany = useCreateCompany();
  const startCheckout = useCreateStripeCheckout();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);

  const selectedPlan = corporatePlans.find(p => p.id === selectedPlanId);
  const isFreePlan = !!selectedPlan && Number(selectedPlan.priceGbp) === 0 && !selectedPlan.stripePriceId;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    industry: "",
    employeeCount: "",
    contactName: "",
    password: "",
    referralCode: new URLSearchParams(window.location.search).get("ref") ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast({ title: "Select a plan", description: "Please select a subscription plan first.", variant: "destructive" });
      return;
    }

    if (isFreePlan) {
      if (formData.password.length < 8) {
        toast({ title: "Choose a password", description: "Your account password must be at least 8 characters.", variant: "destructive" });
        return;
      }
      setRegistering(true);
      (async () => {
        try {
          const res = await fetch("/api/hr/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: formData.name,
              email: formData.email,
              industry: formData.industry,
              employeeCount: parseInt(formData.employeeCount, 10),
              contactName: formData.contactName,
              password: formData.password,
              planId: selectedPlanId,
              referralCode: formData.referralCode.trim() || undefined,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Registration failed");
          }
          await refetch();
          toast({ title: "Welcome to Soulful!", description: "Your free account is ready." });
          setLocation("/dashboard");
        } catch (err) {
          toast({ title: "Registration failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
        } finally {
          setRegistering(false);
        }
      })();
      return;
    }

    createCompany.mutate({
      data: {
        name: formData.name,
        email: formData.email,
        industry: formData.industry,
        employeeCount: parseInt(formData.employeeCount, 10),
        contactName: formData.contactName,
        referralCode: formData.referralCode.trim() || undefined,
      } as any
    }, {
      onSuccess: (company) => {
        startCheckout.mutate({
          data: {
            planId: selectedPlanId,
            companyId: company.id,
            successPath: "/dashboard",
            cancelPath: "/for-corporates",
          },
        }, {
          onSuccess: (session) => {
            if (session.url) {
              window.location.href = session.url;
            } else {
              toast({ title: "Company registered", description: "Welcome to Soulful! Set up billing from your dashboard." });
              setLocation("/dashboard");
            }
          },
          onError: () => {
            toast({ title: "Company registered", description: "Your account was created, but we couldn't open checkout. You can set up billing from your dashboard.", variant: "destructive" });
            setLocation("/dashboard");
          },
        });
      },
      onError: () => {
        toast({ title: "Registration failed", description: "Please check your details and try again.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="bg-background min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary/5 py-20 text-center border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
            <Building2 className="h-4 w-4" /> For Corporates
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6">
            {c("corp_hero_headline", "Invest in the soul of your company.")}
          </h1>
          <p className="text-xl text-muted-foreground">
            {c("corp_hero_body", "Give your team access to the UK's top wellbeing practitioners — personal trainers, yoga instructors, therapists, coaches, and more — all in one place.")}
          </p>
        </div>
      </div>

      {networkPractitioners.length > 0 && (
        <div className="bg-background py-10 border-b">
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6">
            Practitioners your team gets access to
          </p>
          <LogoMarquee
            items={networkPractitioners.map(p => (
              <PractitionerChip key={p.id} practitioner={p} />
            ))}
          />
        </div>
      )}

      <div className="container mx-auto px-4 max-w-6xl mt-16 space-y-20">

        {/* How the billing works */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-6">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">How Soulful billing works</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your subscription covers <strong className="text-foreground">platform access and a monthly session allowance</strong> — the timetable, booking system, employee portal, and HR dashboard.
                Each plan includes a set number of sessions per month.
                Sessions beyond your included allowance are billed at the same per-session rate.
              </p>
            </div>
          </div>
        </div>

        {/* EAP Comparison */}
        <div>
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-3">Not your typical EAP</p>
            <h2 className="text-3xl font-serif mb-3">Your EAP has 4% utilisation.<br />Soulful is built to hit 40%.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Traditional Employee Assistance Programmes sit unused until someone hits a crisis. Soulful is the proactive layer that keeps employees well before they ever need one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* EAP column */}
            <Card className="border-2 border-border/50 rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/40 pb-4">
                <CardTitle className="text-lg font-serif text-muted-foreground">Typical EAP</CardTitle>
                <CardDescription>The counselling helpline bundled with your health insurance</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <ul className="space-y-3">
                  {[
                    "Crisis-reactive — employees call when things go wrong",
                    "Counselling only — no PT, yoga, massage, or coaching",
                    "Assigned to a practitioner — no choice",
                    "Phone or video only — no in-person sessions",
                    "Call a helpline — no self-service booking",
                    "HR sees nothing — zero utilisation visibility",
                    "Under 5% of employees ever use it",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Soulful column */}
            <Card className="border-2 border-primary rounded-2xl overflow-hidden shadow-md">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-lg font-serif text-primary">Soulful</CardTitle>
                <CardDescription>A proactive wellbeing marketplace your team actually uses</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <ul className="space-y-3">
                  {[
                    "Proactive — ongoing, preventative wellbeing as a daily habit",
                    "8 disciplines — PT, yoga, massage, nutrition, coaching, breathwork & more",
                    "Employees choose who they want, when they want",
                    "In-person, studio, office visit, or virtual — employee's choice",
                    "Self-service booking in seconds via the employee portal",
                    "Live HR dashboard — see utilisation, sessions booked, who hasn't engaged",
                    "Designed to drive utilisation above 40%",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Stat callout */}
          <div className="bg-foreground text-background rounded-2xl px-8 py-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="flex-shrink-0">
              <TrendingUp className="h-12 w-12 text-primary mx-auto md:mx-0" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-serif font-bold mb-1">
                Soulful doesn't replace your EAP — it means employees never need to call it.
              </p>
              <p className="text-background/70 text-sm leading-relaxed">
                Regular PT sessions, yoga, and coaching keep stress, burnout, and absenteeism low. The EAP is still there for crises. Soulful is the reason crises happen less often.
              </p>
            </div>
          </div>
        </div>

        {/* Plans + Registration form */}
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Plans */}
          <div>
            <h2 className="text-2xl font-serif mb-2">Choose your plan</h2>
            <p className="text-muted-foreground text-sm mb-8">Platform access fee + included sessions. Scale your session budget as your team grows.</p>

            <div className="space-y-5">
              {plansLoading ? (
                <div className="animate-pulse space-y-5">
                  <div className="h-64 bg-muted rounded-2xl" />
                  <div className="h-64 bg-muted rounded-2xl" />
                  <div className="h-64 bg-muted rounded-2xl" />
                </div>
              ) : (
                corporatePlans.map(plan => {
                  const isSelected = selectedPlanId === plan.id;
                  // Extract per-session rate from features
                  const sessionFeature = plan.features?.find((f: string) => f.includes("sessions/month included"));
                  const rateFeature = plan.features?.find((f: string) => f.includes("Additional sessions"));
                  return (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all border-2 rounded-2xl overflow-hidden ${isSelected ? "border-primary shadow-md" : "border-border/50 hover:border-primary/50 hover:shadow-sm"}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <CardHeader className={`${isSelected ? "bg-primary/5" : "bg-muted/30"} pb-4`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="font-serif text-xl">{plan.name}</CardTitle>
                            <CardDescription className="mt-1 text-xs leading-relaxed">{plan.description}</CardDescription>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            {Number(plan.priceGbp) === 0 ? (
                              <span className="text-2xl font-serif font-bold text-foreground">Free</span>
                            ) : (
                              <>
                                <span className="text-2xl font-serif font-bold text-foreground">£{plan.priceGbp}</span>
                                <span className="text-muted-foreground text-sm">/mo</span>
                              </>
                            )}
                          </div>
                        </div>
                        {sessionFeature && rateFeature && (
                          <div className="mt-3 flex gap-3">
                            <div className="flex-1 bg-primary/10 rounded-lg px-3 py-2 text-center">
                              <p className="text-xs text-primary font-semibold">{sessionFeature.replace(" included", "")}</p>
                            </div>
                            <div className="flex-1 bg-background rounded-lg px-3 py-2 text-center border">
                              <p className="text-xs text-muted-foreground">{rateFeature}</p>
                            </div>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pt-5">
                        <ul className="space-y-2.5">
                          {plan.features?.filter((f: string) => !f.includes("sessions/month included") && !f.includes("Additional sessions")).map((feature: string, i: number) => (
                            <li key={i} className="flex items-start gap-3 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Example cost breakdown */}
            {selectedPlanId && (() => {
              const plan = corporatePlans.find(p => p.id === selectedPlanId);
              if (!plan) return null;
              const rateFeature = plan.features?.find((f: string) => f.includes("Additional sessions at"));
              const rate = rateFeature ? parseInt(rateFeature.match(/£(\d+)/)?.[1] || "0") : 0;
              const includedFeature = plan.features?.find((f: string) => f.includes("sessions/month included"));
              const included = includedFeature ? parseInt(includedFeature) : 0;
              if (!rate || !included) return null;
              const extra = 10;
              const total = plan.priceGbp + (extra * rate);
              return (
                <div className="mt-5 bg-muted/50 rounded-xl p-4 text-sm space-y-2">
                  <p className="font-medium text-foreground">Example monthly cost</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{plan.name} platform fee</span>
                    <span>£{plan.priceGbp}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{included} included sessions</span>
                    <span className="text-primary">Included</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{extra} additional sessions × £{rate}</span>
                    <span>£{extra * rate}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground border-t pt-2 mt-2">
                    <span>Total</span>
                    <span>£{total}/mo</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Registration form */}
          <div>
            <Card className="rounded-3xl border-none shadow-lg bg-card sticky top-24">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-serif">Create your corporate account</CardTitle>
                <CardDescription>Setup takes less than two minutes.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      required
                      className="bg-background h-11"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="contactName">Admin Contact Name</Label>
                      <Input
                        id="contactName"
                        required
                        className="bg-background h-11"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Admin Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        className="bg-background h-11"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input
                        id="industry"
                        required
                        className="bg-background h-11"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="employeeCount">Total Employees</Label>
                      <Input
                        id="employeeCount"
                        type="number"
                        required
                        min="1"
                        className="bg-background h-11"
                        value={formData.employeeCount}
                        onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="referralCode">Referral Code (optional)</Label>
                    <Input
                      id="referralCode"
                      className="bg-background h-11"
                      placeholder="e.g. AB12CD3"
                      value={formData.referralCode}
                      onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {isFreePlan && (
                    <div className="grid gap-2">
                      <Label htmlFor="password">Create a Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="bg-background h-11"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">You'll log in with your admin email and this password.</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-full text-base mt-4"
                    disabled={createCompany.isPending || startCheckout.isPending || registering || !selectedPlanId}
                  >
                    {createCompany.isPending || startCheckout.isPending || registering ? "Creating account..." : selectedPlanId ? (isFreePlan ? "Create free account" : "Complete Registration") : "Select a plan first"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PractitionerChip({ practitioner }: { practitioner: PractitionerShowcase }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2.5 shadow-sm">
      {practitioner.avatarUrl ? (
        <img
          src={practitioner.avatarUrl}
          alt={practitioner.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-serif text-sm font-semibold">
          {initialsOf(practitioner.name)}
        </div>
      )}
      <div className="pr-1">
        <p className="text-sm font-medium text-foreground whitespace-nowrap leading-tight">
          {practitioner.name}
        </p>
        <p className="text-xs text-muted-foreground whitespace-nowrap leading-tight capitalize">
          {practitioner.specialism}
        </p>
      </div>
    </div>
  );
}
