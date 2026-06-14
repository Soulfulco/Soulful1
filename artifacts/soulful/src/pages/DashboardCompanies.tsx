import { useState } from "react";
import { useListCompanies, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Plus, Loader2, AlertCircle, Building2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY = {
  name: "", email: "", industry: "", employeeCount: "", contactName: "",
  createHr: false, hrName: "", hrEmail: "", hrPassword: "",
};

function AddCompanyDialog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof EMPTY, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const reset = () => { setForm({ ...EMPTY }); setError(null); };

  const canSubmit =
    form.name.trim() && form.email.trim() && form.industry.trim() && form.employeeCount.trim() &&
    (!form.createHr || (form.hrName.trim() && form.hrEmail.trim() && form.hrPassword.length >= 6));

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          industry: form.industry.trim(),
          employeeCount: Number(form.employeeCount),
          contactName: form.contactName.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Could not create the company. The email may already be in use.");
      const company = await res.json();

      if (form.createHr) {
        const hrRes = await fetch("/api/hr/users", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            name: form.hrName.trim(),
            email: form.hrEmail.trim().toLowerCase(),
            password: form.hrPassword,
          }),
        });
        if (!hrRes.ok) {
          throw new Error("Company was created, but the HR login could not be set up. You can add it later from HR Portal Users.");
        }
      }

      queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      toast({ title: "Company added", description: `${company.name} has been created${form.createHr ? " with an HR login" : ""}.` });
      reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="h-4 w-4 mr-1.5" /> Add Company
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Add a Company
          </DialogTitle>
          <DialogDescription>
            Create a corporate client. Optionally set up their HR login at the same time.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Company name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Acme Ltd" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Company email *</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="hello@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Industry *</Label>
              <Input value={form.industry} onChange={e => set("industry", e.target.value)} placeholder="Finance" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Number of employees *</Label>
              <Input type="number" min="1" value={form.employeeCount} onChange={e => set("employeeCount", e.target.value)} placeholder="250" />
            </div>
            <div className="space-y-1.5">
              <Label>Admin contact name</Label>
              <Input value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Jane Doe" />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <Label className="cursor-pointer">Create an HR login now</Label>
              </div>
              <Switch checked={form.createHr} onCheckedChange={v => set("createHr", v)} />
            </div>
            {form.createHr && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <Label>HR contact name *</Label>
                  <Input value={form.hrName} onChange={e => set("hrName", e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>HR login email *</Label>
                    <Input type="email" value={form.hrEmail} onChange={e => set("hrEmail", e.target.value)} placeholder="jane@acme.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temporary password *</Label>
                    <Input type="text" value={form.hrPassword} onChange={e => set("hrPassword", e.target.value)} placeholder="min. 6 characters" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share these credentials with the HR contact — they sign in via the "HR Portal" tab and can change details later.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); setOpen(false); }} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating…</> : "Create company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardCompanies() {
  const { data: companies, isLoading } = useListCompanies({
    query: { queryKey: getListCompaniesQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Registered Companies</h1>
          <p className="text-muted-foreground text-sm">Corporate clients providing wellbeing services to their teams.</p>
        </div>
        <AddCompanyDialog />
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry / Size</TableHead>
                <TableHead>Admin Contact</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : companies?.length ? (
                companies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium text-sm">{company.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.totalBookings} total bookings</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{company.industry}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.employeeCount} employees</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{company.contactName || "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        company.subscriptionStatus === 'active' ? 'bg-primary/10 text-primary border-primary/20' :
                        company.subscriptionStatus === 'trial' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                        'bg-muted text-muted-foreground'
                      }>
                        {company.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(company.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No companies found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
