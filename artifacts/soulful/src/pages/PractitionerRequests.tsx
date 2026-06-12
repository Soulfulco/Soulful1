import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Users, MapPin, CheckCircle2, XCircle,
  Loader2, AlertCircle, Inbox, ArrowLeft, Sparkles, Building2
} from "lucide-react";
import { Link } from "wouter";

const SPECIALISM_OPTIONS = [
  "yoga", "meditation", "nutrition", "massage", "coaching",
  "breathwork", "sound healing",
];

type Request = {
  id: number;
  session_type: string;
  specialism: string;
  requested_date: string;
  duration_minutes: number;
  max_attendees: number;
  location_type: string;
  notes: string | null;
  status: "open" | "accepted" | "declined" | "expired";
  company_name: string;
  template_name: string | null;
  template_colour: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
};

const LOCATION_LABELS: Record<string, string> = {
  virtual: "Virtual",
  at_office: "At client's office",
  practitioner_space: "Your space",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Confirmed", color: "bg-green-50 text-green-700 border-green-200" },
  declined: { label: "Declined", color: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground border-border" },
};

function EmailVerificationStep({ onVerified }: { onVerified: (email: string, specialism: string) => void }) {
  const [email, setEmail] = useState("");
  const [specialism, setSpecialism] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/practitioners?search=${encodeURIComponent(email)}`);
      const data = await res.json();
      const match = data.find((p: any) => p.email?.toLowerCase() === email.toLowerCase() && p.isActive);
      if (!match) {
        setError("No active Soulful practitioner account found with that email.");
        return;
      }
      onVerified(email, match.specialism ?? specialism);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Practitioner Booking Requests</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter your registered email to see open session requests from our corporate clients.
          </p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Your registered email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                View my requests
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Not yet a practitioner?{" "}
          <Link href="/for-practitioners" className="underline hover:text-foreground">Apply to join</Link>
        </p>
      </div>
    </div>
  );
}

function RequestCard({ request, email, onAction }: { request: Request; email: string; onAction: () => void }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const daysUntil = differenceInDays(new Date(request.requested_date), new Date());
  const isUrgent = daysUntil >= 0 && daysUntil <= 5;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/booking-requests/${request.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practitionerEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pr-requests"] }); onAction(); },
    onError: (err: Error) => setActionError(err.message),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/booking-requests/${request.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pr-requests"] }); onAction(); },
  });

  const statusCfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.open;

  return (
    <Card className={`overflow-hidden ${request.status === "open" ? "border-border" : "opacity-70"}`}>
      {request.template_colour && <div className="h-1 w-full" style={{ backgroundColor: request.template_colour }} />}
      <CardContent className="pt-4 space-y-3">
        {actionError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">{actionError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{request.session_type}</h3>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{request.specialism}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusCfg.color}`}>{statusCfg.label}</span>
            {isUrgent && request.status === "open" && (
              <span className="text-xs text-amber-600 font-medium">⚡ {daysUntil === 0 ? "Today" : `${daysUntil}d left`}</span>
            )}
          </div>
        </div>

        {request.notes && (
          <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2">{request.notes}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <Calendar className="h-3 w-3" />
            {format(new Date(request.requested_date), "EEE d MMM, h:mm a")}
          </span>
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            {request.duration_minutes} min
          </span>
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <Users className="h-3 w-3" />
            Up to {request.max_attendees}
          </span>
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <MapPin className="h-3 w-3" />
            {LOCATION_LABELS[request.location_type] ?? request.location_type}
          </span>
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <Building2 className="h-3 w-3" />
            {request.company_name}
          </span>
        </div>

        {request.template_name && (
          <p className="text-xs text-muted-foreground">Part of: <span className="font-medium text-foreground">{request.template_name}</span></p>
        )}

        {request.status === "open" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || declineMutation.isPending}>
              {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Accept
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending || acceptMutation.isPending}>
              {declineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
              Decline
            </Button>
          </div>
        )}

        {request.status === "accepted" && request.accepted_by_name && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            ✓ Confirmed by {request.accepted_by_name}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RequestsView({ email, specialism }: { email: string; specialism: string }) {
  const [tab, setTab] = useState("open");
  const queryClient = useQueryClient();

  const { data: all = [], isLoading, refetch } = useQuery<Request[]>({
    queryKey: ["pr-requests", email],
    queryFn: async () => {
      const res = await fetch(`/api/booking-requests?specialism=${encodeURIComponent(specialism)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filtered = tab === "all" ? all : all.filter(r => r.status === tab);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-secondary/5 border-b border-secondary/10 py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-foreground">Booking Requests</h1>
              <p className="text-sm text-muted-foreground">{email} · <span className="capitalize">{specialism}</span></p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These are open session slots from Soulful corporate clients that match your specialism.
            Accept a slot and it's automatically added to the company's calendar — no further action needed.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-8 space-y-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open ({all.filter(r => r.status === "open").length})</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-semibold text-foreground mb-1">
              {tab === "open" ? "No open requests right now" : "Nothing here"}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {tab === "open"
                ? "When a company schedules a programme that needs your specialism, requests will appear here."
                : "No requests with this status yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map(r => (
              <RequestCard key={r.id} request={r} email={email} onAction={refetch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PractitionerRequests() {
  const [verified, setVerified] = useState<{ email: string; specialism: string } | null>(null);

  if (!verified) {
    return <EmailVerificationStep onVerified={(email, specialism) => setVerified({ email, specialism })} />;
  }

  return <RequestsView email={verified.email} specialism={verified.specialism} />;
}
