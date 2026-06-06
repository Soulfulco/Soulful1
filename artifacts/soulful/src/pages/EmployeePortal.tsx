import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetEmployee, useListEmployeeBookings, getGetEmployeeQueryKey, getListEmployeeBookingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Calendar, ArrowRight, Clock, User, LogOut, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface StoredEmployee {
  id: number;
  companyId: number;
  name: string;
  email: string;
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

export default function EmployeePortal() {
  const [, navigate] = useLocation();
  const [stored, setStored] = useState<StoredEmployee | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("soulful_employee");
    if (!raw) {
      navigate("/join");
      return;
    }
    try {
      setStored(JSON.parse(raw));
    } catch {
      navigate("/join");
    }
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
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <Leaf className="h-5 w-5" />
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

      <main className="flex-1 container mx-auto max-w-4xl px-4 md:px-8 py-10 space-y-8">
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
                      {remaining > 0 ? "Book a session" : "Allowance used"}
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
                  <Button
                    asChild
                    variant="secondary"
                    className="rounded-full self-start"
                  >
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

        {/* Upcoming Sessions */}
        <div>
          <h2 className="text-xl font-serif mb-4">Your sessions</h2>
          {isLoadingBookings ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <Card className="border-dashed border-2 border-muted shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">No upcoming sessions booked yet.</p>
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

        {/* All sessions (past) */}
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
                    <Badge variant="outline" className="capitalize text-muted-foreground">
                      Completed
                    </Badge>
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
