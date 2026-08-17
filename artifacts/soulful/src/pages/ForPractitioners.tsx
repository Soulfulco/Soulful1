import { useState } from "react";
import { useCreatePractitioner, useListSubscriptions, getListSubscriptionsQueryKey, useListCompanyShowcase, type CompanyShowcase, useListSpecialisms, getListSpecialismsQueryKey } from "@workspace/api-client-react";
import { LogoMarquee } from "@/components/LogoMarquee";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "@/components/PhotoUpload";
import { DocumentUpload } from "@/components/DocumentUpload";

export default function ForPractitioners() {
  const c = useSiteContent();
  const { toast } = useToast();

  const { data: specialismsData } = useListSpecialisms({
    query: { queryKey: getListSpecialismsQueryKey() }
  });
  const SPECIALISMS = (specialismsData ?? []).map((s) => s.name);

  const { data: plans, isLoading: plansLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() }
  });

  const practitionerPlans = plans?.filter(p => p.planType === 'practitioner') || [];

  const { data: companies } = useListCompanyShowcase();
  const partnerCompanies = companies || [];

  const createPractitioner = useCreatePractitioner();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    specialism: "",
    bio: "",
    inPersonRateGbp: "",
    onlineRateGbp: "",
    location: "",
    qualifications: "",
    qualificationsFileUrl: "",
    insuranceFileUrl: "",
    avatarUrl: "",
    password: "",
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
    if (formData.password.length < 8) {
      toast({ title: "Choose a password", description: "Your portal password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    const inPersonRate = formData.inPersonRateGbp ? parseInt(formData.inPersonRateGbp, 10) : undefined;
    const onlineRate = formData.onlineRateGbp ? parseInt(formData.onlineRateGbp, 10) : undefined;
    if (!inPersonRate && !onlineRate) {
      toast({ title: "Add a rate", description: "Enter an in-person rate, an online rate, or both.", variant: "destructive" });
      return;
    }

    createPractitioner.mutate({
      data: {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        specialism: formData.specialism,
        bio: formData.bio,
        sessionRateGbp: (inPersonRate ?? onlineRate)!,
        inPersonRateGbp: inPersonRate,
        onlineRateGbp: onlineRate,
        location: formData.location,
        qualifications: formData.qualifications,
        qualificationsFileUrl: formData.qualificationsFileUrl || undefined,
        insuranceFileUrl: formData.insuranceFileUrl || undefined,
        avatarUrl: formData.avatarUrl || undefined,
        password: formData.password,
      }
    }, {
      onSuccess: () => {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast({ title: "Application received", description: "Thanks! Our team will review your application and arrange a call before your profile goes live." });
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
                <p><strong className="text-foreground">Keep 90% of your rate.</strong> No monthly fee — we only take a small commission when you're actually booked.</p>
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
              {submitted ? (
              <CardContent className="py-16 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-secondary" />
                </div>
                <h2 className="text-2xl font-serif text-foreground">Application received</h2>
                <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Thank you for applying to Soulful. Our team will review your details and reach out to arrange a short call before your profile goes live. Once you're approved, you can sign in to your practitioner portal with the password you just set.
                </p>
                <Button asChild variant="outline" className="rounded-full mt-2">
                  <a href="/">Back to home</a>
                </Button>
              </CardContent>
              ) : (
              <>
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

                  <div className="grid gap-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      required
                      className="bg-background h-11"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      placeholder="07123 456789"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Portal Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="bg-background h-11"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="At least 8 characters"
                    />
                    <p className="text-xs text-muted-foreground">You'll use this to log in to your practitioner portal and manage availability.</p>
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
                      <Label htmlFor="inPersonRateGbp">In-person Rate (£)</Label>
                      <Input 
                        id="inPersonRateGbp" 
                        type="number" 
                        min="1"
                        className="bg-background h-11"
                        value={formData.inPersonRateGbp}
                        onChange={(e) => setFormData({...formData, inPersonRateGbp: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="onlineRateGbp">Online Rate (£)</Label>
                      <Input 
                        id="onlineRateGbp" 
                        type="number" 
                        min="1"
                        className="bg-background h-11"
                        value={formData.onlineRateGbp}
                        onChange={(e) => setFormData({...formData, onlineRateGbp: e.target.value})}
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
                    <Label>Qualification documents</Label>
                    <DocumentUpload
                      label="qualification"
                      value={formData.qualificationsFileUrl}
                      onChange={(url) => setFormData({...formData, qualificationsFileUrl: url})}
                    />
                    <p className="text-xs text-muted-foreground">Certificates or proof of your qualifications (PDF, Word, or image).</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Insurance document</Label>
                    <DocumentUpload
                      label="insurance certificate"
                      value={formData.insuranceFileUrl}
                      onChange={(url) => setFormData({...formData, insuranceFileUrl: url})}
                    />
                    <p className="text-xs text-muted-foreground">Your current professional indemnity / public liability insurance certificate.</p>
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
                    disabled={createPractitioner.isPending || !selectedPlanId}
                  >
                    {createPractitioner.isPending ? "Submitting..." : selectedPlanId ? "Submit Application" : "Select a plan first"}
                  </Button>
                </form>
              </CardContent>
              </>
              )}
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