import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListCompanies } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, addWeeks, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles, Wind, Moon, Flame, Snowflake, Brain,
  Calendar, Clock, Users, MapPin, CheckCircle2, Loader2,
  ChevronRight, AlertCircle, Inbox, ArrowLeft
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles, Wind, Moon, Flame, Snowflake, Brain, Calendar,
};

const LOCATION_OPTIONS = [
  { value: "virtual", label: "Virtual (online)" },
  { value: "at_office", label: "At our office" },
];

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type TemplateSession = {
  id: number;
  sessionType: string;
  specialism: string;
  weekNumber: number;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  description: string | null;
  maxAttendees: number;
};

type Template = {
  id: number;
  name: string;
  description: string;
  theme: string;
  duration_weeks: number;
  icon: string;
  colour: string;
  sessions: TemplateSession[];
};

type BookingRequest = {
  id: number;
  session_type: string;
  specialism: string;
  requested_date: string;
  duration_minutes: number;
  status: string;
  template_name: string | null;
  template_colour: string | null;
  accepted_by_name: string | null;
  company_name: string;
};

function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ["calendar-templates"],
    queryFn: async () => {
      const res = await fetch("/api/calendar-templates");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function useBookingRequests(companyId?: number) {
  return useQuery<BookingRequest[]>({
    queryKey: ["booking-requests", companyId],
    queryFn: async () => {
      const url = companyId ? `/api/booking-requests?companyId=${companyId}` : "/api/booking-requests";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: companyId !== undefined || true,
  });
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: (t: Template) => void }) {
  const Icon = ICON_MAP[template.icon] ?? Sparkles;
  const sessionCount = template.sessions?.length ?? 0;

  return (
    <Card className="hover:shadow-md transition-all cursor-pointer group border-border/50 overflow-hidden" onClick={() => onSelect(template)}>
      <div className="h-1.5 w-full" style={{ backgroundColor: template.colour }} />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: template.colour + "55" }}>
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-tight">{template.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {template.duration_weeks === 1 ? "1 week" : `${template.duration_weeks} weeks`}
              </Badge>
              <span className="text-xs text-muted-foreground">{sessionCount} sessions</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {[...new Set(template.sessions?.map(s => s.specialism) ?? [])].slice(0, 3).map(sp => (
              <span key={sp} className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{sp}</span>
            ))}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleDialog({ template, companyId, onClose, onSuccess }: {
  template: Template;
  companyId?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: companiesData } = useListCompanies();
  const companies = companiesData?.data ?? [];
  const { isAdminUser, hrSession } = useAuth();

  const [selectedCompany, setSelectedCompany] = useState(companyId ? String(companyId) : "");
  const [startDate, setStartDate] = useState("");
  const [locationType, setLocationType] = useState("virtual");
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany || !startDate) throw new Error("Fill in all fields");
      const res = await fetch(`/api/calendar-templates/${template.id}/schedule`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: Number(selectedCompany), startDate, locationType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      onSuccess();
    },
    onError: (err: Error) => setError(err.message),
  });

  // Preview dates
  const previewDates = startDate
    ? (template.sessions ?? []).slice(0, 5).map(s => {
        const weekStart = addWeeks(new Date(startDate), s.weekNumber - 1);
        const d = addDays(weekStart, s.dayOfWeek - 1);
        return { ...s, date: d };
      })
    : [];

  const Icon = ICON_MAP[template.icon] ?? Sparkles;

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: template.colour + "55" }}>
            <Icon className="h-4 w-4 text-foreground/70" />
          </div>
          <div>
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>{template.duration_weeks === 1 ? "1-week" : `${template.duration_weeks}-week`} programme · {template.sessions?.length ?? 0} sessions</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-5 mt-2">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isAdminUser && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Programme start date</label>
            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Format</label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Session preview */}
        <div>
          <p className="text-sm font-medium mb-3">Sessions in this programme</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(template.sessions ?? []).map((s, i) => (
              <div key={s.id ?? i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground border">
                  W{s.weekNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground leading-tight">{s.sessionType}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {DAY_NAMES[s.dayOfWeek]} · {s.startTime} · {s.durationMinutes} min · <span className="capitalize">{s.specialism}</span>
                    {startDate && previewDates[i] && (
                      <span className="text-primary font-medium"> → {format(previewDates[i].date, "d MMM")}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-4 text-sm space-y-1.5">
          <p className="font-semibold text-foreground">What happens when you schedule this</p>
          <p className="text-muted-foreground">Each session becomes an open <strong>booking request</strong> sent to all Soulful practitioners with the matching specialism. The first practitioner to accept each slot confirms it — and it immediately appears in your employees' calendar.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={() => scheduleMutation.mutate()}
            disabled={scheduleMutation.isPending || !startDate || (!selectedCompany && isAdminUser)}
          >
            {scheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Schedule programme
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function ScheduledRequests({ companyId }: { companyId?: number }) {
  const { data: requests = [], isLoading } = useBookingRequests(companyId);

  const open = requests.filter(r => r.status === "open");
  const accepted = requests.filter(r => r.status === "accepted");
  const declined = requests.filter(r => r.status === "declined");

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!requests.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-semibold text-foreground mb-1">No requests yet</p>
      <p className="text-sm text-muted-foreground max-w-xs">Schedule a programme template above and booking requests will be sent out to practitioners automatically.</p>
    </div>
  );

  const statusColour: Record<string, string> = {
    open: "bg-amber-50 text-amber-700 border-amber-200",
    accepted: "bg-green-50 text-green-700 border-green-200",
    declined: "bg-red-50 text-red-700 border-red-200",
  };
  const statusLabel: Record<string, string> = { open: "Awaiting practitioner", accepted: "Confirmed", declined: "Declined" };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <span className="text-sm px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{open.length} awaiting practitioner</span>
        <span className="text-sm px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">{accepted.length} confirmed</span>
        {declined.length > 0 && <span className="text-sm px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">{declined.length} declined</span>}
      </div>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
            {r.template_colour && (
              <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: r.template_colour }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{r.session_type}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {format(new Date(r.requested_date), "EEE d MMM, h:mm a")}
                <span>·</span>
                <span className="capitalize">{r.specialism}</span>
                {r.template_name && <><span>·</span><span className="text-muted-foreground">{r.template_name}</span></>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColour[r.status] ?? ""}`}>
                {statusLabel[r.status] ?? r.status}
              </span>
              {r.accepted_by_name && (
                <p className="text-xs text-muted-foreground mt-1">{r.accepted_by_name}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardCalendarTemplates() {
  const { isAdminUser, hrSession } = useAuth();
  const { data: templates = [], isLoading } = useTemplates();
  const [selected, setSelected] = useState<Template | null>(null);
  const [tab, setTab] = useState<"templates" | "requests">("templates");
  const [scheduled, setScheduled] = useState(false);

  const companyId = hrSession?.user
    ? (hrSession as any).companyId ?? undefined
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Wellbeing Programmes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a ready-made programme and we'll send booking requests to practitioners — they confirm their availability and it lands straight in your calendar.
        </p>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="templates">Programme Templates</TabsTrigger>
          <TabsTrigger value="requests">Booking Requests</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "templates" && (
        <>
          {scheduled && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Programme scheduled! Booking requests have been sent to matching practitioners. Check the <button className="underline font-medium" onClick={() => { setTab("requests"); setScheduled(false); }}>Booking Requests</button> tab to track responses.
              </AlertDescription>
            </Alert>
          )}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map(t => (
                <TemplateCard key={t.id} template={t} onSelect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "requests" && (
        <ScheduledRequests companyId={companyId} />
      )}

      {selected && (
        <Dialog open onOpenChange={open => { if (!open) setSelected(null); }}>
          <ScheduleDialog
            template={selected}
            companyId={companyId}
            onClose={() => setSelected(null)}
            onSuccess={() => { setSelected(null); setTab("templates"); setScheduled(true); }}
          />
        </Dialog>
      )}
    </div>
  );
}
