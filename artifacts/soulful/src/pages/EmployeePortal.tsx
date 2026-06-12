import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetEmployee, useListEmployeeBookings, getGetEmployeeQueryKey, getListEmployeeBookingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, Clock, User, LogOut, Sparkles, MapPin, Users, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

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

function AllowanceRing({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const remaining = total - used;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={remaining === 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-3xl font-serif font-bold text-foreground">{remaining}</span>
          <span className="text-xs text-muted-foreground">remaining</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        <span className="font-medium text-foreground">{used}</span> of <span className="font-medium text-foreground">{total}</span> sessions used this month
      </p>
    </div>
  );
}

const LOCATION_LABELS: Record<string, string> = {
  at_office: "At your office",
  virtual: "Virtual",
  practitioner_space: "Practitioner's studio",
};

export default function EmployeePortal() {
  const [, navigate] = useLocation();
  const [stored, setStored] = useState<StoredEmployee | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [groupSessions, setGroupSessions] = useState<GroupSession[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [attending, setAttending] = useState<Set<number>>(new Set());
  const [signingUp, setSigningUp] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("soulful_employee");
    if (!raw) { navigate("/join"); return; }
    try { setStored(JSON.parse(raw)); } catch { navigate("/join"); }
    setLoaded(true);
  }, [navigate]);

  const { data: employee, isLoading: isLoadingEmployee } = useGetEmployee(
    stored?.id ?? 0,
    { query: { queryKey: getGetEmployeeQueryKey(stored?.id ?? 0), enabled: !!stored?.id } }
  );

  const { data: bookings, isLoading: isLoadingBookings } = useListEmployeeBookings(
    stored?.id ?? 0,
    { query: { queryKey: getListEmployeeBookingsQueryKey(stored?.id ?? 0), enabled: !!stored?.id } }
  );

  // Fetch group sessions for this company
  useEffect(() => {
    if (!stored?.companyId) return;
    setLoadingGroup(true);
    fetch(`/api/group-sessions?companyId=${stored.companyId}`)
      .then(r => r.json())
      .then((data: GroupSession[]) => {
        const upcoming = data.filter(s => new Date(s.start_time) >= new Date() && s.status !== "cancelled");
        setGroupSessions(upcoming);
        // Check which ones the employee is already attending
        Promise.all(
          upcoming.map(s =>
            fetch(`/api/group-sessions/${s.id}`)
              .then(r => r.json())
              .then(d => ({ id: s.id, attendees: d.attendees as { employee_email: string }[] }))
          )
        ).then(results => {
          const attendingIds = results
            .filter(r => r.attendees?.some(a => a.employee_email === stored.email))
            .map(r => r.id);
          setAttending(new Set(attendingIds));
        });
      })
      .catch(() => {})
      .finally(() => setLoadingGroup(false));
  }, [stored?.companyId, stored?.email]);

  const handleSignUp = async (sessionId: number) => {
    if (!stored) return;
    setSigningUp(sessionId);
    try {
      const res = await fetch(`/api/group-sessions/${sessionId}/attend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: stored.id,
          employeeName: stored.name,
          employeeEmail: stored.email,
        }),
      });
      if (res.ok) {
        setAttending(prev => new Set([...prev, sessionId]));
        setGroupSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, attendee_count: s.attendee_count + 1 } : s)
        );
      }
    } catch {}
    setSigningUp(null);
  };

  const handleWithdraw = async (sessionId: number) => {
    if (!stored) return;
    setSigningUp(sessionId);
    try {
      const res = await fetch(`/api/group-sessions/${sessionId}/attend`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeEmail: stored.email }),
      });
      if (res.ok) {
        setAttending(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
        setGroupSessions(prev =>
          prev.map(s => s.id === sessionId ? { ...s, attendee_count: Math.max(0, s.attendee_count - 1) } : s)
        );
      }
    } catch {}
    setSigningUp(null);
  };

  const handleSignOut = () => {
    localStorage.removeItem("soulful_employee");
    navigate("/join");
  };

  if (!loaded || isLoadingEmployee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-6">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  const emp = employee ?? stored;
  const upcoming = bookings?.filter(b => b.status === "confirmed" || b.status === "pending") ?? [];
  const sessionsUsed = employee?.sessionsUsedThisMonth ?? 0;
  const allowance = employee?.sessionAllowancePerMonth ?? 2;
  const remaining = Math.max(0, allowance - sessionsUsed);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b bg-card/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-serif text-xl font-bold tracking-tight">Soulful</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium hidden sm:block">{emp?.name}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-4 md:px-8 py-10 space-y-10">
        {/* Greeting */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">Welcome back</p>
          <h1 className="text-3xl font-serif text-foreground">
            {emp?.name?.split(" ")[0]}'s wellness space
          </h1>
        </div>

        {/* Allowance + CTA */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">This month's sessions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-4">
              <AllowanceRing used={sessionsUsed} total={allowance} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="border-none shadow-sm bg-primary text-primary-foreground flex-1">
              <CardContent className="flex flex-col justify-between h-full pt-6 pb-6 gap-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 mt-0.5 opacity-80" />
                  <div>
                    <h3 className="font-serif text-xl font-bold mb-1">
                      {remaining > 0 ? "Book a 1:1 session" : "Allowance used"}
                    </h3>
                    <p className="text-primary-foreground/80 text-sm leading-relaxed">
                      {remaining > 0
                        ? `You have ${remaining} session${remaining !== 1 ? "s" : ""} left this month. Choose from yoga, meditation, coaching, breathwork, and more.`
                        : "You've used all your sessions this month. Your allowance resets at the start of next month."
                      }
                    </p>
                  </div>
                </div>
                {remaining > 0 && (
                  <Button asChild variant="secondary" className="rounded-full self-start">
                    <Link href="/practitioners">
                      Browse practitioners <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-card">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{upcoming.length} upcoming session{upcoming.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">Confirmed & pending bookings</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Group Sessions */}
        {(groupSessions.length > 0 || loadingGroup) && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-serif">Group sessions at your workplace</h2>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                {groupSessions.length} upcoming
              </Badge>
            </div>
            {loadingGroup ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {groupSessions.map(session => {
                  const isAttending = attending.has(session.id);
                  const isFull = session.attendee_count >= session.max_attendees && !isAttending;
                  const spotsLeft = session.max_attendees - session.attendee_count;
                  return (
                    <Card key={session.id} className={`border-none shadow-sm ${isAttending ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
                      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-5">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAttending ? "bg-primary text-primary-foreground" : "bg-secondary/40"}`}>
                            {isAttending
                              ? <CheckCircle2 className="h-5 w-5" />
                              : <Users className="h-5 w-5 text-primary" />
                            }
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{session.session_type}</p>
                              {isAttending && (
                                <Badge className="text-xs bg-primary/15 text-primary border-none h-5">You're attending</Badge>
                              )}
                              {isFull && (
                                <Badge variant="outline" className="text-xs h-5">Full</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              with {session.practitioner_name} · {format(new Date(session.start_time), "EEE d MMM, h:mm a")}
                            </p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {LOCATION_LABELS[session.location_type] ?? session.location_type}
                                {session.location_description && ` — ${session.location_description}`}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {isFull ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isAttending ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs h-8"
                              disabled={signingUp === session.id}
                              onClick={() => handleWithdraw(session.id)}
                            >
                              {signingUp === session.id ? "..." : "Cancel spot"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="rounded-full text-xs h-8"
                              disabled={isFull || signingUp === session.id}
                              onClick={() => handleSignUp(session.id)}
                            >
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
          </div>
        )}

        {/* 1:1 Upcoming Sessions */}
        <div>
          <h2 className="text-xl font-serif mb-4">Your 1:1 sessions</h2>
          {isLoadingBookings ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <Card className="border-dashed border-2 border-muted shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">No upcoming 1:1 sessions booked yet.</p>
                {remaining > 0 && (
                  <Button variant="outline" className="rounded-full mt-2" asChild>
                    <Link href="/practitioners">Find a practitioner</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map(booking => (
                <Card key={booking.id} className="border-none shadow-sm bg-card">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{booking.sessionType}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.sessionDate ? format(new Date(booking.sessionDate), "EEE d MMM, h:mm a") : "TBC"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="capitalize">
                      {booking.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past sessions */}
        {(bookings?.filter(b => b.status === "completed") ?? []).length > 0 && (
          <div>
            <h2 className="text-xl font-serif mb-4">Past sessions</h2>
            <div className="space-y-3">
              {bookings?.filter(b => b.status === "completed").map(booking => (
                <Card key={booking.id} className="border-none shadow-sm bg-muted/30">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-muted-foreground">{booking.sessionType}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.sessionDate ? format(new Date(booking.sessionDate), "EEE d MMM, h:mm a") : "TBC"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-muted-foreground">Completed</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
