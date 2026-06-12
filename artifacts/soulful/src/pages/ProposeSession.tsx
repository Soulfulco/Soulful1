import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, AlertCircle, Calendar, Users, MapPin, Sparkles, ArrowLeft, Clock } from "lucide-react";

const SESSION_TYPES = [
  "Yoga", "Meditation", "Breathwork", "Sound Healing", "Nutrition Talk",
  "Mindfulness Workshop", "Stress Management", "Coaching Session",
  "Movement & Mobility", "Sleep Workshop", "Mental Health Talk",
  "Resilience Training", "Team Wellness", "Other",
];

const LOCATION_TYPES = [
  { value: "virtual", label: "Virtual (online)" },
  { value: "at_office", label: "At the company's office" },
  { value: "practitioner_space", label: "At my studio / space" },
];

const PRICE_MODELS = [
  { value: "included", label: "Included in corporate subscription", description: "No extra charge — offered as part of the Soulful package" },
  { value: "paid", label: "Additional fee applies", description: "You set a per-session or per-head rate" },
];

const HOW_IT_WORKS = [
  { icon: Sparkles, title: "Submit your proposal", body: "Fill in the details of the session you'd like to offer — type, date, format, and capacity." },
  { icon: Calendar, title: "Soulful reviews it", body: "Our team reviews within 2 business days and matches you to companies that would benefit." },
  { icon: Users, title: "Employees sign up", body: "Once approved it goes live on the company's calendar and employees can sign up instantly." },
];

export default function ProposeSession() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    practitionerEmail: "",
    sessionType: "",
    customSessionType: "",
    description: "",
    proposedDate: "",
    proposedTime: "10:00",
    durationMinutes: "60",
    maxAttendees: "20",
    locationType: "virtual",
    locationDescription: "",
    priceModel: "included",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const sessionType = form.sessionType === "Other" ? form.customSessionType : form.sessionType;
    if (!sessionType) { setError("Please specify a session type"); setLoading(false); return; }

    const proposedDate = `${form.proposedDate}T${form.proposedTime}:00`;

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practitionerEmail: form.practitionerEmail,
          sessionType,
          description: form.description || null,
          proposedDate,
          durationMinutes: Number(form.durationMinutes),
          maxAttendees: Number(form.maxAttendees),
          locationType: form.locationType,
          locationDescription: form.locationDescription || null,
          priceModel: form.priceModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Submission failed"); return; }
      setStep("success");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-secondary/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">Proposal submitted!</h1>
            <p className="text-muted-foreground leading-relaxed">
              Thank you — our team will review your session proposal within 2 business days.
              If approved, it'll be scheduled and you'll receive a confirmation email.
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-5 text-left space-y-2">
            <p className="text-sm font-medium text-foreground">What happens next?</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✦ We'll match your session to the right company</li>
              <li>✦ You'll get an email confirmation with the booking details</li>
              <li>✦ Employees can sign up directly through their portal</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild className="flex-1">
              <Link href="/for-practitioners">Back to practitioners</Link>
            </Button>
            <Button className="flex-1" onClick={() => { setStep("form"); setForm(f => ({ ...f, proposedDate: "", description: "" })); }}>
              Submit another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-secondary/5 border-b border-secondary/10 py-14">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link href="/for-practitioners" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to practitioners
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-full text-sm font-medium mb-5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Offer a session
          </div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-3">
            Propose a corporate session
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Pitch a group session to be added to one of our corporate clients' wellbeing calendars — no cold outreach needed.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl mt-14">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Left: How it works */}
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-serif font-semibold text-foreground mb-6">How it works</h2>
              <div className="space-y-6">
                {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-secondary/30 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-secondary/10 p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">You must be a listed practitioner</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Proposals are verified against your registered email. Not on the platform yet?
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/for-practitioners">Apply to join →</Link>
              </Button>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-border/50">
              <CardHeader>
                <CardTitle className="font-serif text-xl">Session details</CardTitle>
                <CardDescription>Tell us about the session you'd like to offer</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Practitioner email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Your registered email <span className="text-destructive">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.practitionerEmail}
                      onChange={e => set("practitionerEmail", e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Must match your Soulful practitioner account</p>
                  </div>

                  {/* Session type */}
                  <div className="space-y-2">
                    <Label>Session type <span className="text-destructive">*</span></Label>
                    <Select value={form.sessionType} onValueChange={v => set("sessionType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a session type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.sessionType === "Other" && (
                      <Input
                        placeholder="Describe your session type"
                        value={form.customSessionType}
                        onChange={e => set("customSessionType", e.target.value)}
                        required
                      />
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">What will this session involve?</Label>
                    <Textarea
                      id="description"
                      placeholder="Briefly describe what participants can expect — exercises, topics, format, outcomes..."
                      value={form.description}
                      onChange={e => set("description", e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Date & time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Proposed date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={form.proposedDate}
                        onChange={e => set("proposedDate", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time" className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Preferred time
                      </Label>
                      <Input
                        id="time"
                        type="time"
                        value={form.proposedTime}
                        onChange={e => set("proposedTime", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Duration & capacity */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Select value={form.durationMinutes} onValueChange={v => set("durationMinutes", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[30, 45, 60, 75, 90, 120].map(d => (
                            <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacity" className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" /> Max attendees
                      </Label>
                      <Input
                        id="capacity"
                        type="number"
                        min={1}
                        max={200}
                        value={form.maxAttendees}
                        onChange={e => set("maxAttendees", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Format / location
                    </Label>
                    <Select value={form.locationType} onValueChange={v => set("locationType", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATION_TYPES.map(l => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.locationType !== "virtual" && (
                      <Input
                        placeholder={form.locationType === "at_office" ? "We'll coordinate the address with the company" : "Studio / space address or link"}
                        value={form.locationDescription}
                        onChange={e => set("locationDescription", e.target.value)}
                      />
                    )}
                  </div>

                  {/* Price model */}
                  <div className="space-y-2">
                    <Label>Pricing model</Label>
                    <div className="space-y-2">
                      {PRICE_MODELS.map(m => (
                        <label
                          key={m.value}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.priceModel === m.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                        >
                          <input
                            type="radio"
                            name="priceModel"
                            value={m.value}
                            checked={form.priceModel === m.value}
                            onChange={() => set("priceModel", m.value)}
                            className="mt-0.5 accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{m.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit proposal
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
