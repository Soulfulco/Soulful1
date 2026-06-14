import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, CheckCircle2, RotateCcw, AlertCircle, Building2, User, Plus, X, CreditCard } from "lucide-react";

type Plan = {
  id: number;
  name: string;
  priceGbp: number;
  billingCycle: string;
  description: string;
  features: string[];
  planType: "corporate" | "practitioner";
  maxBookings: number | null;
};

type Draft = {
  name: string;
  priceGbp: string;
  description: string;
  features: string[];
};

function toDraft(p: Plan): Draft {
  return {
    name: p.name,
    priceGbp: String(p.priceGbp),
    description: p.description,
    features: [...p.features],
  };
}

function draftsEqual(a: Draft, b: Draft) {
  return (
    a.name === b.name &&
    a.priceGbp === b.priceGbp &&
    a.description === b.description &&
    a.features.length === b.features.length &&
    a.features.every((f, i) => f === b.features[i])
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(toDraft(plan));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(plan));
  }, [plan]);

  const original = toDraft(plan);
  const changed = !draftsEqual(draft, original);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/subscriptions/${plan.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          priceGbp: draft.priceGbp,
          description: draft.description,
          features: draft.features,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateFeature = (i: number, value: string) =>
    setDraft(d => ({ ...d, features: d.features.map((f, idx) => (idx === i ? value : f)) }));
  const removeFeature = (i: number) =>
    setDraft(d => ({ ...d, features: d.features.filter((_, idx) => idx !== i) }));
  const addFeature = () => setDraft(d => ({ ...d, features: [...d.features, ""] }));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {plan.name}
            {changed && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-normal">unsaved</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            {changed && (
              <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(plan))}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
              </Button>
            )}
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!changed || saveMutation.isPending}>
              {saveMutation.isPending
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
                : saved
                ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Saved!</>
                : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Plan name</label>
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Price (£ / {plan.billingCycle === "annual" ? "year" : "month"})</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.priceGbp}
              onChange={e => setDraft(d => ({ ...d, priceGbp: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={draft.description}
            rows={2}
            className="resize-none text-sm"
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Features</label>
          <div className="space-y-2">
            {draft.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={f} onChange={e => updateFeature(i, e.target.value)} className="text-sm" />
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeFeature(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addFeature}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add feature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPlans() {
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const corporate = plans.filter(p => p.planType === "corporate");
  const practitioner = plans.filter(p => p.planType === "practitioner");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          Subscription Plans
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit the name, price, and features of each plan. Changes update the pricing shown on your public pages instantly.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="corporate" className="w-full">
          <TabsList className="grid w-[360px] grid-cols-2 mb-5">
            <TabsTrigger value="corporate" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Corporate ({corporate.length})
            </TabsTrigger>
            <TabsTrigger value="practitioner" className="flex items-center gap-2">
              <User className="h-4 w-4" /> Practitioner ({practitioner.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="corporate" className="space-y-4">
            {corporate.length ? corporate.map(p => <PlanCard key={p.id} plan={p} />)
              : <p className="text-sm text-muted-foreground py-8 text-center">No corporate plans found.</p>}
          </TabsContent>

          <TabsContent value="practitioner" className="space-y-4">
            {practitioner.length ? practitioner.map(p => <PlanCard key={p.id} plan={p} />)
              : <p className="text-sm text-muted-foreground py-8 text-center">No practitioner plans found.</p>}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
