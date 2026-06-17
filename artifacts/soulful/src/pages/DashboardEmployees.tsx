import { useState } from "react";
import {
  useListCompanies, getListCompaniesQueryKey,
  useListCompanyEmployees, getListCompanyEmployeesQueryKey,
  useGetCompanyUtilisation, getGetCompanyUtilisationQueryKey,
  useRegisterEmployee, useBulkCreateEmployees,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, Calendar, Copy, CheckCheck, UserPlus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INVITE_CODES: Record<string, string> = {
  "Meridian Capital": "MERIDIAN24",
  "Bloom Agency": "BLOOMAGENCY24",
  "Vertex Legal": "VERTEX24",
  "NovaTech Solutions": "NOVATECHSOLUTIONS24",
  "The Forge Studios": "THEFORGESTUDIOS24",
};

function UtilisationBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-primary" : pct >= 40 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Utilisation rate</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type ParsedRow = { name: string; email: string; sessionAllowancePerMonth?: number };

function parseEmployeeList(raw: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,\t;]/).map(p => p.trim());
    const lower = parts.map(p => p.toLowerCase());
    // Skip an obvious header row
    if (lower.includes("name") && lower.includes("email")) continue;
    let name = "";
    let email = "";
    let allowance: number | undefined;
    const emailIdx = parts.findIndex(p => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
    if (emailIdx === -1) continue;
    email = parts[emailIdx];
    name = parts.filter((_, i) => i !== emailIdx).find(p => p && !/^\d+$/.test(p)) || "";
    const allowancePart = parts.find((p, i) => i !== emailIdx && /^\d+$/.test(p));
    if (allowancePart) allowance = parseInt(allowancePart);
    if (!name || !email) continue;
    rows.push({ name, email, ...(allowance ? { sessionAllowancePerMonth: allowance } : {}) });
  }
  return rows;
}

