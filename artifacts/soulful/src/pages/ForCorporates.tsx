import { useState } from "react";
import { useCreateCompany, useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Building2 } from "lucide-react";

export default function ForCorporates() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: plans, isLoading: plansLoading } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey() }
  });
  
  const corporatePlans = plans?.filter(p => p.planType === 'corporate') || [];
  
  const createCompany = useCreateCompany();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    industry: "",
    employeeCount: "",
    contactName: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast({ title: "Select a plan", description: "Please select a subscription plan first.", variant: "destructive" });
      return;
    }

    createCompany.mutate({
      data: {
        name: formData.name,
        email: formData.email,
        industry: formData.industry,
        employeeCount: parseInt(formData.employeeCount, 10),
        contactName: formData.contactName,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Company registered", description: "Welcome to Soulful! You can now access your dashboard." });
        setLocation("/dashboard");
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
          <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6">Invest in the soul of your company.</h1>
          <p className="text-xl text-muted-foreground">
            Provide your team with a curated directory of the UK's top wellbeing practitioners. Increase retention, creativity, and resilience.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl mt-16">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left col: Plans */}
          <div>
            <h2 className="text-2xl font-serif mb-8">Choose your plan</h2>
            
            <div className="space-y-6">
              {plansLoading ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-64 bg-muted rounded-2xl"></div>
                  <div className="h-64 bg-muted rounded-2xl"></div>
                </div>
              ) : (
                corporatePlans.map(plan => (
                  <Card 
                    key={plan.id} 
                    className={`cursor-pointer transition-all border-2 rounded-2xl overflow-hidden ${selectedPlanId === plan.id ? 'border-primary shadow-md' : 'border-border/50 hover:border-primary/50 hover:shadow-sm'}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <CardHeader className={`${selectedPlanId === plan.id ? 'bg-primary/5' : 'bg-muted/30'} pb-4`}>
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
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Right col: Form */}
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
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, contactName: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, employeeCount: e.target.value})}
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-full text-base mt-4" 
                    disabled={createCompany.isPending || !selectedPlanId}
                  >
                    {createCompany.isPending ? "Creating account..." : selectedPlanId ? "Complete Registration" : "Select a plan first"}
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
