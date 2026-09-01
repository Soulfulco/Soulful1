import { useState, useEffect, useCallback } from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetUpcomingBookings, getGetUpcomingBookingsQueryKey,
  useGetSpecialismBreakdown, getGetSpecialismBreakdownQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, Building2, Calendar, PoundSterling, Clock, ArrowUpRight, CreditCard, CheckCircle2, Loader2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ['hsl(153 18% 45%)', 'hsl(15 45% 65%)', 'hsl(40 50% 70%)', 'hsl(200 20% 60%)', 'hsl(330 20% 60%)', 'hsl(20 20% 40%)'];

function PaymentMethodCard() {
  const [status, setStatus] = useState<{ hasPaymentMethod: boolean; last4: string | null; brand: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/company/payment-method", { credentials: "include" });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const pm = params.get("payment_method");
    if (pm === "success") {
      setMsg("Payment method saved.");
      window.history.replaceState({}, "", window.location.pathname);
      load();
    } else if (pm === "cancelled") {
      setMsg("Setup was cancelled — no changes made.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [load]);

  async function handleSetup() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/company/payment-method/setup", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start setup");
      window.location.href = data.url;
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to start setup");
      setBusy(false);
    }
  }

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {!status ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : status.hasPaymentMethod ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="capitalize">{status.brand} ending in {status.last4}</span>
          </div>
        ) : (
          <Alert>
            <AlertDescription>No payment method on file. This is required for corporate bookings to be charged automatically.</AlertDescription>
          </Alert>
        )}
        <Button onClick={handleSetup} disabled={busy} size="sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.hasPaymentMethod ? "Update card" : "Add payment method"}
        </Button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}

// Shown to HR when their company has never submitted a Wellbeing Action
// Plan. Employees genuinely can't join via the invite code until this is
// done (enforced server-side) — this modal is the visible reminder of that,
// not the enforcement itself.
function WellbeingActionPlanReminder({ companyId }: { companyId: number }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`/api/wellbeing/action-plan/${companyId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((plan) => {
        if (!plan) setOpen(true);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [companyId]);

  if (!checked) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="font-serif text-xl">Set up your Wellbeing Action Plan</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            Before your employees can join Soulful using your invite code, we need a few quarterly figures —
            short and long-term absence, cost, and retention — so we can show the impact your wellbeing
            programme is having over time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            I'll do this later
          </Button>
          <Button onClick={() => navigate("/dashboard/wellbeing-plan")}>
            Set up now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { isHrUser, hrSession } = useAuth();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: upcomingBookings, isLoading: isLoadingBookings } = useGetUpcomingBookings({}, {
    query: { queryKey: getGetUpcomingBookingsQueryKey() }
  });

  const { data: specialisms, isLoading: isLoadingSpecialisms } = useGetSpecialismBreakdown({
    query: { queryKey: getGetSpecialismBreakdownQueryKey() }
  });

  if (isLoadingSummary) {
    return <div className="animate-pulse space-y-6">
      <div className="h-10 bg-muted w-1/4 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="h-32 bg-muted rounded-xl"></div><div className="h-32 bg-muted rounded-xl"></div><div className="h-32 bg-muted rounded-xl"></div><div className="h-32 bg-muted rounded-xl"></div></div>
      <div className="grid md:grid-cols-2 gap-6"><div className="h-80 bg-muted rounded-xl"></div><div className="h-80 bg-muted rounded-xl"></div></div>
    </div>;
  }

  const hrSummary = summary as any;

  return (
    <div className="space-y-8">
      {isHrUser && hrSession?.companyId && <WellbeingActionPlanReminder companyId={hrSession.companyId} />}

      <div>
        <h1 className="text-3xl font-serif text-foreground mb-2">
          {isHrUser ? `${hrSession?.companyName ?? "Your"} Overview` : "Platform Overview"}
        </h1>
        <p className="text-muted-foreground">
          {isHrUser ? "Monitor your team's wellbeing spend and bookings." : "Monitor the health and growth of the Soulful marketplace."}
        </p>
      </div>

      {isHrUser ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenditure</CardTitle>
              <PoundSterling className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">£{(hrSummary?.totalExpenditure || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Subscription + bookings spend</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">£{(hrSummary?.subscriptionPriceGbp || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly plan fee</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Booking Spend</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">£{(hrSummary?.bookingsSpendGbp || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{hrSummary?.bookingsThisMonth || 0} bookings this month</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">{hrSummary?.totalBookings || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <PoundSterling className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">£{(hrSummary?.totalRevenue || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">From active subscriptions</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bookings This Month</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">{hrSummary?.bookingsThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Of {hrSummary?.totalBookings || 0} total bookings</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Companies</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">{hrSummary?.activeCompanies || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Of {hrSummary?.totalCompanies || 0} registered</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Practitioners</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-serif font-bold text-foreground">{hrSummary?.activePractitioners || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Rating avg: {hrSummary?.averageRating?.toFixed(1) || '-'} / 5.0</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isHrUser && <PaymentMethodCard />}

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-lg font-serif">Upcoming Bookings</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-primary" asChild>
              <Link href="/dashboard/bookings">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {isLoadingBookings ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
            ) : upcomingBookings?.length ? (
              <div className="divide-y divide-border/50">
                {upcomingBookings.slice(0, 5).map(booking => (
                  <div key={booking.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-sm">{booking.employeeName} <span className="text-muted-foreground font-normal">with</span> {booking.practitionerName}</div>
                      <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{booking.sessionType}</div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> {booking.companyName}
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        {booking.startTime ? format(new Date(booking.startTime), "MMM d, h:mm a") : "TBD"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">No upcoming bookings.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-lg font-serif">Practitioner Specialisms</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingSpecialisms ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading chart...</div>
            ) : specialisms?.length ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={specialisms}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="specialism"
                      stroke="none"
                    >
                      {specialisms.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: 'var(--foreground)', textTransform: 'capitalize' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value) => <span className="text-sm capitalize text-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">No specialism data available.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
