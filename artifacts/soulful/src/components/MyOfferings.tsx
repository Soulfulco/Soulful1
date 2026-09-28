import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, PoundSterling } from "lucide-react";

type Rates = {
  inPersonRateGbp: string;
  onlineRateGbp: string;
  groupInPersonRateGbp: string;
  groupOnlineRateGbp: string;
};

const EMPTY: Rates = {
  inPersonRateGbp: "",
  onlineRateGbp: "",
  groupInPersonRateGbp: "",
  groupOnlineRateGbp: "",
};

const OFFERINGS: { key: keyof Rates; label: string; hint: string }[] = [
  { key: "inPersonRateGbp", label: "1:1 in-person", hint: "One person, in person" },
  { key: "onlineRateGbp", label: "1:1 online", hint: "One person, online" },
  { key: "groupInPersonRateGbp", label: "Group in-person", hint: "Up to 50 people, in person" },
  { key: "groupOnlineRateGbp", label: "Group online", hint: "Up to 50 people, online" },
];

function toInput(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function ratesFrom(data: Record<string, unknown>): Rates {
  return {
    inPersonRateGbp: toInput(data.inPersonRateGbp),
    onlineRateGbp: toInput(data.onlineRateGbp),
    groupInPersonRateGbp: toInput(data.groupInPersonRateGbp),
    groupOnlineRateGbp: toInput(data.groupOnlineRateGbp),
  };
}

export function MyOfferings() {
  const [rates, setRates] = useState<Rates>(EMPTY);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [approval, setApproval] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/practitioner/me", { credentials: "include" });
        if (!res.ok) throw new Error("Could not load your profile");
        const data = await res.json();
        // If the API doesn't send the rate fields, don't show blanks that could
        // end up overwriting real prices.
        if (!("inPersonRateGbp" in data)) throw new Error("Rates missing from profile response");
        if (cancelled) return;
        setRates(ratesFrom(data));
        setApproval(typeof data.approvalStatus === "string" ? data.approvalStatus : null);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setMessage(null);
    const payload: Record<string, number | null> = {};
    let anyRate = false;
    for (const o of OFFERINGS) {
      const raw = rates[o.key].trim();
      if (!raw) {
        payload[o.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        setMessage({ kind: "error", text: `${o.label}: enter a price between £0 and £10,000.` });
        return;
      }
      payload[o.key] = n > 0 ? n : null;
      if (n > 0) anyRate = true;
    }
    if (!anyRate) {
      setMessage({ kind: "error", text: "Set a price for at least one offering." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/practitioner/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save your price list");
      setRates(ratesFrom(body));
      setMessage({ kind: "ok", text: "Price list saved." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not save your price list" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PoundSterling className="h-5 w-5" /> My Offerings
        </CardTitle>
        <CardDescription>
          Your price list. Employers see these on your profile and choose which one to book.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {approval === "pending" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your application is pending. Complete your price list ahead of your onboarding call. Your profile goes live once Soulful approves it.
            </AlertDescription>
          </Alert>
        )}

        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading your price list…</p>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn't load your current rates, so editing is switched off to avoid overwriting them. Please refresh the page, or contact Soulful if this continues.
            </AlertDescription>
          </Alert>
        )}

        {status === "ready" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {OFFERINGS.map((o) => (
                <div key={o.key} className="grid gap-1.5">
                  <Label htmlFor={o.key}>{o.label} (£)</Label>
                  <Input
                    id={o.key}
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    inputMode="decimal"
                    className="bg-background h-11"
                    placeholder="Not offered"
                    value={rates[o.key]}
                    onChange={(e) => setRates((r) => ({ ...r, [o.key]: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{o.hint}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Events</strong> are priced by bespoke quotation through Soulful, so there's no rate to set here.
            </div>

            <p className="text-xs text-muted-foreground">
              Leave a box empty if you don't offer it. At least one price is required.
            </p>

            {message && (
              <p className={`text-sm ${message.kind === "ok" ? "text-green-700" : "text-destructive"}`}>
                {message.text}
              </p>
            )}

            <Button onClick={save} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save price list"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MyOfferings;
