import { useState, useEffect } from "react";
import { useListCompanies } from "@workspace/api-client-react";
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
import { Plus, CalendarDays, Users, MapPin, Download, ChevronDown, ChevronUp, Building2, Clock, CalendarCheck } from "lucide-react";
import { format } from "date-fns";

const EVENT_TYPES = [
  { value: "yoga", label: "🧘 Yoga" },
  { value: "meditation", label: "🌿 Meditation" },
  { value: "walk", label: "🚶 Walk & Talk" },
  { value: "steps", label: "👟 Step Challenge" },
  { value: "workshop", label: "📚 Wellness Workshop" },
  { value: "nutrition", label: "🥗 Nutrition Session" },
  { value: "breathwork", label: "💨 Breathwork Break" },
  { value: "social", label: "☕ Wellbeing Social" },
  { value: "talk", label: "🎙️ Mental Health Talk" },
  { value: "other", label: "✨ Other" },
];

const DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "60 minutes", minutes: 60 },
  { label: "90 minutes", minutes: 90 },
  { label: "2 hours", minutes: 120 },
  { label: "Half day", minutes: 240 },
];

const EMPTY_FORM = {
  companyId: "",
  title: "",
  description: "",
  eventType: "",
  date: "",
  startTime: "",
  durationMinutes: "60",
  location: "",
  locationUrl: "",
  organiserName: "HR Team",
  maxAttendees: "",
};

interface SocialEvent {
  id: number;
  company_id: number;
  company_name: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  location: string;
  location_url: string | null;
  organiser_name: string;
  max_attendees: number | null;
  rsvp_count: number;
  status: string;
}

interface Rsvp {
  id: number;
  employee_name: string;
  employee_email: string;
  created_at: string;
}

export default function DashboardSocialCalendar() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rsvps, setRsvps] = useState<Record<number, Rsvp[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: companies } = useListCompanies();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social-events");
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const fetchRsvps = async (id: number) => {
    if (rsvps[id]) return;
    try {
      const res = await fetch(`/api/social-events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRsvps(prev => ({ ...prev, [id]: data.rsvps ?? [] }));
      }
    } catch {}
  };

  const handleToggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchRsvps(id);
  };

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyId || !form.title || !form.date || !form.startTime || !form.eventType) {
      toast({ title: "Missing fields", description: "Fill in company, title, type, date and time.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`);
      const endTime = new Date(startTime.getTime() + Number(form.durationMinutes) * 60000);
      const res = await fetch("/api/social-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(form.companyId),
          title: form.title,
          description: form.description || null,
          eventType: form.eventType,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          location: form.location,
          locationUrl: form.locationUrl || null,
          organiserName: form.organiserName,
          maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Event added to social calendar", description: "Employees can now opt in and add it to their calendar." });
      setForm(EMPTY_FORM);
      setOpen(false);
      fetchEvents();
    } catch {
      toast({ title: "Error", description: "Could not create event.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await fetch(`/api/social-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      fetchEvents();
    } catch {}
  };

  const downloadIcs = (id: number, title: string) => {
    const a = document.createElement("a");
    a.href = `/api/social-events/${id}/calendar.ics`;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
  };

  const downloadCompanyIcs = (companyId: number) => {
    const a = document.createElement("a");
    a.href = `/api/social-events/company/${companyId}/calendar.ics`;
    a.download = "soulful-wellbeing-calendar.ics";
    a.click();
  };

  const typeLabel = (type: string) =>
    EVENT_TYPES.find(t => t.value === type)?.label ?? type;

  const statusColor = (status: string) =>
    status === "active"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-destructive/10 text-destructive border-destructive/20";

  // Group events by company for the "download all" button
  const companiesInEvents = [...new Map(events.map(e => [e.company_id, e.company_name])).entries()];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Wellbeing Social Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Add events employees can opt into and save to their personal calendar.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {companiesInEvents.map(([id, name]) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => downloadCompanyIcs(id)}
            >
              <Download className="h-3.5 w-3.5" />
              {name} calendar
            </Button>
          ))}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Add Wellbeing Event</DialogTitle>
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
                    <Label>Event type <span className="text-destructive">*</span></Label>
                    <Select value={form.eventType} onValueChange={v => handleChange("eventType", v)}>
                      <SelectTrigger><SelectValue placeholder="Type..." /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title">Event title <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    placeholder="e.g. Monday Mindfulness, Lunchtime Yoga..."
                    value={form.title}
                    onChange={e => handleChange("title", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What's happening, what to bring, who it's for..."
                    rows={2}
                    value={form.description}
                    onChange={e => handleChange("description", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
                    <Input id="date" type="date" value={form.date} onChange={e => handleChange("date", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="startTime">Start time <span className="text-destructive">*</span></Label>
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
                    <Label htmlFor="maxAttendees">Max attendees</Label>
                    <Input
                      id="maxAttendees"
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={form.maxAttendees}
                      onChange={e => handleChange("maxAttendees", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Floor 2 canteen, Zoom, local park..."
                    value={form.location}
                    onChange={e => handleChange("location", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="locationUrl">Link (optional)</Label>
                  <Input
                    id="locationUrl"
                    type="url"
                    placeholder="https://zoom.us/j/..."
                    value={form.locationUrl}
                    onChange={e => handleChange("locationUrl", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="organiserName">Organiser name</Label>
                  <Input
                    id="organiserName"
                    value={form.organiserName}
                    onChange={e => handleChange("organiserName", e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding..." : "Add to Calendar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>RSVPs</TableHead>
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
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-8 w-8 opacity-30" />
                      <p>No events yet. Add one above to start your wellbeing calendar.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                events.map(event => (
                  <>
                    <TableRow key={event.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{typeLabel(event.event_type)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          {event.company_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{format(new Date(event.start_time), "EEE d MMM")}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(event.start_time), "h:mm a")} – {format(new Date(event.end_time), "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{event.location || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{event.rsvp_count}</span>
                          {event.max_attendees && (
                            <span className="text-xs text-muted-foreground">/ {event.max_attendees}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${statusColor(event.status)}`}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Download .ics"
                            onClick={() => downloadIcs(event.id, event.title)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2"
                            onClick={() => handleToggleExpand(event.id)}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" />
                            {expandedId === event.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </Button>
                          {event.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8 text-destructive hover:text-destructive"
                              onClick={() => handleCancel(event.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === event.id && (
                      <TableRow key={`${event.id}-rsvps`} className="bg-muted/20">
                        <TableCell colSpan={7} className="py-3 px-6">
                          {!rsvps[event.id] ? (
                            <span className="text-sm text-muted-foreground">Loading...</span>
                          ) : rsvps[event.id].length === 0 ? (
                            <span className="text-sm text-muted-foreground italic">No RSVPs yet.</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {rsvps[event.id].map(r => (
                                <div key={r.id} className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 text-sm">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                    {r.employee_name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-medium text-xs">{r.employee_name}</div>
                                    <div className="text-xs text-muted-foreground">{r.employee_email}</div>
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
