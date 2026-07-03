import { useState } from "react";
import { useListBookings, getListBookingsQueryKey, useUpdateBooking } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Building2, User, Clock, ChevronDown, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DashboardBookings() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const updateBooking = useUpdateBooking();

  const { data: bookings, isLoading, refetch } = useListBookings(
    { status: statusFilter !== "all" ? statusFilter as any : undefined },
    { query: { queryKey: getListBookingsQueryKey({ status: statusFilter !== "all" ? statusFilter as any : undefined }) } }
  );

  const handleStatusChange = (id: number, newStatus: any) => {
    updateBooking.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        toast({ title: "Booking updated", description: `Status changed to ${newStatus}.` });
        refetch();
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return 'bg-primary/20 text-primary border-primary/30';
      case 'completed': return 'bg-muted text-muted-foreground border-border';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'pending': default: return 'bg-secondary/20 text-secondary border-secondary/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif text-foreground">All Bookings</h1>
          <p className="text-muted-foreground text-sm">Manage and track wellbeing sessions across the platform.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px]">Session / Time</TableHead>
                <TableHead>Practitioner</TableHead>
                <TableHead>Client (Company)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-24" /></TableCell>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded w-32" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell><div className="h-8 bg-muted animate-pulse rounded w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : bookings?.length ? (
                bookings.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium text-sm capitalize">{booking.sessionType}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {booking.startTime ? format(new Date(booking.startTime), "MMM d, h:mm a") : "TBD"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{booking.practitionerName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(booking as any).shareWithEmployer === false ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground italic">
                          <EyeOff className="h-3.5 w-3.5 shrink-0" />
                          Private booking
                        </div>
                      ) : (
                        <div className="text-sm font-medium">{booking.employeeName}</div>
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {booking.companyName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 data-[state=open]:bg-muted">
                            Update <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "confirmed")}>Mark Confirmed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "completed")}>Mark Completed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "cancelled")} className="text-destructive">Cancel Booking</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No bookings found.
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
