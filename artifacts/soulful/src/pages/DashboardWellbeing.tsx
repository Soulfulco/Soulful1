import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { Heart, Brain, Zap, Users, TrendingUp, Loader2, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type WellbeingData = {
  trends: {
    month: string;
    avg_mood: string;
    avg_connection: string;
    avg_productivity: string;
    respondents: string;
  }[];
  latestByEmployee: {
    employee_id: number;
    employee_name: string;
    mood_score: number;
    connection_score: number;
    productivity_score: number;
    created_at: string;
  }[];
  overall: {
    avg_mood: string;
    avg_connection: string;
    avg_productivity: string;
    total_responses: string;
    total_respondents: string;
  } | null;
};

function useWellbeingData(companyId: number | null) {
  return useQuery<WellbeingData>({
    queryKey: ["wellbeing-company", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/wellbeing/company/${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wellbeing data");
      return res.json();
    },
    enabled: !!companyId,
  });
}

const SCORE_COLOR = (score: number) => {
  if (score < 4) return "text-red-500";
  if (score < 6) return "text-amber-500";
  if (score < 8) return "text-yellow-500";
  return "text-emerald-600";
};

export default function DashboardWellbeing() {
  const { hrSession, isAdminUser } = useAuth();
  const { data: companiesData } = useListCompanies();
  const companies = companiesData?.data ?? [];

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    hrSession?.companyId ?? null
  );

  const companyId = hrSession?.companyId ?? selectedCompanyId;
  const { data, isLoading } = useWellbeingData(companyId);

  const chartData = (data?.trends ?? []).map(t => ({
    month: format(parseISO(t.month), "MMM yy"),
    Mood: parseFloat(t.avg_mood),
    Connection: parseFloat(t.avg_connection),
    Productivity: parseFloat(t.avg_productivity),
    Respondents: parseInt(t.respondents),
  }));

  const overall = data?.overall;
  const radarData = overall ? [
    { metric: "Mood", score: parseFloat(overall.avg_mood) },
    { metric: "Connection", score: parseFloat(overall.avg_connection) },
    { metric: "Productivity", score: parseFloat(overall.avg_productivity) },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Team Wellbeing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Anonymised wellbeing scores from employee check-ins
          </p>
        </div>
        {isAdminUser && (
          <Select
            value={String(selectedCompanyId ?? "")}
            onValueChange={(v) => setSelectedCompanyId(Number(v))}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!companyId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Select a company</CardTitle>
            <CardDescription>Choose a company above to view their wellbeing data.</CardDescription>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !overall || overall.total_responses === "0" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Heart className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No check-ins yet</CardTitle>
            <CardDescription className="max-w-sm">
              Wellbeing data will appear here once employees complete their initial survey in the employee portal.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Avg Mood", value: parseFloat(overall.avg_mood), icon: Heart, color: "text-rose-500" },
              { label: "Avg Connection", value: parseFloat(overall.avg_connection), icon: Brain, color: "text-violet-500" },
              { label: "Avg Productivity", value: parseFloat(overall.avg_productivity), icon: Zap, color: "text-amber-500" },
              { label: "Respondents", value: parseInt(overall.total_respondents), icon: Users, color: "text-primary", raw: true },
            ].map(({ label, value, icon: Icon, color, raw }) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-2xl font-serif font-bold ${raw ? "text-foreground" : SCORE_COLOR(value)}`}>
                        {raw ? value : value.toFixed(1)}
                        {!raw && <span className="text-sm font-normal text-muted-foreground">/10</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-serif">Wellbeing Trends Over Time</CardTitle>
                <CardDescription className="text-xs">Monthly average scores across all employees</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Trends will appear after 2+ months of data</p>
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="Mood" stroke="hsl(340 60% 65%)" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Connection" stroke="hsl(260 50% 65%)" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Productivity" stroke="hsl(45 70% 60%)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-serif">Current Balance</CardTitle>
                <CardDescription className="text-xs">90-day average across all dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                      <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-employee latest scores */}
          {data?.latestByEmployee && data.latestByEmployee.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-serif">Latest Individual Scores</CardTitle>
                <CardDescription className="text-xs">Most recent check-in per employee</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {data.latestByEmployee.map((emp) => {
                    const avg = ((emp.mood_score + emp.connection_score + emp.productivity_score) / 3);
                    return (
                      <div key={emp.employee_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                            {emp.employee_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{emp.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(emp.created_at), "d MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" />{emp.mood_score}</span>
                            <span className="flex items-center gap-1"><Brain className="h-3 w-3 text-violet-400" />{emp.connection_score}</span>
                            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" />{emp.productivity_score}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${SCORE_COLOR(avg)}`}>
                            {avg.toFixed(1)} avg
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
