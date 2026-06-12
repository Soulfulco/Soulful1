import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Brain, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Survey {
  id: number;
  survey_type: string;
  mood_score: number;
  connection_score: number;
  productivity_score: number;
  notes: string | null;
  created_at: string;
}

interface Props {
  employeeId: number;
}

function Trend({ current, previous }: { current: number; previous?: number }) {
  if (!previous) return null;
  const diff = current - previous;
  if (diff > 0) return <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium"><TrendingUp className="h-3 w-3" />+{diff}</span>;
  if (diff < 0) return <span className="flex items-center gap-0.5 text-xs text-rose-500 font-medium"><TrendingDown className="h-3 w-3" />{diff}</span>;
  return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0</span>;
}

export default function WellbeingProgress({ employeeId }: Props) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    fetch(`/api/wellbeing/surveys?employeeId=${employeeId}`)
      .then(r => r.json())
      .then(setSurveys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />;
  if (surveys.length < 2) return null; // Only show chart after 2+ data points

  const chartData = surveys.map(s => ({
    date: format(parseISO(s.created_at), "MMM yy"),
    Mood: s.mood_score,
    Connection: s.connection_score,
    Productivity: s.productivity_score,
  }));

  const latest = surveys[surveys.length - 1];
  const previous = surveys.length >= 2 ? surveys[surveys.length - 2] : undefined;

  return (
    <Card className="border-secondary/50 bg-gradient-to-br from-secondary/10 to-background">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-serif">Your Wellbeing Journey</CardTitle>
            <CardDescription className="text-xs mt-0.5">{surveys.length} check-ins completed</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">{surveys.length} check-ins</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Latest scores */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "mood_score", label: "Mood", icon: Heart, color: "text-rose-500" },
            { key: "connection_score", label: "Connection", icon: Brain, color: "text-violet-500" },
            { key: "productivity_score", label: "Productivity", icon: Zap, color: "text-amber-500" },
          ].map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="rounded-xl bg-card border p-3 text-center">
              <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-serif font-bold text-foreground">{(latest as any)[key]}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              <div className="flex justify-center mt-1">
                <Trend current={(latest as any)[key]} previous={previous ? (previous as any)[key] : undefined} />
              </div>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Mood" stroke="hsl(340 60% 65%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Connection" stroke="hsl(260 50% 65%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Productivity" stroke="hsl(45 70% 60%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {latest.notes && (
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground italic">"{latest.notes}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
