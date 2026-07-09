import { useCallback, useEffect, useState } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Copy, Check, Gift, Users2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ReferralRow {
  id: number;
  referredCompanyId: number;
  referredCompanyName: string;
  status: "pending" | "rewarded";
  rewardAmountGbp: number | null;
  createdAt: string;
  rewardedAt: string | null;
}

interface ReferralSummary {
  referralCode: string;
  rewardAmountGbp: number;
  totalEarnedGbp: number;
  referrals: ReferralRow[];
}

export default function DashboardReferrals() {
  const { hrSession, isAdminUser } = useAuth();
  const { toast } = useToast();
  const { data: companies = [] } = useListCompanies();

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(hrSession?.companyId ?? null);
  const companyId = hrSession?.companyId ?? selectedCompanyId;

  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    fetch(`/api/companies/${companyId}/referrals`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const shareLink = summary
    ? `${window.location.origin}/for-corporates?ref=${summary.referralCode}`
    : "";

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({ title: "Link copied", description: "Share it with the company you're referring." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Refer & Earn</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Share your referral code with other companies. When they sign a paid contract and complete
            their first payment, you'll earn a reward.
          </p>
        </div>
        {isAdminUser && (
          <Select value={String(selectedCompanyId ?? "")} onValueChange={(v) => setSelectedCompanyId(Number(v))}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!companyId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Gift className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Select a company</CardTitle>
            <CardDescription>Choose a company above to view their referral programme.</CardDescription>
          </CardContent>
        </Card>
      ) : loading || !summary ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Your referral code</CardDescription>
                <CardTitle className="text-2xl font-mono tracking-wider">{summary.referralCode}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Reward per referral</CardDescription>
                <CardTitle className="text-2xl">£{summary.rewardAmountGbp}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total earned</CardDescription>
                <CardTitle className="text-2xl text-primary">£{summary.totalEarnedGbp}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">Share your link</CardTitle>
              <CardDescription className="text-xs">
                Anyone who signs up with this link is automatically linked to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input readOnly value={shareLink} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader>
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" /> Referrals
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Signed up</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Reward</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.referrals.length ? (
                    summary.referrals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.referredCompanyName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseISO(r.createdAt), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            r.status === "rewarded"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground"
                          }>
                            {r.status === "rewarded" ? "Rewarded" : "Pending payment"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {r.status === "rewarded" ? `£${r.rewardAmountGbp}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No referrals yet. Share your link to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
