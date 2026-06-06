import { useListCompanies, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DashboardCompanies() {
  const { data: companies, isLoading } = useListCompanies({ 
    query: { queryKey: getListCompaniesQueryKey() } 
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Registered Companies</h1>
        <p className="text-muted-foreground text-sm">Corporate clients providing wellbeing services to their teams.</p>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry / Size</TableHead>
                <TableHead>Admin Contact</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : companies?.length ? (
                companies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium text-sm">{company.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.totalBookings} total bookings</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{company.industry}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.employeeCount} employees</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{company.contactName || "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{company.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        company.subscriptionStatus === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
                        company.subscriptionStatus === 'trial' ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                        'bg-muted text-muted-foreground'
                      }>
                        {company.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(company.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No companies found.
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
