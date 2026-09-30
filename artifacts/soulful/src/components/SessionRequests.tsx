import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Inbox, Calendar, MapPin, Users, PoundSterling, Building2, Bell } from "lucide-react";

type UnifiedRequest = {
  id: number;
  kind: "1:1" | "group";
  sessionType: string;
  companyName: string | null;
  startTime: string | null;
  endTime: string | null;
  locationType: string | null;
  locationDescription: string | null;
  maxAttendees: number | null;
  notes: string | null;
  decideBy: string | null;
  priceGbp: number | null;
};

const LOCATION_LABELS: Record<string, string> = {
  virtual: "Online",
  at_office: "At the company's office",
  practitioner_space: "Your space",
};

function normalizeBooking(b: any): UnifiedRequest {
  return {
    id: b.id,
    kind: "1:1",
    sessionType: b.sessionType ?? "1:1 session",
    companyName: b.companyName ?? null,
    startTime: b.startTime ?? null,
    endTime: b.endTime ?? null,
    locationType: b.sessionMode === "online" ? "virtual" : b.sessionMode === "in_person" ? "at_office" : null,
    locationDescription: null,
    maxAttendees: null,
    notes: b.notes ?? null,
    decideBy: b.decideBy ?? null,
    priceGbp: b.priceGbp != null ? Number(b.priceGbp) : null,
  };
}

function normalizeGroupSession(g: any): UnifiedRequest {
  return {
    id: g.id,
    kind: "group",
    sessionType: g.session_type ?? "Group session",
    companyName: g.company_name ?? null,
    startTime: g.start_time ?? null,
    endTime: g.end_time ?? null,
    locationType: g.location_type ?? null,
    locationDescription: g.location_description ?? null,
    maxAttendees: g.max_attendees ?? null,
    notes: g.notes ?? null,
    decideBy: g.decide_by ?? null,
    priceGbp: g.price_gbp != null ? Number(g.price_gbp) : null,
  };
}

function hoursLeft(decideBy: string | null): number | null {
  if (!decideBy) return null;
  const ms = new Date(decideBy).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3600000));
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RequestCard({ request, onDecided }: { request: UnifiedRequest; onDecided: () => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [submittingDecline, setSubmittingDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpointBase =
    request.kind === "1:1"
      ? `https://api.soulfulco.uk/api/practitioner/bookings/${request.id}`
      : `https://api.soulfulco.uk/api/practitioner/group-sessions/${request.id}`;

  const accept = async () => {
    setError(null);
    setAccepting(true);
    try {
      const res = await fetch(`${endpointBase}/accept`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not accept this request");
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept this request");
    } finally {
      setAccepting(false);
    }
  };

  const confirmDecline = async () => {
    if (!reason.trim()) {
      setError("Please give a reason for declining.");
      return;
    }
    setError(null);
    setSubmittingDecline(true);
    try {
      const res = await fetch(`${endpointBase}/decline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not decline this request");
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline this request");
    } finally {
      setSubmittingDecline(false);
    }
  };

  const left = hoursLeft(request.decideBy);
  const urgent = left != null && left <= 6;

  return (
    <Card className={urgent ? "border-amber-300" : undefined}>
      <CardContent className="pt-4 space-y-3">
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{request.sessionType}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {request.kind === "1:1" ? "1:1 session" : "Group session"}
            </p>
          </div>
          {left != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${urgent ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground border-border"}`}>
              {left === 0 ? "Respond now" : `${left}h to respond`}
            </span>
          )}
        </div>

        {request.notes && (
          <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2">{request.notes}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
            <Calendar className="h-3 w-3" /> {fmtWhen(request.startTime)}
          </span>
          {request.companyName && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <Building2 className="h-3 w-3" /> {request.companyName}
            </span>
          )}
          {request.kind === "group" && request.locationType && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <MapPin className="h-3 w-3" />
              {LOCATION_LABELS[request.locationType] ?? request.locationType}
              {request.locationDescription ? ` — ${request.locationDescription}` : ""}
            </span>
          )}
          {request.maxAttendees != null && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <Users className="h-3 w-3" /> Up to {request.maxAttendees}
            </span>
          )}
          {request.priceGbp != null && (
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <PoundSterling className="h-3 w-3" /> £{request.priceGbp.toFixed(2)}
            </span>
          )}
        </div>

        {!declining ? (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={accept} disabled={accepting}>
              {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Accept"}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => setDeclining(true)} disabled={accepting}>
              Decline
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <Textarea
              placeholder="Let us know why you can't make this one — this is shared so the right person can be told."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="flex-1" onClick={confirmDecline} disabled={submittingDecline}>
                {submittingDecline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm decline"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDeclining(false); setReason(""); setError(null); }} disabled={submittingDecline}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionRequests() {
  const [requests, setRequests] = useState<UnifiedRequest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [bookingsRes, groupRes] = await Promise.all([
        fetch("https://api.soulfulco.uk/api/practitioner/bookings/requests", { credentials: "include" }),
        fetch("https://api.soulfulco.uk/api/practitioner/group-sessions/requests", { credentials: "include" }),
      ]);
      if (!bookingsRes.ok || !groupRes.ok) throw new Error("Failed to load requests");
      const [bookings, groupSessions] = await Promise.all([bookingsRes.json(), groupRes.json()]);
      const combined = [
        ...(Array.isArray(bookings) ? bookings.map(normalizeBooking) : []),
        ...(Array.isArray(groupSessions) ? groupSessions.map(normalizeGroupSession) : []),
      ].sort((a, b) => {
        const aTime = a.decideBy ? new Date(a.decideBy).getTime() : Infinity;
        const bTime = b.decideBy ? new Date(b.decideBy).getTime() : Infinity;
        return aTime - bTime;
      });
      setRequests(combined);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className={requests.length > 0 ? "border-amber-300" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" /> Session requests
          {requests.length > 0 && (
            <Badge variant="secondary" className="ml-1">{requests.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          You have 24 hours to accept or decline each request. If you can't make one, let us know why so the right person can be told.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "loading" && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Couldn't load your requests. Please refresh the page.</AlertDescription>
          </Alert>
        )}
        {status === "ready" && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No pending requests right now.</p>
          </div>
        )}
        {status === "ready" && requests.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {requests.map((r) => (
              <RequestCard key={`${r.kind}-${r.id}`} request={r} onDecided={load} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionRequests;
