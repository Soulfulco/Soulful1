import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, HelpCircle, Bell, Smile, Meh, Frown } from "lucide-react";
import { format, parseISO } from "date-fns";

type RequirementStatus = "on_track" | "due_soon" | "overdue" | "no_data";

interface Requirement {
  key: string;
  label: string;
  frequencyLabel: string;
  notes: string;
  lastCompletedAt: string | null;
  nextDueAt: string | null;
  status: RequirementStatus;
}

const STATUS_CONFIG: Record<RequirementStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  on_track: { label: "On track", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due_soon: { label: "Due soon", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  no_data: { label: "Not started", className: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
};

const MOODS = [
  { value: "great", label: "Great", icon: Smile, className: "text-emerald-600" },
  { value: "okay", label: "Okay", icon: Meh, className: "text-amber-600" },
  { value: "struggling", label: "Struggling", icon: Frown, className: "text-red-600" },
];

export default function WellbeingRequirementsWidget({ employeeId }: { employeeId: number }) {
  const [requirements, setRequirements] = useState<Requirement[] | null>(null);
  const [submittingMood, setSubmittingMood] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  const loadRequirements = useCallback(() => {
    fetch(`/api/employees/${employeeId}/wellbeing-requirements`)
      .then((r) => r.json())
      .then((data) => setRequirements(data.requirements ?? []))
      .catch(() => {});
  }, [employeeId]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const moodCheckin = requirements?.find((r) => r.key === "mood_checkin");
  const moodDue = moodCheckin && (moodCheckin.status === "due_soon" || moodCheckin.status === "overdue" || moodCheckin.status === "no_data");

  // Ask for browser notification permission once, then nudge if the weekly mood check-in is overdue.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (!moodDue) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then(setNotifPermission);
      return;
    }
    if (Notification.permission === "granted" && moodCheckin?.status === "overdue") {
      const key = `soulful_mood_notif_${employeeId}_${new Date().toDateString()}`;
      if (!sessionStorage.getItem(key)) {
        new Notification("Soulful — Weekly mood check-in", {
          body: "It's been a while since your last mood check-in. Take 10 seconds to log how you're feeling.",
          icon: "/images/logo.png",
        });
        sessionStorage.setItem(key, "1");
      }
    }
  }, [moodDue, moodCheckin?.status, employeeId]);

  const submitMoodCheckin = async (mood: string) => {
    setSubmittingMood(mood);
    try {
      await fetch("/api/wellbeing/mood-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, mood }),
      });
      // Still record the check-in as usual, but if someone tells us they're
      // struggling, take them straight to support resources rather than just
      // silently marking the weekly requirement complete like any other mood.
      if (mood === "struggling") {
        window.location.href = "https://www.soulfulco.uk/signposting";
        return;
      }
      loadRequirements();
    } catch {}
    setSubmittingMood(null);
  };

  if (!requirements) return null;

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-serif">Your Wellbeing Minimums</CardTitle>
            <CardDescription className="text-xs">
              Base engagement expected by your company's wellbeing strategy
            </CardDescription>
          </div>
          {notifPermission === "denied" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bell className="h-3 w-3" /> Enable notifications for check-in reminders
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {moodDue && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-medium">How are you feeling this week?</p>
            <div className="flex gap-2">
              {MOODS.map(({ value, label, icon: Icon, className }) => (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  disabled={submittingMood !== null}
                  onClick={() => submitMoodCheckin(value)}
                  className="gap-1.5"
                >
                  <Icon className={`h-4 w-4 ${className}`} /> {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="font-medium py-2 px-2">Activity</th>
                <th className="font-medium py-2 px-2">Minimum</th>
                <th className="font-medium py-2 px-2">Last completed</th>
                <th className="font-medium py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requirements.map((req) => {
                const cfg = STATUS_CONFIG[req.status];
                const Icon = cfg.icon;
                return (
                  <tr key={req.key}>
                    <td className="py-2.5 px-2">
                      <p className="font-medium">{req.label}</p>
                      {req.notes && <p className="text-xs text-muted-foreground">{req.notes}</p>}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">{req.frequencyLabel}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">
                      {req.lastCompletedAt ? format(parseISO(req.lastCompletedAt), "d MMM yyyy") : "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
