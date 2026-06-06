import { 
  useListCompanySubscriptions, getListCompanySubscriptionsQueryKey,
  useListPractitionerSubscriptions, getListPractitionerSubscriptionsQueryKey
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, User } from "lucide-react";

export default function DashboardSubscriptions() {
  const { data: companySubs, isLoading: isLoadingCompanies } = useListCompanySubscriptions({ 
    query: { queryKey: getListCompanySubscriptionsQueryKey() } 
  });
  
  const { data: practSubs, isLoading: isLoadingPractitioners } = useListPractitionerSubscriptions({ 
    query: { queryKey: getListPractitionerSubscriptionsQueryKey() } 
  });

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant="outline" className={
      status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
      status === 'trial' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
      'bg-muted text-muted-foreground'
    }>
      {status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Subscriptions</h1>
        <p className="text-muted-foreground text-sm">Active billing plans across the marketplace.</p>
      </div>

      <Tabs defaultValue="corporate" className="w-full">
        <TabsList className="grid w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="corporate" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Corporate
          </TabsTrigger>
          <TabsTrigger value="practitioner" className="flex items-center gap-2">
            <User className="h-4 w-4" /> Practitioners
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="corporate">
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="pb-0 pt-6 px-6">
              <CardTitle className="text-lg font-serif">Corporate Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-6">Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCompanies ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
                  ) : companySubs?.length ? (
                    companySubs.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="pl-6 font-medium text-sm">{sub.companyName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.planName}</TableCell>
                        <TableCell className="text-sm font-medium">£{sub.priceGbp}/mo</TableCell>
                        <TableCell><StatusBadge status={sub.status} /></TableCell>
                        <TableCell className="text-right pr-6 text-sm text-muted-foreground">
                          {format(new Date(sub.startDate), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No corporate subscriptions.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="practitioner">
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="pb-0 pt-6 px-6">
              <CardTitle className="text-lg font-serif">Practitioner Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-6">Practitioner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPractitioners ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
                  ) : practSubs?.length ? (
                    practSubs.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="pl-6 font-medium text-sm">{sub.practitionerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sub.planName}</TableCell>
                        <TableCell className="text-sm font-medium">£{sub.priceGbp}/mo</TableCell>
                        <TableCell><StatusBadge status={sub.status} /></TableCell>
                        <TableCell className="text-right pr-6 text-sm text-muted-foreground">
                          {format(new Date(sub.startDate), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No practitioner subscriptions.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
