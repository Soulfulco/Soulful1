import { useEffect, useRef, useState, useCallback } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileText, CheckCircle2, Clock, AlertCircle, HelpCircle, Download, BarChart3 } from "lucide-react";
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
  fileUrl: string;
  fileName: string;
  uploadedBy: string | null;
  uploadedAt: string;
}

const STATUS_CONFIG: Record<RequirementStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  on_track: { label: "On track", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due_soon: { label: "Due soon", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  no_data: { label: "Not started", className: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

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
  const inputRef = useRef<HTMLInputElement>(null);

  const uploaderName = hrSession?.user
    ? [hrSession.user.firstName, hrSession.user.lastName].filter(Boolean).join(" ") || hrSession.user.email
    : user?.email ?? "HR Team";

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res) => {
      if (!companyId) return;
      const fileUrl = `/api/storage${res.objectPath}`;
      const response = await fetch("/api/wellbeing/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, fileUrl, fileName: res.metadata.name, uploadedBy: uploaderName }),
      });
      if (response.ok) {
        const saved = await response.json();
        setPlan(saved);
        toast({ title: "Action plan uploaded", description: "The agreed wellbeing action plan is now available to HR." });
      } else {
        toast({ title: "Couldn't save the plan", description: "Please try again.", variant: "destructive" });
      }
    },
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const loadPlan = useCallback(() => {
    if (!companyId) return;
    setLoadingPlan(true);
    fetch(`/api/wellbeing/action-plan/${companyId}`)
      .then((r) => r.json())
      .then(setPlan)
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Please upload a PDF or Word document.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose a file under 10MB.", variant: "destructive" });
      return;
    }
    await uploadFile(file);
  };

  const markComplete = async (employeeId: number, key: string) => {
    setMarkingKey(`${employeeId}-${key}`);
    try {
      const res = await fetch(`/api/employees/${employeeId}/wellbeing-requirements/${key}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordedBy: uploaderName }),
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
            Upload the agreed action plan and track completion of the base engagement requirements
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
              <CardTitle className="text-base font-serif">Agreed Action Plan</CardTitle>
              <CardDescription className="text-xs">
                Upload the wellbeing action plan agreed with this company (PDF or Word document)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlan ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {plan ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <a href={plan.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1">
                          {plan.fileName} <Download className="h-3 w-3" />
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(parseISO(plan.uploadedAt), "d MMM yyyy")}{plan.uploadedBy ? ` by ${plan.uploadedBy}` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No action plan uploaded yet.</p>
                  )}
                  <div>
                    <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFile} />
                    <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
                      {isUploading ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-1.5" /> {plan ? "Replace plan" : "Upload plan"}</>
                      )}
                    </Button>
                  </div>
                </div>
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
