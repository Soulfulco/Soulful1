import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Mail } from "lucide-react";

type Subscriber = {
  id: number;
  email: string;
  name: string | null;
  source: string;
  hubspotContactId: string | null;
  syncedAt: string | null;
  syncError: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardMailingList() {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resyncingId, setResyncingId] = useState<number | null>(null);

  const load = () => {
    setIsLoading(true);
    fetch("/api/mailing-list/subscribers", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setSubscribers)
      .catch(() => toast({ title: "Error", description: "Could not load subscribers.", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const resync = async (id: number) => {
    setResyncingId(id);
    try {
      const res = await fetch(`/api/mailing-list/subscribers/${id}/resync`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Synced", description: "Subscriber pushed to HubSpot." });
      load();
    } catch {
      toast({ title: "Sync failed", description: "Could not sync to HubSpot.", variant: "destructive" });
    } finally {
      setResyncingId(null);
    }
  };

  const syncedCount = subscribers.filter((s) => s.hubspotContactId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Mailing List</h1>
          <p className="text-muted-foreground text-sm">
            Subscribers from the site footer, synced to HubSpot contacts.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          {syncedCount} / {subscribers.length} synced to HubSpot
        </Badge>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>HubSpot</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((_, j) => (
                      <TableCell key={j}><div className="h-6 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : subscribers.length ? (
                subscribers.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{s.email}</TableCell>
                    <TableCell className="text-sm">{s.name ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{s.source}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                    <TableCell>
                      {s.hubspotContactId ? (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Synced</Badge>
                      ) : s.syncError ? (
                        <Badge variant="destructive" title={s.syncError}>Failed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => resync(s.id)}
                        disabled={resyncingId === s.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${resyncingId === s.id ? "animate-spin" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No subscribers yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
