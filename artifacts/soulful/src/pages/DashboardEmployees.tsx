import { useState } from "react";
import {
  useListCompanies, getListCompaniesQueryKey,
  useListCompanyEmployees, getListCompanyEmployeesQueryKey,
  useGetCompanyUtilisation, getGetCompanyUtilisationQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, Calendar, Copy, CheckCheck } from "lucide-react";
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

export default function DashboardEmployees() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);

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
              <p className="text-sm mt-1">Share the invite code above to get started.</p>
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
