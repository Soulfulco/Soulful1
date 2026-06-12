import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, CheckCircle2, RotateCcw, AlertCircle, PencilLine } from "lucide-react";

type ContentRow = { key: string; value: string; label: string; section: string };

const SECTION_LABELS: Record<string, string> = {
  homepage: "Homepage",
  "for-corporates": "For Corporates page",
  "for-practitioners": "For Practitioners page",
  footer: "Footer",
  general: "General",
};

function isLong(value: string) {
  return value.length > 80;
}

export default function DashboardContent() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<ContentRow[]>({
    queryKey: ["site-content"],
    queryFn: async () => {
      const res = await fetch("/api/site-content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Initialise edits when data loads
  useEffect(() => {
    if (rows.length) {
      setEdits(Object.fromEntries(rows.map(r => [r.key, r.value])));
    }
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(edits).map(([key, value]) => ({ key, value }));
      const res = await fetch("/api/site-content", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => setError(err.message),
  });

  const hasChanges = rows.some(r => edits[r.key] !== r.value);

  const sections = [...new Set(rows.map(r => r.section))];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-muted-foreground" />
            Site Content
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Edit any text on the public-facing website. Changes go live instantly when you save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEdits(Object.fromEntries(rows.map(r => [r.key, r.value])))}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Discard
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            size="sm"
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
              : saved
              ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Saved!</>
              : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save changes</>}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Changes saved — the website is updated live.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <Card key={section} className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {SECTION_LABELS[section] ?? section}
                  <Badge variant="outline" className="text-xs font-normal">
                    {rows.filter(r => r.section === section).length} fields
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                {rows.filter(r => r.section === section).map(row => {
                  const current = edits[row.key] ?? row.value;
                  const changed = current !== row.value;
                  return (
                    <div key={row.key} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">{row.label}</label>
                        {changed && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">edited</span>}
                      </div>
                      {isLong(row.value) ? (
                        <Textarea
                          value={current}
                          onChange={e => setEdits(prev => ({ ...prev, [row.key]: e.target.value }))}
                          rows={3}
                          className="resize-none text-sm"
                        />
                      ) : (
                        <Input
                          value={current}
                          onChange={e => setEdits(prev => ({ ...prev, [row.key]: e.target.value }))}
                          className="text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
