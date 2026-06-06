import { 
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetUpcomingBookings, getGetUpcomingBookingsQueryKey,
  useGetSpecialismBreakdown, getGetSpecialismBreakdownQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Calendar, PoundSterling, Clock, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const COLORS = ['hsl(153 18% 45%)', 'hsl(15 45% 65%)', 'hsl(40 50% 70%)', 'hsl(200 20% 60%)', 'hsl(330 20% 60%)', 'hsl(20 20% 40%)'];

export default function Dashboard() {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-foreground mb-2">Platform Overview</h1>
        <p className="text-muted-foreground">Monitor the health and growth of the Soulful marketplace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <PoundSterling className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">£{(summary?.totalRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">From active subscriptions</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bookings This Month</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{summary?.bookingsThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Of {summary?.totalBookings || 0} total bookings</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Companies</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{summary?.activeCompanies || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Of {summary?.totalCompanies || 0} registered</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Practitioners</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">{summary?.activePractitioners || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Rating avg: {summary?.averageRating?.toFixed(1) || '-'} / 5.0</p>
          </CardContent>
        </Card>
      </div>

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
