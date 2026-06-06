import { useListPractitioners, getListPractitionersQueryKey, useUpdatePractitioner } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPractitioners() {
  const { toast } = useToast();
  const updatePractitioner = useUpdatePractitioner();

  const { data: practitioners, isLoading, refetch } = useListPractitioners(
    {}, 
    { query: { queryKey: getListPractitionersQueryKey() } }
  );

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updatePractitioner.mutate({
      id,
      data: { isActive: !currentStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Status updated", description: `Practitioner is now ${!currentStatus ? 'active' : 'inactive'}.` });
        refetch();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Practitioners Directory</h1>
        <p className="text-muted-foreground text-sm">Manage practitioner profiles and directory visibility.</p>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Practitioner</TableHead>
                <TableHead>Specialism</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Directory Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-24" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-16" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : practitioners?.length ? (
                practitioners.map((practitioner) => (
                  <TableRow key={practitioner.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif text-xs overflow-hidden shrink-0">
                          {practitioner.avatarUrl ? (
                            <img src={practitioner.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            practitioner.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{practitioner.name}</div>
                          <div className="text-xs text-muted-foreground">{practitioner.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{practitioner.specialism}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">£{practitioner.sessionRateGbp}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        practitioner.subscriptionStatus === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
                        practitioner.subscriptionStatus === 'trial' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                        'bg-muted text-muted-foreground'
                      }>
                        {practitioner.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {practitioner.isActive ? 'Active' : 'Hidden'}
                        </span>
                        <Switch 
                          checked={practitioner.isActive} 
                          onCheckedChange={() => handleToggleActive(practitioner.id, practitioner.isActive)}
                          disabled={updatePractitioner.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No practitioners found.
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
