import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListCompanies } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Calendar, Users, MapPin, Clock, Inbox, AlertCircle, Sparkles } from "lucide-react";

type Proposal = {
  id: number;
  practitioner_id: number;
  practitioner_name: string;
  practitioner_email: string;
  practitioner_specialism: string;
  practitioner_avatar: string | null;
  session_type: string;
  description: string | null;
  proposed_date: string;
  duration_minutes: number;
  max_attendees: number;
  location_type: string;
  location_description: string | null;
  price_model: string;
  target_company_id: number | null;
  company_name: string | null;
  status: "pending" | "approved" | "rejected" | "scheduled";
  admin_notes: string | null;
  created_at: string;
};

const LOCATION_LABELS: Record<string, string> = {
  virtual: "Virtual",
  at_office: "At their office",
  practitioner_space: "Practitioner's space",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending review", variant: "outline" },
  approved: { label: "Approved", variant: "secondary" },
  scheduled: { label: "Scheduled ✓", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function useProposals(status?: string) {
  return useQuery<Proposal[]>({
    queryKey: ["proposals", status],
    queryFn: async () => {
      const url = status ? `/api/proposals?status=${status}` : "/api/proposals";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function ProposalCard({ proposal, onAction }: { proposal: Proposal; onAction: () => void }) {
  const queryClient = useQueryClient();
  const { data: companiesData } = useListCompanies();
  const companies = companiesData?.data ?? [];

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany) throw new Error("Select a company");
      const res = await fetch(`/api/proposals/${proposal.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: Number(selectedCompany), adminNotes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      setApproveOpen(false);
      onAction();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/proposals/${proposal.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes || null }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      setRejectOpen(false);
      onAction();
    },
  });

  const initials = proposal.practitioner_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="pt-5 space-y-4">
          {/* Practitioner + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {proposal.practitioner_avatar ? (
                <img src={proposal.practitioner_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground">
                  {initials}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{proposal.practitioner_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{proposal.practitioner_specialism}</p>
              </div>
            </div>
            <Badge variant={STATUS_BADGE[proposal.status].variant} className="text-xs shrink-0">
              {STATUS_BADGE[proposal.status].label}
            </Badge>
          </div>

          {/* Session info */}
          <div>
            <p className="text-base font-semibold text-foreground">{proposal.session_type}</p>
            {proposal.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{proposal.description}</p>
            )}
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <Calendar className="h-3 w-3" />
              {format(parseISO(proposal.proposed_date), "EEE d MMM, h:mm a")}
            </span>
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" />
              {proposal.duration_minutes} min
            </span>
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <Users className="h-3 w-3" />
              Up to {proposal.max_attendees}
            </span>
            <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
              <MapPin className="h-3 w-3" />
              {LOCATION_LABELS[proposal.location_type] ?? proposal.location_type}
            </span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${proposal.price_model === "included" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
              {proposal.price_model === "included" ? "Included in subscription" : "Additional fee"}
            </span>
          </div>

          {/* Scheduled info */}
          {proposal.status === "scheduled" && proposal.company_name && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-primary">
              Scheduled for <strong>{proposal.company_name}</strong>
            </div>
          )}

          {/* Admin notes */}
          {proposal.admin_notes && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">{proposal.admin_notes}</p>
          )}

          {/* Actions */}
          {proposal.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => { setApproveOpen(true); setActionError(null); }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve & schedule
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setRejectOpen(true); setActionError(null); }}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve &amp; schedule session</DialogTitle>
            <DialogDescription>
              Choose which company should receive this session. It will be added directly to their group sessions calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to company</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Internal note (optional)</label>
              <Textarea
                placeholder="e.g. Great fit for Meridian's mindfulness programme"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">This will:</p>
              <p>✦ Create a group session in the company's calendar</p>
              <p>✦ Employees can immediately sign up from their portal</p>
              <p>✦ Notify the practitioner of the booking</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setApproveOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm &amp; schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline proposal</DialogTitle>
            <DialogDescription>Optionally add a reason for the practitioner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea
              placeholder="e.g. No suitable time slot available, or we've recently had a similar session"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Decline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DashboardProposals() {
  const [tab, setTab] = useState("pending");
  const { data: proposals = [], isLoading, refetch } = useProposals(tab === "all" ? undefined : tab);

  const pendingCount = proposals.filter(p => p.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            Session Proposals
            {tab === "pending" && pendingCount > 0 && (
              <Badge className="text-xs">{pendingCount} pending</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Practitioners pitch sessions here — review and schedule them onto corporate calendars
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="rejected">Declined</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {tab === "pending" ? (
              <>
                <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">No pending proposals</CardTitle>
                <CardDescription className="max-w-sm">
                  When practitioners submit a session proposal, it appears here for review.
                  Share the proposal link with your practitioner network to get started.
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <a href="/propose-session" target="_blank" rel="noopener noreferrer">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> View proposal form
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Inbox className="h-10 w-10 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">Nothing here yet</CardTitle>
                <CardDescription>No proposals with this status.</CardDescription>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {proposals.map(p => (
            <ProposalCard key={p.id} proposal={p} onAction={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
