import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Sparkles, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BadgeKey =
  | "first_step" | "profile_done" | "first_checkin" | "team_player"
  | "social_butterfly" | "group_regular" | "mindful" | "consistent"
  | "monthly_warrior" | "five_sessions" | "ten_sessions" | "six_month_veteran";

interface GamificationBadge {
  key: BadgeKey;
  name: string;
  description: string;
  category: string;
  emoji: string;
  earnedAt: string;
}

interface GamificationActivityEntry {
  activityType: string;
  points: number;
  createdAt: string;
}

interface GamificationSummary {
  employeeId: number;
  totalPoints: number;
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  badges: GamificationBadge[];
  recentActivity: GamificationActivityEntry[];
  currentStreakWeeks: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  wellbeing_checkin: "Wellbeing check-in",
  booking_1on1: "Booked a 1:1 session",
  group_session: "Joined a group session",
  social_rsvp: "RSVP'd to a social event",
  profile_complete: "Completed your profile",
  streak_bonus: "4-week streak bonus",
  monthly_milestone: "Monthly milestone",
};

const ALL_BADGE_KEYS: BadgeKey[] = [
  "first_step", "profile_done", "first_checkin", "team_player",
  "social_butterfly", "group_regular", "mindful", "consistent",
  "monthly_warrior", "five_sessions", "ten_sessions", "six_month_veteran",
];

interface Props {
  employeeId: number;
}

export default function GamificationWidget({ employeeId }: Props) {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const hasCelebrated = useRef(false);

  useEffect(() => {
    if (!employeeId) return;
    fetch(`/api/employees/${employeeId}/gamification`)
      .then((r) => r.json())
      .then((data: GamificationSummary) => {
        setSummary(data);

        if (!hasCelebrated.current) {
          hasCelebrated.current = true;
          const seenKey = `soulful_gamification_seen_${employeeId}`;
          const raw = localStorage.getItem(seenKey);
          const seen: { badges: string[]; level: number } = raw
            ? JSON.parse(raw)
            : { badges: [], level: data.level };

          const newBadges = data.badges.filter((b) => !seen.badges.includes(b.key));
          const leveledUp = data.level > seen.level;

          newBadges.forEach((b) => {
            toast({
              title: `${b.emoji} Badge earned: ${b.name}`,
              description: b.description,
            });
          });
          if (leveledUp) {
            toast({
              title: `🎉 Level up! You're now Level ${data.level}`,
              description: "Keep going — your progress is private to you.",
            });
          }

          localStorage.setItem(
            seenKey,
            JSON.stringify({ badges: data.badges.map((b) => b.key), level: data.level })
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId, toast]);

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-2xl" />;
  if (!summary) return null;

  const pct = summary.pointsForNextLevel > 0
    ? Math.min(summary.pointsIntoLevel / summary.pointsForNextLevel, 1)
    : 0;
  const earnedKeys = new Set(summary.badges.map((b) => b.key));

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 via-card to-secondary/10">
      <CardContent className="pt-5 pb-5 px-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your wellbeing journey</p>
              <p className="text-xs text-muted-foreground">Level {summary.level} · {summary.totalPoints} points earned</p>
            </div>
          </div>
          {summary.currentStreakWeeks >= 2 && (
            <Badge className="text-xs bg-orange-500/15 text-orange-600 border-none h-6 px-2.5 flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> {summary.currentStreakWeeks}-week streak
            </Badge>
          )}
        </div>

        {/* Level progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level {summary.level}</span>
            <span>{summary.pointsIntoLevel} / {summary.pointsForNextLevel} to Level {summary.level + 1}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Badges — {summary.badges.length} of {ALL_BADGE_KEYS.length} earned
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_BADGE_KEYS.map((key) => {
              const badge = summary.badges.find((b) => b.key === key);
              const isEarned = earnedKeys.has(key);
              return (
                <div
                  key={key}
                  title={badge ? `${badge.name} — ${badge.description}` : "Keep going to unlock this badge"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    isEarned ? "bg-primary/15 ring-1 ring-primary/30" : "bg-muted/70 grayscale opacity-50"
                  }`}
                >
                  {isEarned ? badge!.emoji : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity — private, only visible to this employee */}
        {summary.recentActivity.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground pt-2">Recent activity</p>
            <div className="space-y-1">
              {summary.recentActivity.slice(0, 3).map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{ACTIVITY_LABELS[entry.activityType] ?? entry.activityType}</span>
                  <span className="text-primary font-medium">+{entry.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/70 pt-1">
          Only you can see your progress — never shared with your employer or coworkers.
        </p>
      </CardContent>
    </Card>
  );
}
