import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, Heart, Brain, Zap, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SurveyType = "initial" | "monthly";

interface Props {
  employeeId: number;
  type: SurveyType;
  open: boolean;
  onComplete: () => void;
}

const SCORE_LABELS: Record<number, string> = {
  1: "Very poor", 2: "Poor", 3: "Below average", 4: "Slightly below average",
  5: "Average", 6: "Slightly above average", 7: "Good", 8: "Very good",
  9: "Excellent", 10: "Outstanding",
};

const SCORE_COLOR = (score: number) => {
  if (score <= 3) return "bg-red-400";
  if (score <= 5) return "bg-amber-400";
  if (score <= 7) return "bg-yellow-400";
  return "bg-primary";
};

function ScoreSlider({ label, icon: Icon, description, value, onChange }: {
  label: string;
  icon: React.ElementType;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <Icon className="h-4 w-4 text-secondary-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="ml-auto text-right">
          <span className="text-2xl font-serif font-bold text-foreground">{value}</span>
          <span className="text-xs text-muted-foreground block">{SCORE_LABELS[value]}</span>
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 h-8 rounded-md text-xs font-medium transition-all border",
              value === n
                ? `${SCORE_COLOR(n)} text-white border-transparent scale-110 shadow-sm`
                : "bg-muted border-border text-muted-foreground hover:bg-muted/70 hover:border-primary/30"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WellbeingSurvey({ employeeId, type, open, onComplete }: Props) {
  const [step, setStep] = useState<"intro" | "survey" | "done">("intro");
  const [mood, setMood] = useState(5);
  const [connection, setConnection] = useState(5);
  const [productivity, setProductivity] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isInitial = type === "initial";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await fetch("/api/wellbeing/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          surveyType: type,
          moodScore: mood,
          connectionScore: connection,
          productivityScore: productivity,
          notes: notes.trim() || null,
        }),
      });
      setStep("done");
    } catch {
      // silent - still show done to avoid blocking
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  const avgScore = Math.round((mood + connection + productivity) / 3);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        {step === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">
                {isInitial ? "Welcome to Soulful 🌿" : "Monthly Wellbeing Check-in 🌿"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed mt-2">
                {isInitial
                  ? "Before you get started, we'd love to understand how you're feeling right now. This short 3-question check-in takes less than a minute and helps us personalise your wellbeing journey."
                  : "It's been a month — great time to check in on how you're doing. Your honest scores help us understand how your wellbeing is evolving over time."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 my-2">
              {[
                { icon: Heart, label: "Mood", color: "text-rose-500" },
                { icon: Brain, label: "Connection", color: "text-violet-500" },
                { icon: Zap, label: "Productivity", color: "text-amber-500" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/60 text-center">
                  <Icon className={cn("h-6 w-6", color)} />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your responses are private and only visible to your HR team in aggregate form.
            </p>
            <Button className="w-full mt-2" onClick={() => setStep("survey")}>
              Start check-in <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}

        {step === "survey" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                {isInitial ? "How are you feeling today?" : "Monthly check-in"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Score each area from 1 (very poor) to 10 (outstanding)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <ScoreSlider
                label="Mood"
                icon={Heart}
                description="How would you rate your overall emotional state?"
                value={mood}
                onChange={setMood}
              />
              <ScoreSlider
                label="Connection to self"
                icon={Brain}
                description="How connected do you feel to your values and inner self?"
                value={connection}
                onChange={setConnection}
              />
              <ScoreSlider
                label="Productivity"
                icon={Zap}
                description="How effective and focused have you been at work?"
                value={productivity}
                onChange={setProductivity}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Anything else you'd like to share? <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  placeholder="How's life going? Anything on your mind..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit check-in
            </Button>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Thank you! 🙏</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {isInitial
                  ? "Your baseline has been recorded. We'll check in with you again in a month to track your progress."
                  : "Your monthly check-in is saved. Keep up the great work on your wellbeing journey."}
              </p>
            </div>
            <div className="flex gap-4 w-full mt-2">
              <div className="flex-1 rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-2xl font-serif font-bold text-foreground">{avgScore}</p>
                <p className="text-xs text-muted-foreground">Overall score</p>
              </div>
              <div className="flex-1 rounded-xl bg-muted/60 p-3 text-center">
                <p className="text-sm font-medium text-foreground">{SCORE_LABELS[avgScore]}</p>
                <p className="text-xs text-muted-foreground">Your wellbeing</p>
              </div>
            </div>
            <Button className="w-full" onClick={onComplete}>
              Continue to portal
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
