import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Plus, Trash2, CalendarClock, LogOut } from "lucide-react";

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
              <Plus className="h-5 w-5" /> Add availability
            </CardTitle>
            <CardDescription>Create a time slot clients can book.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-5 sm:items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
              <Button type="submit" disabled={adding} className="w-full">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
              {formError && (
                <Alert variant="destructive" className="sm:col-span-5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5" /> Your availability
            </CardTitle>
            <CardDescription>Upcoming and existing time slots.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No availability yet. Add a slot above to get started.
              </p>
            ) : (
              <ul className="divide-y">
                {slots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {fmt(s.startTime)} – {new Date(s.endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {s.sessionType && (
                          <p className="text-xs text-muted-foreground">{s.sessionType}</p>
                        )}
                      </div>
                      {s.isBooked && <Badge variant="secondary">Booked</Badge>}
                    </div>
                    {s.isBooked ? (
                      <span className="text-xs text-muted-foreground">Cannot remove</span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
