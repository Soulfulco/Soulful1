import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, Plus, Trash2, CalendarClock, LogOut, CheckCircle2, RefreshCw,
  CreditCard, User, TrendingUp, PoundSterling, Star, Users2,
} from "lucide-react";
import { DocumentUpload } from "@/components/DocumentUpload";

type Slot = {
  id: number;
  practitionerId: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  sessionType: string | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PractitionerPortal() {
  const { practitionerSession, logout } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [sessionType, setSessionType] = useState("1-on-1");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [google, setGoogle] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean } | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);

  const [profile, setProfile] = useState({ phoneNumber: "", qualificationsFileUrl: "", insuranceFileUrl: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    earningsThisMonthGbp: number;
    bookingsThisMonth: number;
    upcomingBookings: number;
    avgCapacityFilledPct: number | null;
    ratingOutOf5: number | null;
    totalReviews: number;
  } | null>(null);

  const loadGoogle = useCallback(async () => {
    try {
      const res = await fetch("/api/practitioner/me", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { googleConnected?: boolean; googleEmail?: string | null };
      setGoogle({ connected: Boolean(data.googleConnected), email: data.googleEmail ?? null });
    } catch {
      /* ignore */
    }
  }, []);

  const loadStripeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/practitioner/stripe/status", { credentials: "include" });
      if (!res.ok) return;
      setStripeStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/practitioner/me", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setProfile({
        phoneNumber: data.phoneNumber ?? "",
        qualificationsFileUrl: data.qualificationsFileUrl ?? "",
        insuranceFileUrl: data.insuranceFileUrl ?? "",
      });
    } catch {
      /* ignore */
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/practitioner/dashboard-stats", { credentials: "include" });
      if (!res.ok) return;
      setStats(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadGoogle();
    loadStripeStatus();
    loadProfile();
    loadStats();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google");
    if (status) {
      if (status === "connected") setGoogleMsg("Google Calendar connected.");
      else if (status === "noaccess") setGoogleMsg("Google didn't grant calendar access. Please try again and allow all permissions.");
      else setGoogleMsg("Couldn't connect Google Calendar. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadGoogle, loadStripeStatus, loadProfile, loadStats]);

  async function handleGoogleSync() {
    setGoogleBusy(true);
    setGoogleMsg(null);
    try {
      const res = await fetch("/api/practitioner/google/sync", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setGoogleMsg(`Synced. ${data.busyBlocks ?? 0} busy period(s) imported.`);
      await load();
    } catch (err) {
      setGoogleMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleGoogleDisconnect() {
    setGoogleBusy(true);
    setGoogleMsg(null);
    try {
      const res = await fetch("/api/practitioner/google/disconnect", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setGoogle({ connected: false, email: null });
      setGoogleMsg("Google Calendar disconnected.");
      await load();
    } catch (err) {
      setGoogleMsg(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleStripeConnect() {
    setStripeBusy(true);
    try {
      const res = await fetch("/api/practitioner/stripe/connect", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start onboarding");
      window.location.href = data.url;
    } catch {
      setStripeBusy(false);
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/practitioner/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Failed to save");
      setProfileMsg("Saved.");
    } catch {
      setProfileMsg("Couldn't save — please try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/practitioner/availability", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load availability");
      const data = (await res.json()) as Slot[];
      data.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setSlots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!date) {
      setFormError("Please choose a date");
      return;
    }
    const startTime = new Date(`${date}T${start}:00`);
    const endTime = new Date(`${date}T${end}:00`);
    if (endTime <= startTime) {
      setFormError("End time must be after start time");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/practitioner/availability", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          sessionType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add slot");
      }
      setDate("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add slot");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/practitioner/availability/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete slot");
      }
      setSlots((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete slot");
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Soulful" className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <p className="font-serif text-lg font-bold leading-none">Practitioner Portal</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {practitionerSession?.name} · {practitionerSession?.specialism}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" /> Your performance
            </CardTitle>
            <CardDescription>Real figures from your actual bookings — no estimates.</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <PoundSterling className="h-3.5 w-3.5" /> Earnings this month
                  </div>
                  <p className="text-xl font-semibold">£{stats.earningsThisMonthGbp.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">After commission</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Bookings this month
                  </div>
                  <p className="text-xl font-semibold">{stats.bookingsThisMonth}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Users2 className="h-3.5 w-3.5" /> Upcoming
                  </div>
                  <p className="text-xl font-semibold">{stats.upcomingBookings}</p>
                </div>
                {stats.avgCapacityFilledPct !== null && (
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Group session capacity</div>
                    <p className="text-xl font-semibold">{stats.avgCapacityFilledPct}%</p>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </div>
                )}
                {stats.ratingOutOf5 !== null && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Star className="h-3.5 w-3.5" /> Rating
                    </div>
                    <p className="text-xl font-semibold">
                      {stats.ratingOutOf5.toFixed(1)} <span className="text-sm text-muted-foreground">({stats.totalReviews})</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5" /> Google Calendar
            </CardTitle>
            <CardDescription>
              Connect your calendar to block out busy times automatically and add confirmed
              Soulful bookings to your schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {google?.connected ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Connected{google.email ? ` as ${google.email}` : ""}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleGoogleSync} disabled={googleBusy}>
                    {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleGoogleDisconnect} disabled={googleBusy}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <Button asChild>
                <a href="/api/practitioner/google/connect">Connect Google Calendar</a>
              </Button>
            )}
            {googleMsg && (
              <Alert>
                <AlertDescription>{googleMsg}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" /> Profile