import { useEffect, useState, useCallback } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, AlertCircle, HelpCircle, BarChart3, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type RequirementStatus = "on_track" | "due_soon" | "overdue" | "no_data";

interface Requirement {
  key: string;
  label: string;
  frequencyLabel: string;
  notes: string;
  autoTracked: boolean;
  lastCompletedAt: string | null;
  status: RequirementStatus;
}

interface EmployeeCompliance {
  employeeId: number;
  employeeName: string;
  requirements: Requirement[];
}

interface ActionPlan {
  id: number;
  companyId: number;
  quarter: string;
  shortTermAbsenceDays: string;
  longTermAbsenceDays: string;
  absenceCostGbp: string | null;
  retentionRatePct: string | null;
  submittedBy: string | null;
  submittedAt: string;
}

const STATUS_CONFIG: Record<RequirementStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  on_track: { label: "On track", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due_soon: { label: "Due soon", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  no_data: { label: "Not started", className: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

// Works out the current calendar quarter as a label like "2026-Q3", used as
// the default quarter HR is submitting figures for.
function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

export default function DashboardWellbeingPlan() {
  const { hrSession, isAdminUser, user } = useAuth();
  const { toast } = useToast();
  const { data: companiesData } = useListCompanies();
  const companies = companiesData?.data ?? [];

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(hrSession?.companyId ?? null);
  const companyId = hrSession?.companyId ?? selectedCompanyId;

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [rows, setRows] = useState<EmployeeCompliance[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [markingKey, setMarkingKey] = useState<string | null>(null);

  const [quarter] = useState(currentQuarter());
  const [shortTermDays, setShortTermDays] = useState("");
  const [longTermDays, setLongTermDays] = useState("");
  const [absenceCost, setAbsenceCost] = useState("");
  const [retentionRate, setRetentionRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitterName = hrSession?.user
    ? [hrSession.user.firstName, hrSession.user.lastName].filter(Boolean).join(" ") || hrSession.user.email
    : user?.email ?? "HR Team";

  const loadPlan = useCallback(() => {
    if (!companyId) return;
    setLoadingPlan(true);
    fetch(`/api/wellbeing/action-plan/${companyId}`)
      .then((r) => r.json())
      .then((data: ActionPlan | null) => {
        setPlan(data);
        // Pre-fill the form if this quarter's figures were already submitted.
        if (data && data.quarter === currentQuarter()) {
          setShortTermDays(data.shortTermAbsenceDays);
          setLongTermDays(data.longTermAbsenceDays);
          setAbsenceCost(data.absenceCostGbp ?? "");
          setRetentionRate(data.retentionRatePct ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlan(false));
  }, [companyId]);

  const loadCompliance = useCallback(() => {
    if (!companyId) return;
    setLoadingRows(true);
    fetch(`/api/companies/${companyId}/wellbeing-requirements`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoadingRows(false));
  }, [companyId]);

  useEffect(() => {
    loadPlan();
    loadCompliance();
  }, [loadPlan, loadCompliance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!shortTermDays.trim() || !longTermDays.trim()) {
      toast({ title: "Missing figures", description: "Short-term and long-term absence days are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/wellbeing/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          quarter,
          shortTermAbsenceDays: Number(shortTermDays),
          longTermAbsenceDays: Number(longTermDays),
          absenceCostGbp: absenceCost.trim() ? Number(absenceCost) : null,
          retentionRatePct: retentionRate.trim() ? Number(retentionRate) : null,
          submittedBy: submitterName,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setPlan(saved);
        toast({ title: "Saved", description: `Figures for ${quarter} have been recorded.` });
      } else {
        toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const markComplete = async (employeeId: number, key: string) => {
    setMarkingKey(`${employeeId}-${key}`);
    try {
      const res = await fetch(`/api/employees/${employeeId}/wellbeing-requirements/${key}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedBy: submitterName }),
      });
      if (res.ok) {
        loadCompliance();
        toast({ title: "Marked as complete" });
      }
    } catch {}
    setMarkingKey(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Wellbeing Action Plan</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quarterly figures showing the impact of your wellbeing programme, plus base engagement tracking
          </p>
        </div>
        {isAdminUser && (
          <Select value={String(selectedCompanyId ?? "")} onValueChange={(v) => setSelectedCompanyId(Number(v))}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!companyId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Select a company</CardTitle>
            <CardDescription>Choose a company above to manage their wellbeing action plan.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">This quarter: {quarter}</CardTitle>
              <CardDescription className="text-xs">
                Enter your latest absence, cost, and retention figures. Submitted every 3 months, reviewed annually
                to show the impact Soulful is having.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlan ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shortTermDays">Short-term absence (days lost)</Label>
                      <Input
                        id="shortTermDays"
                        type="number"
                        min="0"
                        step="0.5"
                        value={shortTermDays}
                        onChange={(e) => setShortTermDays(e.target.value)}
                        placeholder="e.g. 12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longTermDays">Long-term absence (days lost)</Label>
                      <Input
                        id="longTermDays"
                        type="number"
                        min="0"
                        step="0.5"
                        value={longTermDays}
                        onChange={(e) => setLongTermDays(e.target.value)}
                        placeholder="e.g. 20"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="absenceCost">Cost associated with absence (£, optional)</Label>
                      <Input
                        id="absenceCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={absenceCost}
                        onChange={(e) => setAbsenceCost(e.target.value)}
                        placeholder="e.g. 4500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retentionRate">Staff retention rate (%, optional)</Label>
                      <Input
                        id="retentionRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={retentionRate}
                        onChange={(e) => setRetentionRate(e.target.value)}
                        placeholder="e.g. 92"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting} className="gap-1.5">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save {quarter} figures
                  </Button>
                  {plan && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      Last submitted: {plan.quarter}
                      {plan.submittedBy ? ` by ${plan.submittedBy}` : ""}
                      {" on "}{format(parseISO(plan.submittedAt), "d MMM yyyy")}
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">Base Requirement Compliance</CardTitle>
              <CardDescription className="text-xs">
                Sessions and RSVPs booked through Soulful are logged automatically. Use "Mark complete" for
                anything confirmed outside the platform (e.g. a volunteering day or an offered new modality).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRows ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : !rows || rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No active employees for this company yet.</p>
              ) : (
                <div className="space-y-6">
                  {rows.map((row) => (
                    <div key={row.employeeId} className="border rounded-lg p-4">
                      <p className="text-sm font-semibold mb-3">{row.employeeName}</p>
                      <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground border-b">
                              <th className="font-medium py-2 px-2">Activity</th>
                              <th className="font-medium py-2 px-2">Minimum</th>
                              <th className="font-medium py-2 px-2">Last completed</th>
                              <th className="font-medium py-2 px-2">Status</th>
                              <th className="font-medium py-2 px-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {row.requirements.map((req) => {
                              const cfg = STATUS_CONFIG[req.status];
                              const Icon = cfg.icon;
                              const busy = markingKey === `${row.employeeId}-${req.key}`;
                              return (
                                <tr key={req.key}>
                                  <td className="py-2 px-2">
                                    <p className="font-medium">{req.label}</p>
                                    {!req.autoTracked && <p className="text-[11px] text-muted-foreground">Manual only</p>}
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground">{req.frequencyLabel}</td>
                                  <td className="py-2 px-2 text-muted-foreground">
                                    {req.lastCompletedAt ? format(parseISO(req.lastCompletedAt), "d MMM yyyy") : "—"}
                                  </td>
                                  <td className="py-2 px-2">
                                    <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
                                      <Icon className="h-3 w-3" /> {cfg.label}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={busy}
                                      onClick={() => markComplete(row.employeeId, req.key)}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark complete"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
