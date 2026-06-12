import { useState, useEffect } from "react";
import { useListPractitioners, useListCompanies } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, MapPin, Clock, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import { format } from "date-fns";

const SESSION_TYPES = [
  "Yoga", "Meditation", "Breathwork", "Sound Healing",
  "Nutrition Workshop", "Mindfulness", "Pilates", "Life Coaching",
  "Mental Health Talk", "Movement & Mobility",
];

const DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "60 minutes", minutes: 60 },
  { label: "90 minutes", minutes: 90 },
  { label: "120 minutes", minutes: 120 },
];

const LOCATION_TYPES = [
  { value: "at_office", label: "At your office" },
  { value: "virtual", label: "Virtual / online" },
  { value: "practitioner_space", label: "Practitioner's studio" },
];

interface GroupSession {
  id: number;
  company_id: number;
  company_name: string;
  practitioner_id: number;
  practitioner_name: string;
  practitioner_specialism: string;
  session_type: string;
  start_time: string;
  end_time: string;
  max_attendees: number;
  attendee_count: number;
  location_type: string;
  location_description: string | null;
  notes: string | null;
  status: string;
}

interface Attendee {
  id: number;
  employee_name: string;
  employee_email: string;
  signed_up_at: string;
}

const EMPTY_FORM = {
  companyId: "",
  practitionerId: "",
  sessionType: "",
  date: "",
  startTime: "",
  durationMinutes: "60",
  maxAttendees: "20",
  locationType: "at_office",
  locationDescription: "",
  notes: "",
};

export default function DashboardGroupSessions() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<Record<number, Attendee[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: practitioners } = useListPractitioners({});
  const { data: companies } = useListCompanies();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/group-sessions");
      if (res.ok) setSessions(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const fetchAttendees = async (id: number) => {
    if (attendees[id]) return;
    try {
      const res = await fetch(`/api/group-sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAttendees(prev => ({ ...prev, [id]: data.attendees ?? [] }));
      }
    } catch {}
  };

  const handleToggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchAttendees(id);
    }
  };

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.practitionerId || !form.sessionType || !form.date || !form.startTime) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`);
      const endTime = new Date(startTime.getTime() + Number(form.durationMinutes) * 60000);

      const res = await fetch("/api/group-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(form.companyId),
          practitionerId: Number(form.practitionerId),
          sessionType: form.sessionType,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          maxAttendees: Number(form.maxAttendees),
          locationType: form.locationType,
          locationDescription: form.locationDescription || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Group session scheduled", description: "Employees can now sign up from their portal." });
      setForm(EMPTY_FORM);
      setOpen(false);
      fetchSessions();
    } catch {
      toast({ title: "Error", description: "Could not schedule the session.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const locationLabel = (type: string) =>
    LOCATION_TYPES.find(l => l.value === type)?.label ?? type;

  const statusColor = (status: string) =>
    status === "confirmed" ? "bg-primary/10 text-primary border-primary/20"
    : status === "cancelled" ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Group Sessions</h1>
          <p className="text-muted-foreground text-sm">Schedule workplace wellbeing sessions that employees can sign up to.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Schedule Session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Schedule a Group Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company <span className="text-destructive">*</span></Label>
                  <Select value={form.companyId} onValueChange={v => handleChange("companyId", v)}>
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      {companies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Practitioner <span className="text-destructive">*</span></Label>
                  <Select value={form.practitionerId} onValueChange={v => handleChange("practitionerId", v)}>
                    <SelectTrigger><SelectValue placeholder="Select practitioner" /></SelectTrigger>
                    <SelectContent>
                      {practitioners?.filter(p => p.isActive).map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} — {p.specialism}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Session Type <span className="text-destructive">*</span></Label>
                <Select value={form.sessionType} onValueChange={v => handleChange("sessionType", v)}>
                  <SelectTrigger><SelectValue placeholder="e.g. Yoga, Meditation..." /></SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
                  <Input id="date" type="date" value={form.date} onChange={e => handleChange("date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Start Time <span className="text-destructive">*</span></Label>
                  <Input id="startTime" type="time" value={form.startTime} onChange={e => handleChange("startTime", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select value={form.durationMinutes} onValueChange={v => handleChange("durationMinutes", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map(d => <SelectItem key={d.minutes} value={String(d.minutes)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxAttendees">Max Attendees</Label>
                  <Input id="maxAttendees" type="number" min="1" max="200" value={form.maxAttendees} onChange={e => handleChange("maxAttendees", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={form.locationType} onValueChange={v => handleChange("locationType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="locationDescription">Location Details</Label>
                <Input id="locationDescription" placeholder="e.g. Floor 3 boardroom, or Zoom link" value={form.locationDescription} onChange={e => handleChange("locationDescription", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes for employees</Label>
                <Textarea id="notes" placeholder="What to bring, what to wear, etc." rows={2} value={form.notes} onChange={e => handleChange("notes", e.target.value)} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Practitioner</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => (
                      <TableCell key={j}><div className="h-6 bg-muted animate-pulse rounded w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No group sessions yet. Schedule one above.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map(session => (
                  <>
                    <TableRow key={session.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium text-sm">{session.session_type}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {locationLabel(session.location_type)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{session.practitioner_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {session.company_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{format(new Date(session.start_time), "EEE d MMM")}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(session.start_time), "h:mm a")} – {format(new Date(session.end_time), "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{session.attendee_count}</span>
                          <span className="text-xs text-muted-foreground">/ {session.max_attendees}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${statusColor(session.status)}`}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleExpand(session.id)} className="text-xs h-8">
                          Attendees {expandedId === session.id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === session.id && (
                      <TableRow key={`${session.id}-attendees`} className="bg-muted/20">
                        <TableCell colSpan={7} className="py-3 px-6">
                          {!attendees[session.id] ? (
                            <div className="text-sm text-muted-foreground">Loading...</div>
                          ) : attendees[session.id].length === 0 ? (
                            <div className="text-sm text-muted-foreground italic">No sign-ups yet.</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {attendees[session.id].map(a => (
                                <div key={a.id} className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 text-sm">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                    {a.employee_name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-medium text-xs">{a.employee_name}</div>
                                    <div className="text-xs text-muted-foreground">{a.employee_email}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