function AddEmployeeDialog({ companyId, onDone }: { companyId: number; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [allowance, setAllowance] = useState("2");
  const register = useRegisterEmployee();

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Missing details", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    register.mutate(
      { data: { name: name.trim(), email: email.trim(), companyId, sessionAllowancePerMonth: parseInt(allowance) || 2 } },
      {
        onSuccess: () => {
          toast({ title: "Employee added", description: `${name.trim()} can now book sessions.` });
          setName(""); setEmail(""); setAllowance("2");
          setOpen(false);
          onDone();
        },
        onError: () => toast({ title: "Could not add employee", description: "Please try again.", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><UserPlus className="h-4 w-4" /> Add employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Add an employee</DialogTitle>
          <DialogDescription>Create a single employee account for this company.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="emp-name">Full name</Label>
            <Input id="emp-name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-email">Work email</Label>
            <Input id="emp-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-allowance">Monthly session allowance</Label>
            <Input id="emp-allowance" type="number" min="1" value={allowance} onChange={e => setAllowance(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={register.isPending}>
            {register.isPending ? "Adding…" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportEmployeesDialog({ companyId, onDone }: { companyId: number; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const bulk = useBulkCreateEmployees();

  const parsed = parseEmployeeList(text);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setText(prev => (prev.trim() ? prev + "\n" : "") + content);
  };

  const submit = () => {
    if (parsed.length === 0) {
      toast({ title: "Nothing to import", description: "Add at least one valid name and email.", variant: "destructive" });
      return;
    }
    bulk.mutate(
      { id: companyId, data: { employees: parsed } },
      {
        onSuccess: (result) => {
          const parts = [`${result.created} added`];
          if (result.skipped) parts.push(`${result.skipped} skipped (duplicates)`);
          if (result.invalid?.length) parts.push(`${result.invalid.length} invalid`);
          toast({ title: "Import complete", description: parts.join(", ") + "." });
          setText("");
          setOpen(false);
          onDone();
        },
        onError: () => toast({ title: "Import failed", description: "Please check your list and try again.", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Upload className="h-4 w-4" /> Import list</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Import a list of employees</DialogTitle>
          <DialogDescription>
            Paste contacts (one per line) or upload a CSV. Format: <span className="font-mono">Name, email, allowance</span> — allowance is optional (defaults to 2).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Textarea
            rows={8}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"Jane Smith, jane@company.com, 3\nTom Lee, tom@company.com\nPriya Patel, priya@company.com, 2"}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="text-sm text-primary cursor-pointer hover:underline">
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }}
              />
            </label>
            <span className="text-xs text-muted-foreground">
              {parsed.length} valid {parsed.length === 1 ? "contact" : "contacts"} detected
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={bulk.isPending || parsed.length === 0}>
            {bulk.isPending ? "Importing…" : `Import ${parsed.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardEmployees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hrSession, isAdminUser } = useAuth();
  const [copiedCode, setCopiedCode] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(
    hrSession?.companyId ?? 1
  );

  const { data: companies } = useListCompanies({ query: { queryKey: getListCompaniesQueryKey() } });

  const { data: employees, isLoading: isLoadingEmployees } = useListCompanyEmployees(
    selectedCompanyId,
    { query: { queryKey: getListCompanyEmployeesQueryKey(selectedCompanyId), enabled: !!selectedCompanyId } }
  );

  const { data: utilisation } = useGetCompanyUtilisation(
    selectedCompanyId,
    { query: { queryKey: getGetCompanyUtilisationQueryKey(selectedCompanyId), enabled: !!selectedCompanyId } }
  );

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
  const inviteCode = selectedCompany ? INVITE_CODES[selectedCompany.name] || "" : "";

  const refreshEmployees = () => {
    queryClient.invalidateQueries({ queryKey: getListCompanyEmployeesQueryKey(selectedCompanyId) });
    queryClient.invalidateQueries({ queryKey: getGetCompanyUtilisationQueryKey(selectedCompanyId) });
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/join`;
    navigator.clipboard.writeText(`${url} — Code: ${inviteCode}`);
    setCopiedCode(inviteCode);
    toast({ title: "Invite link copied", description: `Share code ${inviteCode} with your team.` });
    setTimeout(() => setCopiedCode(""), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground mb-1">Employee Wellbeing</h1>
          <p className="text-muted-foreground">Monitor usage and manage employee access by company.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdminUser && (
            <Select
              value={String(selectedCompanyId)}
              onValueChange={v => setSelectedCompanyId(Number(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies?.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AddEmployeeDialog companyId={selectedCompanyId} onDone={refreshEmployees} />
          <ImportEmployeesDialog companyId={selectedCompanyId} onDone={refreshEmployees} />
        </div>
      </div>

      {/* Stats */}
      {utilisation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{utilisation.totalEmployees}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{utilisation.activeThisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {utilisation.totalEmployees} employees
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sessions Booked</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold">{utilisation.sessionsBooked}</div>
              <p className="text-xs text-muted-foreground mt-1">of {utilisation.totalAllowance} available</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Utilisation</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <UtilisationBar value={utilisation.utilisationRate ?? 0} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite banner */}
      {inviteCode && (
        <Card className="border-none shadow-sm bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-sm">Invite your team</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Share this code with employees so they can self-register at <span className="font-mono">/join</span>
              </p>
            </div>
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-2 bg-background border rounded-lg px-4 py-2.5 text-sm font-mono hover:border-primary/50 transition-colors"
            >
              <span className="tracking-widest font-semibold text-primary">{inviteCode}</span>
              {copiedCode === inviteCode
                ? <CheckCheck className="h-4 w-4 text-primary" />
                : <Copy className="h-4 w-4 text-muted-foreground" />
              }
            </button>
          </CardContent>
        </Card>
      )}

      {/* Employee table */}
      <Card className="border-none shadow-sm bg-card">
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-serif text-lg">
            {selectedCompany?.name} — Employees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingEmployees ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (employees?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No employees registered yet.</p>
              <p className="text-sm mt-1">Use “Add employee” or “Import list” above to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {employees?.map(emp => {
                const remaining = emp.sessionAllowancePerMonth - emp.sessionsUsedThisMonth;
                const pct = emp.sessionAllowancePerMonth > 0
                  ? Math.round((emp.sessionsUsedThisMonth / emp.sessionAllowancePerMonth) * 100)
                  : 0;
                return (
                  <div key={emp.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="hidden sm:block text-right">
                        <p className="text-xs text-muted-foreground">{emp.sessionsUsedThisMonth}/{emp.sessionAllowancePerMonth} sessions</p>
                        <div className="h-1.5 w-20 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 60 ? "bg-primary" : "bg-primary/40"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant={emp.sessionsUsedThisMonth === 0 ? "outline" : emp.sessionsUsedThisMonth >= emp.sessionAllowancePerMonth ? "destructive" : "default"} className="text-xs">
                        {emp.sessionsUsedThisMonth === 0 ? "No sessions" : remaining === 0 ? "Fully used" : `${remaining} left`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
