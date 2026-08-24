import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetEmployee, useListEmployeeBookings, getGetEmployeeQueryKey, getListEmployeeBookingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, Clock, User, LogOut, ArrowRight, CheckCircle2, Users, MapPin, Sparkles, Building2, CalendarDays, Download, Settings, Link2, RefreshCw, Unlink } from "lucide-react";
import { format } from "date-fns";
import WellbeingSurvey from "@/components/wellbeing/WellbeingSurvey";
import WellbeingProgress from "@/components/wellbeing/WellbeingProgress";
import WellbeingRequirementsWidget from "@/components/wellbeing/WellbeingRequirementsWidget";
import GamificationWidget from "@/components/gamification/GamificationWidget";
import { useToast } from "@/hooks/use-toast";

interface StoredEmployee {
  id: number;
  companyId: number;
  name: string;
  email: string;
}

interface GroupSession {
  id: number;
  session_type: string;
  start_time: string;
  end_time: string;
  max_attendees: number;
  attendee_count: number;
  location_type: string;
  location_description: string | null;
  practitioner_name: string;
  notes: string | null;
  status: string;
}

interface SocialEvent {
  id: number;
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

const LOCATION_LABELS: Record<string, string> = {
  at_office: "At your office",
  virtual: "Virtual",
  practitioner_space: "Practitioner's studio",
};

const EVENT_TYPE_EMOJI: Record<string, string> = {
  yoga: "🧘", meditation: "🌿", walk: "🚶", steps: "👟",
  workshop: "📚", nutrition: "🥗", breathwork: "💨",
  social: "☕", talk: "🎙️", other: "✨",
};

const THEME_PRESETS: Record<string, { label: string; swatch: string; primary: string; primaryForeground: string }> = {
  sage: { label: "Sage", swatch: "hsl(91 16% 50%)", primary: "91 16% 50%", primaryForeground: "0 0% 100%" },
  terracotta: { label: "Terracotta", swatch: "hsl(15 55% 55%)", primary: "15 55% 55%", primaryForeground: "0 0% 100%" },
  ocean: { label: "Ocean", swatch: "hsl(205 55% 48%)", primary: "205 55% 48%", primaryForeground: "0 0% 100%" },
  lavender: { label: "Lavender", swatch: "hsl(265 35% 60%)", primary: "265 35% 60%", primaryForeground: "0 0% 100%" },
  sunset: { label: "Sunset", swatch: "hsl(20 75% 58%)", primary: "20 75% 58%", primaryForeground: "0 0% 100%" },
};

const AVATAR_EMOJIS = ["🌿", "🌊", "🌸", "🌞", "🌙", "🍃", "🦋", "🐝", "🌵", "🍄", "🐚", "⭐"];

const FOCUS_AREA_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: "stress", label: "Stress", emoji: "😮‍💨" },
  { id: "sleep", label: "Sleep", emoji: "😴" },
  { id: "fitness", label: "Fitness", emoji: "🏃" },
  { id: "nutrition", label: "Nutrition", emoji: "🥗" },
  { id: "mindfulness", label: "Mindfulness", emoji: "🧘" },
  { id: "connection", label: "Connection", emoji: "🤝" },
];

interface EmployeePreferences {
  employeeId: number;
  themeColor: string;
  avatarEmoji: string;
  focusAreas: string[];
  showGroupSessions: boolean;
  showSocialCalendar: boolean;
  showSelfFunded: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
}

function AllowanceBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const remaining = Math.max(0, total - used);
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-2xl font-serif font-bold text-foreground">{remaining}</p>
          <p className="text-xs text-muted-foreground">sessions remaining this month</p>
        </div>
        <p className="text-sm text-muted-foreground">{used} / {total} used</p>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct * 100}%`,
            background: remaining === 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))",
          }}
        />
      </div>
    </div>
  );
}

export default function EmployeePortal() {
  const [, navigate] = useLocation();
  const [stored, setStored] = useState<StoredEmployee | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Group sessions
  const [groupSessions, setGroupSessions] = useState<GroupSession[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [attending, setAttending] = useState<Set<number>>(new Set());
  const [signingUp, setSigningUp] = useState<number | null>(null);

  // Social calendar
  const [socialEvents, setSocialEvents] = useState<SocialEvent[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [rsvpd, setRsvpd] = useState<Set<number>>(new Set());
  const [rsvping, setRsvping] = useState<number | null>(null);

  // Wellbeing survey
  const [surveyRequired, setSurveyRequired] = useState(false);
  const [surveyType, setSurveyType] = useState<"initial" | "monthly">("initial");

  // Personalisation
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<EmployeePreferences | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [draftTheme, setDraftTheme] = useState("sage");
  const [draftAvatar, setDraftAvatar] = useState("🌿");
  const [draftFocusAreas, setDraftFocusAreas] = useState<Set<string>>(new Set());
  const [draftShowGroup, setDraftShowGroup] = useState(true);
  const [draftShowSocial, setDraftShowSocial] = useState(true);
  const [draftShowSelfFunded, setDraftShowSelfFunded] = useState(true);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleActing, setGoogleActing] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("soulful_employee");
    if (!raw) { navigate("/join"); return; }
    let parsed: StoredEmployee | null = null;
    try { parsed = JSON.parse(raw); setStored(parsed); } catch { navigate("/join"); return; }
    setLoaded(true);
    // Check survey status
    if (parsed?.id) {
      fetch(`https://api.soulfulco.uk/api/wellbeing/surveys/status?employeeId=${parsed.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.required) {
            setSurveyType(data.type as "initial" | "monthly");
            setSurveyRequired(true);
          }
        })
        .catch(() => {});
    }
  }, [navigate]);

  // Load preferences
  useEffect(() => {
    if (!stored?.id) return;
    fetch(`https://api.soulfulco.uk/api/employee/preferences?employeeId=${stored.id}`)
      .then(r => r.json())
      .then((data: EmployeePreferences) => {
        setPrefs(data);
        setDraftTheme(data.themeColor);
        setDraftAvatar(data.avatarEmoji);
        setDraftFocusAreas(new Set(data.focusAreas));
        setDraftShowGroup(data.showGroupSessions);
        setDraftShowSocial(data.showSocialCalendar);
        setDraftShowSelfFunded(data.showSelfFunded);
      })
      .catch(() => {});
  }, [stored?.id]);

  // Apply theme colour to CSS variables
  useEffect(() => {
    const preset = THEME_PRESETS[prefs?.themeColor ?? "sage"] ?? THEME_PRESETS.sage;
    document.documentElement.style.setProperty("--primary", preset.primary);
    document.documentElement.style.setProperty("--primary-foreground", preset.primaryForeground);
    return () => {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
    };
  }, [prefs?.themeColor]);

  // Handle Google OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (!google) return;
    if (google === "connected") {
      toast({ title: "Google Calendar connected", description: "Your bookings and events will now sync automatically." });
    } else if (google === "noaccess") {
      toast({ title: "Couldn't connect", description: "Google didn't grant calendar access. Please try again.", variant: "destructive" });
    } else if (google === "error") {
      toast({ title: "Couldn't connect", description: "Something went wrong connecting Google Calendar.", variant: "destructive" });
    }
    window.history.replaceState({}, "", window.location.pathname);
    if (stored?.id) {
      fetch(`https://api.soulfulco.uk/api/employee/preferences?employeeId=${stored.id}`).then(r => r.json()).then(setPrefs).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored?.id]);

  const { data: employee, isLoading: isLoadingEmployee } = useGetEmployee(
    stored?.id ?? 0,
    { query: { queryKey: getGetEmployeeQueryKey(stored?.id ?? 0), enabled: !!stored?.id } }
  );

  const { data: bookings, isLoading: isLoadingBookings } = useListEmployeeBookings(
    stored?.id ?? 0,
    { query: { queryKey: getListEmployeeBookingsQueryKey(stored?.id ?? 0), enabled: !!stored?.id } }
  );

  // Fetch group sessions
  useEffect(() => {
    if (!stored?.companyId) return;
    setLoadingGroup(true);
    fetch(`https://api.soulfulco.uk/api/group-sessions?companyId=${stored.companyId}`)
      .then(r => r.json())
      .then((data: GroupSession[]) => {
        const upcoming = data.filter(s => new Date(s.start_time) >= new Date() && s.status !== "cancelled");
        setGroupSessions(upcoming);
        return Promise.all(
          upcoming.map(s =>
            fetch(`https://api.soulfulco.uk/api/group-sessions/${s.id}`)
              .then(r => r.json())
              .then(d => ({ id: s.id, attendees: d.attendees as { employee_email: string }[] }))
          )
        );
      })
      .then(results => {
        const ids = results
          .filter(r => r.attendees?.some(a => a.employee_email === stored.email))
          .map(r => r.id);
        setAttending(new Set(ids));
      })
      .catch(() => {})
      .finally(() => setLoadingGroup(false));
  }, [stored?.companyId, stored?.email]);

  // Fetch social events
  useEffect(() => {
    if (!stored?.companyId) return;
    setLoadingSocial(true);
    fetch(`https://api.soulfulco.uk/api/social-events?companyId=${stored.companyId}`)
      .then(r => r.json())
      .then((data: SocialEvent[]) => {
        const upcoming = data.filter(e => new Date(e.start_time) >= new Date() && e.status === "active");
        setSocialEvents(upcoming);
        // Check which ones this employee has RSVPed to
        return Promise.all(
          upcoming.map(e =>
            fetch(`https://api.soulfulco.uk/api/social-events/${e.id}`)
              .then(r => r.json())
              .then(d => ({ id: e.id, rsvps: d.rsvps as { employee_email: string }[] }))
          )
        );
      })
      .then(results => {
        const ids = results
          .filter(r => r.rsvps?.some(rv => rv.employee_email === stored.email))
          .map(r => r.id);
        setRsvpd(new Set(ids));
      })
      .catch(() => {})
      .finally(() => setLoadingSocial(false));
  }, [stored?.companyId, stored?.email]);

  // Group session handlers
  const handleSignUp = async (sessionId: number) => {
    if (!stored) return;
    setSigningUp(sessionId);
    try {
      const res = await fetch(`https://api.soulfulco.uk/api/group-sessions/${sessionId}/attend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: stored.id, employeeName: stored.name, employeeEmail: stored.email }),
      });
      if (res.ok) {
        setAttending(prev => new Set([...prev, sessionId]));
        setGroupSessions(prev => prev.map(s => s.id === sessionId ? { ...s, attendee_count: s.attendee_count + 1 } : s));
      }
    } catch {}
    setSigningUp(null);
  };

  const handleWithdraw = async (sessionId: number) => {
    if (!stored) return;
    setSigningUp(sessionId);
    try {
      const res = await fetch(`https://api.soulfulco.uk/api/group-sessions/${sessionId}/attend`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeEmail: stored.email }),
      });
      if (res.ok) {
        setAttending(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
        setGroupSessions(prev => prev.map(s => s.id === sessionId ? { ...s, attendee_count: Math.max(0, s.attendee_count - 1) } : s));
      }
    } catch {}
    setSigningUp(null);
  };

  // Social calendar handlers
  const handleRsvp = async (eventId: number) => {
    if (!stored) return;
    setRsvping(eventId);
    try {
      const res = await fetch(`https://api.soulfulco.uk/api/social-events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: stored.id, employeeName: stored.name, employeeEmail: stored.email }),
      });
      if (res.ok) {
        setRsvpd(prev => new Set([...prev, eventId]));
        setSocialEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvp_count: e.rsvp_count + 1 } : e));
      }
    } catch {}
    setRsvping(null);
  };

  const handleCancelRsvp = async (eventId: number) => {
    if (!stored) return;
    setRsvping(eventId);
    try {
      const res = await fetch(`https://api.soulfulco.uk/api/social-events/${eventId}/rsvp`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeEmail: stored.email }),
      });
      if (res.ok) {
        setRsvpd(prev => { const n = new Set(prev); n.delete(eventId); return n; });
        setSocialEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvp_count: Math.max(0, e.rsvp_count - 1) } : e));
      }
    } catch {}
    setRsvping(null);
  };

  const downloadEventIcs = (eventId: number, title: string) => {
    const a = document.createElement("a");
    a.href = `/api/social-events/${eventId}/calendar.ics`;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.ics`;
    a.click();
  };

  const downloadAllIcs = () => {
    if (!stored?.companyId) return;
    const a = document.createElement("a");
    a.href = `/api/social-events/company/${stored.companyId}/calendar.ics`;
    a.download = "soulful-wellbeing-calendar.ics";
    a.click();
  };

  const handleSignOut = () => {
    localStorage.removeItem("soulful_employee");
    navigate("/join");
  };

  const toggleFocusArea = (id: string) => {
    setDraftFocusAreas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSavePrefs = async () => {
    if (!stored) return;
    setSavingPrefs(true);
    try {
      const res = await fetch("https://api.soulfulco.uk/api/employee/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: stored.id,
          themeColor: draftTheme,
          avatarEmoji: draftAvatar,
          focusAreas: Array.from(draftFocusAreas),
          showGroupSessions: draftShowGroup,
          showSocialCalendar: draftShowSocial,
          showSelfFunded: draftShowSelfFunded,
        }),
      });
      if (res.ok) {
        const data: EmployeePreferences = await res.json();
        setPrefs(data);
        setPrefsOpen(false);
        toast({ title: "Your space is updated", description: "Personalisation saved." });
      } else {
        toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    }
    setSavingPrefs(false);
  };

  const handleConnectGoogle = () => {
    if (!stored) return;
    window.location.href = `/api/employee/google/connect?employeeId=${stored.id}`;
  };

  const handleDisconnectGoogle = async () => {
    if (!stored) return;
    setGoogleActing(true);
    try {
      const res = await fetch("https://api.soulfulco.uk/api/employee/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: stored.id }),
      });
      if (res.ok) {
        setPrefs(prev => prev ? { ...prev, googleConnected: false, googleEmail: null } : prev);
        toast({ title: "Google Calendar disconnected" });
      }
    } catch {}
    setGoogleActing(false);
  };

  const handleSyncGoogle = async () => {
    if (!stored) return;
    setGoogleSyncing(true);
    try {
      const res = await fetch("https://api.soulfulco.uk/api/employee/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: stored.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Synced",
          description: data.synced > 0 ? `${data.synced} event${data.synced === 1 ? "" : "s"} added to Google Calendar.` : "Everything is already up to date.",
        });
      } else {
        toast({ title: "Sync failed", description: data.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Sync failed", description: "Please try again.", variant: "destructive" });
    }
    setGoogleSyncing(false);
  };

  if (!loaded || isLoadingEmployee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-6 w-full max-w-2xl px-6">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  const emp = employee ?? stored;
  const sessionsUsed = employee?.sessionsUsedThisMonth ?? 0;
  const allowance = employee?.sessionAllowancePerMonth ?? 2;
  const remaining = Math.max(0, allowance - sessionsUsed);
  const upcomingBookings = bookings?.filter(b => b.status === "confirmed" || b.status === "pending") ?? [];
  const pastBookings = bookings?.filter(b => b.status === "completed") ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Wellbeing Survey Modal */}
      {stored && (
        <WellbeingSurvey
          employeeId={stored.id}
          type={surveyType}
          open={surveyRequired}
          onComplete={() => setSurveyRequired(false)}
        />
      )}

      {/* Header */}
      <header className="h-16 border-b bg-card/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6 gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-serif text-xl font-bold tracking-tight hidden sm:block">Soulful</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <span className="text-sm font-medium text-primary px-3 py-1.5 rounded-full bg-primary/10 whitespace-nowrap">
            My Wellbeing
          </span>
          <Link
            href="/events"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full hover:bg-muted whitespace-nowrap"
          >
            Events
          </Link>
          <Link
            href="/volunteering"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full hover:bg-muted whitespace-nowrap"
          >
            Volunteering
          </Link>
          <Link
            href="/practitioners"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full hover:bg-muted whitespace-nowrap"
          >
            Practitioners
          </Link>
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-base">
              {prefs?.avatarEmoji ?? <User className="h-4 w-4 text-primary" />}
            </div>
            <span className="text-sm font-medium hidden sm:block">{emp?.name}</span>
          </div>
          <button
            onClick={() => setPrefsOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            title="Personalise your space"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Personalise</span>
          </button>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Personalisation dialog */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Personalise your space</DialogTitle>
            <DialogDescription>Make your wellness space feel like yours.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Avatar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Your avatar</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setDraftAvatar(emoji)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                      draftAvatar === emoji ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/70"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme colour */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Colour theme</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(THEME_PRESETS).map(([id, preset]) => (
                  <button
                    key={id}
                    onClick={() => setDraftTheme(id)}
                    className="flex flex-col items-center gap-1.5"
                    title={preset.label}
                  >
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        draftTheme === id ? "ring-2 ring-offset-2 ring-foreground/70" : ""
                      }`}
                      style={{ background: preset.swatch }}
                    >
                      {draftTheme === id && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Focus areas */}
            <div className="space-y-2">
              <p className="text-sm font-medium">What matters most to you?</p>
              <p className="text-xs text-muted-foreground -mt-1">Pick a few — helps us surface the right sessions and events</p>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREA_OPTIONS.map(opt => {
                  const active = draftFocusAreas.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleFocusArea(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section visibility */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Show on my space</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Group sessions</span>
                  <Switch checked={draftShowGroup} onCheckedChange={setDraftShowGroup} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Social calendar</span>
                  <Switch checked={draftShowSocial} onCheckedChange={setDraftShowSocial} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Self-funded 1:1 booking</span>
                  <Switch checked={draftShowSelfFunded} onCheckedChange={setDraftShowSelfFunded} />
                </div>
              </div>
            </div>

            {/* Google Calendar */}
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">Calendar sync</p>
              {prefs?.googleConnected ? (
                <div className="flex items-center justify-between gap-3 bg-secondary/30 rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Connected to Google Calendar
                    </p>
                    {prefs.googleEmail && <p className="text-[11px] text-muted-foreground truncate">{prefs.googleEmail}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-full gap-1" disabled={googleSyncing} onClick={handleSyncGoogle}>
                      <RefreshCw className={`h-3 w-3 ${googleSyncing ? "animate-spin" : ""}`} /> Sync
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground" disabled={googleActing} onClick={handleDisconnectGoogle} title="Disconnect">
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5" onClick={handleConnectGoogle}>
                  <Link2 className="h-3.5 w-3.5" /> Connect Google Calendar
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">Automatically add your bookings, group sessions and social events to Google Calendar.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrefsOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePrefs} disabled={savingPrefs}>{savingPrefs ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="flex-1 container mx-auto max-w-3xl px-4 md:px-8 py-10 space-y-10">
        {/* Greeting */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
            {prefs?.avatarEmoji ?? "🌿"}
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
            <h1 className="text-3xl font-serif text-foreground mt-0.5">
              {emp?.name?.split(" ")[0]}'s wellness space
            </h1>
          </div>
        </div>

        {/* ── WELLBEING REQUIREMENTS ── */}
        {stored && <WellbeingRequirementsWidget employeeId={stored.id} />}

        {/* ── GAMIFICATION ── */}
        {stored && <GamificationWidget employeeId={stored.id} />}

        {/* ── COMPANY-COVERED PERKS ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Covered by your employer</h2>
          </div>

          <div className={`grid gap-4 ${(prefs?.showGroupSessions ?? true) ? "sm:grid-cols-2" : ""}`}>
            {/* Monthly 1:1 allowance */}
            <Card className="border-none shadow-sm bg-card">
              <CardContent className="pt-5 pb-5 px-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">1:1 session allowance</p>
                    <p className="text-xs text-muted-foreground">Resets monthly</p>
                  </div>
                </div>
                <AllowanceBar used={sessionsUsed} total={allowance} />
                {remaining > 0 ? (
                  <Button asChild size="sm" className="w-full rounded-full text-sm">
                    <Link href="/practitioners">
                      Book a 1:1 session <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Allowance used — resets next month</p>
                )}
              </CardContent>
            </Card>

            {/* Group sessions summary */}
            {(prefs?.showGroupSessions ?? true) && (
              <Card className="border-none shadow-sm bg-secondary/30">
                <CardContent className="pt-5 pb-5 px-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Practitioner group sessions</p>
                      <p className="text-xs text-muted-foreground">Yoga, meditation & more</p>
                    </div>
                  </div>
                  {loadingGroup ? (
                    <div className="h-8 bg-muted animate-pulse rounded" />
                  ) : groupSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None scheduled yet.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-2xl font-serif font-bold">{groupSessions.length}</p>
                      <p className="text-xs text-muted-foreground">upcoming · {attending.size} you're attending</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Group sessions list */}
          {(prefs?.showGroupSessions ?? true) && groupSessions.length > 0 && (
            <div className="mt-4 space-y-3">
              {groupSessions.map(session => {
                const isAttending = attending.has(session.id);
                const isFull = session.attendee_count >= session.max_attendees && !isAttending;
                const spotsLeft = session.max_attendees - session.attendee_count;
                return (
                  <Card key={session.id} className={`border-none shadow-sm transition-all ${isAttending ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
                    <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-5">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isAttending ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {isAttending ? <CheckCircle2 className="h-4 w-4" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{session.session_type}</p>
                            {isAttending && <Badge className="text-xs bg-primary/15 text-primary border-none h-5 px-2">You're in</Badge>}
                            {isFull && <Badge variant="outline" className="text-xs h-5">Full</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {session.practitioner_name} · {format(new Date(session.start_time), "EEE d MMM, h:mm a")}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {LOCATION_LABELS[session.location_type] ?? session.location_type}
                              {session.location_description && ` · ${session.location_description}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {isFull ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 sm:pl-4">
                        {isAttending ? (
                          <Button variant="outline" size="sm" className="rounded-full text-xs h-8" disabled={signingUp === session.id} onClick={() => handleWithdraw(session.id)}>
                            {signingUp === session.id ? "..." : "Cancel spot"}
                          </Button>
                        ) : (
                          <Button size="sm" className="rounded-full text-xs h-8" disabled={isFull || signingUp === session.id} onClick={() => handleSignUp(session.id)}>
                            {signingUp === session.id ? "..." : isFull ? "Full" : "Sign up"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── WELLBEING SOCIAL CALENDAR ── */}
        {(prefs?.showSocialCalendar ?? true) && (
        <section>
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Wellbeing social calendar</h2>
                <p className="text-xs text-muted-foreground">Company-organised events — opt in and save to your calendar</p>
              </div>
            </div>
            {socialEvents.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-full h-8" onClick={downloadAllIcs}>
                <Download className="h-3.5 w-3.5" />
                Add all to calendar
              </Button>
            )}
          </div>

          {loadingSocial ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : socialEvents.length === 0 ? (
            <Card className="border-dashed border-2 border-muted shadow-none">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Your company hasn't added any upcoming social events yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {socialEvents.map(event => {
                const isRsvpd = rsvpd.has(event.id);
                const isFull = event.max_attendees !== null && event.rsvp_count >= event.max_attendees && !isRsvpd;
                const emoji = EVENT_TYPE_EMOJI[event.event_type] ?? "✨";
                return (
                  <Card key={event.id} className={`border-none shadow-sm transition-all ${isRsvpd ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
                    <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-5">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base ${isRsvpd ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {isRsvpd ? <CheckCircle2 className="h-4 w-4" /> : <span>{emoji}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{event.title}</p>
                            {isRsvpd && <Badge className="text-xs bg-primary/15 text-primary border-none h-5 px-2">Going</Badge>}
                            {isFull && <Badge variant="outline" className="text-xs h-5">Full</Badge>}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{format(new Date(event.start_time), "EEE d MMM, h:mm a")} – {format(new Date(event.end_time), "h:mm a")}</span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location_url
                                  ? <a href={event.location_url} target="_blank" rel="noreferrer" className="underline">{event.location}</a>
                                  : event.location
                                }
                              </span>
                            )}
                            <span className="text-muted-foreground/60">by {event.organiser_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 sm:pl-2">
                        {/* Calendar download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
                          title="Add to calendar"
                          onClick={() => downloadEventIcs(event.id, event.title)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {/* RSVP */}
                        {isRsvpd ? (
                          <Button variant="outline" size="sm" className="rounded-full text-xs h-8" disabled={rsvping === event.id} onClick={() => handleCancelRsvp(event.id)}>
                            {rsvping === event.id ? "..." : "Can't make it"}
                          </Button>
                        ) : (
                          <Button size="sm" className="rounded-full text-xs h-8" disabled={isFull || rsvping === event.id} onClick={() => handleRsvp(event.id)}>
                            {rsvping === event.id ? "..." : isFull ? "Full" : "I'm going"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* ── SELF-FUNDED 1:1s ── */}
        {(prefs?.showSelfFunded ?? true) && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Book a 1:1 — pay yourself</h2>
          </div>
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 px-5">
              <div className="space-y-1">
                <p className="text-sm font-medium">Want more than your allowance?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Browse our full network of vetted practitioners and book a personal 1:1 session at your own cost — yoga, coaching, therapy, nutrition, and more.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-full flex-shrink-0">
                <Link href="/practitioners?paymentType=self">
                  Browse practitioners <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
        )}

        {/* ── UPCOMING 1:1 BOOKINGS ── */}
        {(upcomingBookings.length > 0 || isLoadingBookings) && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Upcoming 1:1 sessions</h2>
            </div>
            {isLoadingBookings ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(booking => (
                  <Card key={booking.id} className="border-none shadow-sm bg-card">
                    <CardContent className="flex items-center justify-between py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{booking.sessionType}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.sessionDate ? format(new Date(booking.sessionDate), "EEE d MMM, h:mm a") : "Date TBC"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="capitalize text-xs">
                        {booking.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── PAST SESSIONS ── */}
        {pastBookings.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Past sessions</h2>
            </div>
            <div className="space-y-3">
              {pastBookings.map(booking => (
                <Card key={booking.id} className="border-none shadow-sm bg-muted/30">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{booking.sessionType}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.sessionDate ? format(new Date(booking.sessionDate), "EEE d MMM, h:mm a") : "TBC"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs text-muted-foreground">Completed</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── WELLBEING PROGRESS ── */}
        {stored && <WellbeingProgress employeeId={stored.id} />}

      </main>
    </div>
  );
}
