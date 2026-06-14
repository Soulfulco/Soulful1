import { useState } from "react";
import { useCreatePractitioner, useListSubscriptions, getListSubscriptionsQueryKey, useCreateStripeCheckout, useListCompanyShowcase, type CompanyShowcase } from "@workspace/api-client-react";
import { LogoMarquee } from "@/components/LogoMarquee";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/PhotoUpload";

const SPECIALISMS = [
  "yoga", "meditation", "nutrition", "massage", "coaching", "breathwork", "sound healing"
];

export default function ForPractitioners() {
  const c = useSiteContent();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: plans, isLoading: plansLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() }
  });
  
  const practitionerPlans = plans?.filter(p => p.planType === 'practitioner') || [];

  const { data: companies } = useListCompanyShowcase();
  const partnerCompanies = companies || [];

  const createPractitioner = useCreatePractitioner();
  const startCheckout = useCreateStripeCheckout();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    specialism: "",
    bio: "",
    sessionRateGbp: "",
    location: "",
    qualifications: "",
    avatarUrl: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast({ title: "Select a plan", description: "Please select a listing plan first.", variant: "destructive" });
      return;
    }
    if (!formData.specialism) {
      toast({ title: "Select a specialism", description: "Please choose your primary specialism.", variant: "destructive" });
      return;
    }

    createPractitioner.mutate({
      data: {
        name: formData.name,
        email: formData.email,
        specialism: formData.specialism,
        bio: formData.bio,
        sessionRateGbp: parseInt(formData.sessionRateGbp, 10),
        location: formData.location,
        qualifications: formData.qualifications,
        avatarUrl: formData.avatarUrl || undefined,
      }
    }, {
      onSuccess: (practitioner) => {
        startCheckout.mutate({
          data: {
            planId: selectedPlanId,
            practitionerId: practitioner.id,
            successPath: "/dashboard",
            cancelPath: "/for-practitioners",
          },
        }, {
          onSuccess: (session) => {
            if (session.url) {
              window.location.href = session.url;
            } else {
              toast({ title: "Application submitted", description: "Your profile is pending review. Set up billing from your dashboard." });
              setLocation("/dashboard");
            }
          },
          onError: () => {
            toast({ title: "Application submitted", description: "Your profile was created, but we couldn't open checkout. You can set up billing from your dashboard.", variant: "destructive" });
            setLocation("/dashboard");
          },
        });
      },
      onError: () => {
        toast({ title: "Submission failed", description: "Please check your details and try again.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="bg-background min-h-screen pb-24">
      {/* Header */}
      <div className="bg-secondary/5 py-20 text-center border-b border-secondary/10">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-medium mb-6">
            <User className="h-4 w-4" /> For Practitioners
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6">{c("prac_hero_headline", "Focus on healing, not marketing.")}</h1>
          <p className="text-xl text-muted-foreground">
            {c("prac_hero_body", "Join our curated directory to get your services in front of engaged corporate clients looking for exactly what you offer.")}
          </p>
        </div>
      </div>

      {partnerCompanies.length > 0 && (
        <div className="bg-background py-10 border-b border-secondary/10">
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6">
            Companies we work with
          </p>
          <LogoMarquee
            items={partnerCompanies.map(co => (
              <CompanyChip key={co.id} company={co} />
            ))}
          />
        </div>
      )}

      <div className="container mx-auto px-4 max-w-6xl mt-16">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left col: Plans */}
          <div>
            <h2 className="text-2xl font-serif mb-8">Listing Plans</h2>
            
            <div className="space-y-6">
              {plansLoading ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-64 bg-muted rounded-2xl"></div>
                </div>
              ) : (
                practitionerPlans.map(plan => (
                  <Card 
                    key={plan.id} 
                    className={`cursor-pointer transition-all border-2 rounded-2xl overflow-hidden ${selectedPlanId === plan.id ? 'border-secondary shadow-md' : 'border-border/50 hover:border-secondary/50 hover:shadow-sm'}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <CardHeader className={`${selectedPlanId === plan.id ? 'bg-secondary/5' : 'bg-muted/30'} pb-4`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="font-serif text-xl">{plan.name}</CardTitle>
                          <CardDescription className="mt-1">{plan.description}</CardDescription>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-serif font-bold text-foreground">£{plan.priceGbp}</span>
                          <span className="text-muted-foreground text-sm">/mo</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            
            <div className="mt-12 bg-muted/50 p-6 rounded-2xl border border-border/50">
              <h3 className="font-serif text-lg mb-4">Why join Soulful?</h3>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p><strong className="text-foreground">Keep 100% of your rate.</strong> We charge a flat monthly listing fee, not a percentage of your hard-earned session fee.</p>
                <p><strong className="text-foreground">High intent clients.</strong> Corporate employees have a wellbeing allowance ready to spend on your services.</p>
                <p><strong className="text-foreground">Automated booking.</strong> Our built-in calendar system means less back-and-forth email scheduling.</p>
              </div>
            </div>

            {/* Already listed CTA */}
            <div className="mt-6 bg-secondary/20 border border-secondary/30 p-6 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c("prac_already_listed_title", "Already a Soulful practitioner?")}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {c("prac_already_listed_body", "Pitch a group session directly to corporate clients — no cold outreach needed. We'll match you to the right company and schedule it for you.")}
                  </p>
                  <Button asChild size="sm" className="mt-3 rounded-full" variant="default">
                    <a href="/propose-session">Propose a session →</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right col: Form */}
          <div>
            <Card className="rounded-3xl border-none shadow-lg bg-card">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-serif">Apply to join</CardTitle>
                <CardDescription>Tell us about your practice.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        required
                        className="bg-background h-11"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        required
                        className="bg-background h-11"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="specialism">Primary Specialism</Label>
                      <Select value={formData.specialism} onValueChange={(val) => setFormData({...formData, specialism: val})}>
                        <SelectTrigger className="bg-background h-11" id="specialism">
                          <SelectValue placeholder="Select specialism" />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALISMS.map(spec => (
                            <SelectItem key={spec} value={spec} className="capitalize">{spec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sessionRateGbp">Session Rate (£)</Label>
                      <Input 
                        id="sessionRateGbp" 
                        type="number" 
                        required
                        min="1"
                        className="bg-background h-11"
                        value={formData.sessionRateGbp}
                        onChange={(e) => setFormData({...formData, sessionRateGbp: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location">Location (City, UK)</Label>
                    <Input 
                      id="location" 
                      className="bg-background h-11"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="e.g. London, or Remote"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="qualifications">Qualifications & Certifications</Label>
                    <Input 
                      id="qualifications" 
                      className="bg-background h-11"
                      value={formData.qualifications}
                      onChange={(e) => setFormData({...formData, qualifications: e.target.value})}
                      placeholder="e.g. 500h YTT, BSc Nutrition"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bio">Professional Bio</Label>
                    <Textarea 
                      id="bio" 
                      required
                      className="bg-background min-h-[120px]"
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      placeholder="Tell potential clients about your approach, experience, and what to expect in a session..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Profile Photo</Label>
                    <PhotoUpload value={formData.avatarUrl} onChange={(url) => setFormData({...formData, avatarUrl: url})} />
                    <p className="text-xs text-muted-foreground">A friendly headshot helps clients connect with you (JPG or PNG, up to 5MB).</p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-full text-base mt-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground" 
                    disabled={createPractitioner.isPending || startCheckout.isPending || !selectedPlanId}
                  >
                    {createPractitioner.isPending || startCheckout.isPending ? "Submitting..." : selectedPlanId ? "Submit Application" : "Select a plan first"}
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

function CompanyChip({ company }: { company: CompanyShowcase }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-5 py-3 shadow-sm">
      {company.logoUrl ? (
        <img
          src={company.logoUrl}
          alt={company.name}
          className="h-9 w-9 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary font-serif text-sm font-bold">
          {initialsOf(company.name)}
        </div>
      )}
      <span className="font-serif text-lg text-foreground whitespace-nowrap">
        {company.name}
      </span>
    </div>
  );
}
