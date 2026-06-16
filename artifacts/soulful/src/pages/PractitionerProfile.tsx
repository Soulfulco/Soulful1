import { useState } from "react";
import { practitionerRates, rateSummary } from "@/lib/utils";
import { 
  useGetPractitioner, getGetPractitionerQueryKey, 
  useListPractitionerSlots, getListPractitionerSlotsQueryKey,
  useGetPractitionerReviews, getGetPractitionerReviewsQueryKey,
  useCreateBooking
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MapPin, Star, Clock, GraduationCap, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function PractitionerProfile({ id }: { id: string }) {
  const practitionerId = parseInt(id, 10);
  const { toast } = useToast();
  
  const { data: practitioner, isLoading: isLoadingProfile } = useGetPractitioner(practitionerId, { 
    query: { enabled: !!practitionerId, queryKey: getGetPractitionerQueryKey(practitionerId) } 
  });
  
  const { data: slots, isLoading: isLoadingSlots } = useListPractitionerSlots(practitionerId, { 
    query: { enabled: !!practitionerId, queryKey: getListPractitionerSlotsQueryKey(practitionerId) } 
  });
  
  const { data: reviews, isLoading: isLoadingReviews } = useGetPractitionerReviews(practitionerId, { 
    query: { enabled: !!practitionerId, queryKey: getGetPractitionerReviewsQueryKey(practitionerId) } 
  });

  const createBooking = useCreateBooking();
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    employeeName: "",
    employeeEmail: "",
    companyId: 1, // Mocking company for now as this would normally come from auth context
    notes: ""
  });

  const availableDates = slots?.filter(s => !s.isBooked).map(s => new Date(s.startTime)) || [];
  const slotsForSelectedDate = slots?.filter(s => 
    !s.isBooked && 
    date && 
    new Date(s.startTime).toDateString() === date.toDateString()
  ) || [];

  const handleBooking = () => {
    if (!selectedSlot) return;
    
    createBooking.mutate({
      data: {
        practitionerId,
        timeSlotId: selectedSlot,
        companyId: bookingForm.companyId,
        sessionType: practitioner?.specialism || "session",
        employeeName: bookingForm.employeeName,
        employeeEmail: bookingForm.employeeEmail,
        notes: bookingForm.notes
      }
    }, {
      onSuccess: () => {
        setIsBookingOpen(false);
        setSelectedSlot(null);
        setBookingForm({ ...bookingForm, employeeName: "", employeeEmail: "", notes: "" });
        toast({
          title: "Session Booked",
          description: "Your wellbeing session has been confirmed.",
        });
      },
      onError: () => {
        toast({
          title: "Booking Failed",
          description: "There was an error booking your session. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  if (isLoadingProfile) {
    return <div className="p-20 text-center text-muted-foreground animate-pulse">Loading practitioner profile...</div>;
  }

  if (!practitioner) {
    return <div className="p-20 text-center text-muted-foreground">Practitioner not found.</div>;
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="h-64 md:h-80 w-full bg-primary/10 relative overflow-hidden">
        {practitioner.avatarUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
            style={{ backgroundImage: `url(${practitioner.avatarUrl})` }}
          />
        )}
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-6xl relative -mt-32">
        <Link href="/practitioners" className="inline-flex items-center gap-2 text-primary bg-background/80 backdrop-blur px-4 py-2 rounded-full mb-6 hover:bg-background transition-colors shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </Link>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-card rounded-3xl p-8 shadow-sm border">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-8">
                <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-background bg-muted shadow-md shrink-0">
                  {practitioner.avatarUrl ? (
                    <img src={practitioner.avatarUrl} alt={practitioner.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-4xl text-primary font-serif bg-primary/10">
                      {practitioner.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-medium uppercase tracking-wider mb-2">
                    {practitioner.specialism}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-2">{practitioner.name}</h1>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {practitioner.location && (
                      <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {practitioner.location}</div>
                    )}
                    {practitioner.averageRating != null && (
                      <div className="flex items-center gap-1 text-foreground font-medium">
                        <Star className="h-4 w-4 fill-secondary text-secondary" /> {practitioner.averageRating.toFixed(1)} 
                        <span className="text-muted-foreground font-normal">({practitioner.totalReviews} reviews)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif mb-3">About</h3>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{practitioner.bio}</p>
                </div>

                {practitioner.qualifications && (
                  <div className="pt-6 border-t">
                    <h3 className="text-xl font-serif mb-3 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" /> Qualifications
                    </h3>
                    <p className="text-muted-foreground">{practitioner.qualifications}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-card rounded-3xl p-8 shadow-sm border">
              <h3 className="text-2xl font-serif mb-6">Client Reviews</h3>
              {isLoadingReviews ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-muted rounded-xl"></div>
                  <div className="h-20 bg-muted rounded-xl"></div>
                </div>
              ) : reviews?.length ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="pb-6 border-b last:border-0 last:pb-0">
                      <div className="flex justify-between mb-2">
                        <div className="font-medium">{review.reviewerName}</div>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-secondary text-secondary' : 'fill-muted text-muted'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No reviews yet for this practitioner.</p>
              )}
            </div>
          </div>

          {/* Sidebar / Booking */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border shadow-sm sticky top-24 overflow-hidden">
              <div className="bg-primary p-6 text-primary-foreground text-center">
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {practitionerRates(practitioner).map((r) => (
                    <div key={r.label}>
                      <div className="text-3xl font-serif mb-1">£{r.value}</div>
                      <div className="text-primary-foreground/80 text-sm">{r.label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-primary-foreground/80 text-sm mt-2">per 60 minute session</div>
              </div>
              
              <CardContent className="p-6">
                <h3 className="font-serif text-xl mb-4">Book a session</h3>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => {
                    // Disable past dates
                    if (date < new Date(new Date().setHours(0,0,0,0))) return true;
                    // Only enable dates with available slots
                    return !availableDates.some(d => d.toDateString() === date.toDateString());
                  }}
                  className="rounded-xl border bg-background/50 p-3 mb-6"
                />

                {date ? (
                  <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Available times on {format(date, 'MMM d')}
                    </h4>
                    {isLoadingSlots ? (
                      <div className="h-10 bg-muted rounded animate-pulse"></div>
                    ) : slotsForSelectedDate.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {slotsForSelectedDate.map(slot => {
                          const slotTime = new Date(slot.startTime);
                          return (
                            <Button 
                              key={slot.id} 
                              variant={selectedSlot === slot.id ? "default" : "outline"}
                              className={`w-full justify-center ${selectedSlot === slot.id ? 'bg-primary' : ''}`}
                              onClick={() => setSelectedSlot(slot.id)}
                            >
                              {format(slotTime, 'h:mm a')}
                            </Button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-center py-4 bg-muted/50 rounded-lg text-muted-foreground">
                        No available slots on this date.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-center py-4 mb-6 bg-muted/50 rounded-lg text-muted-foreground">
                    Select a date to see available times.
                  </div>
                )}

                <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full rounded-full h-12 text-base" 
                      disabled={!selectedSlot}
                    >
                      Continue to Booking
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-serif">Confirm Booking</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-2">
                        <div className="h-10 w-10 rounded-full bg-background border flex items-center justify-center text-primary font-serif">
                          {practitioner.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium">{practitioner.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{practitioner.specialism} • {rateSummary(practitioner)}</div>
                        </div>
                      </div>

                      {selectedSlot && slots && (
                        <div className="flex items-center gap-2 text-sm font-medium p-3 bg-primary/10 text-primary rounded-xl mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(slots.find(s => s.id === selectedSlot)!.startTime), 'EEEE, MMMM d, yyyy @ h:mm a')}
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label htmlFor="name">Employee Name</Label>
                        <Input 
                          id="name" 
                          value={bookingForm.employeeName} 
                          onChange={(e) => setBookingForm({...bookingForm, employeeName: e.target.value})} 
                          placeholder="Jane Doe" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Employee Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          value={bookingForm.employeeEmail} 
                          onChange={(e) => setBookingForm({...bookingForm, employeeEmail: e.target.value})} 
                          placeholder="jane@company.com" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="notes">Notes for Practitioner (Optional)</Label>
                        <Textarea 
                          id="notes" 
                          value={bookingForm.notes} 
                          onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})} 
                          placeholder="Any specific focus areas or injuries?" 
                        />
                      </div>
                    </div>
                    <Button 
                      className="w-full rounded-full h-12" 
                      onClick={handleBooking}
                      disabled={createBooking.isPending || !bookingForm.employeeName || !bookingForm.employeeEmail}
                    >
                      {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
                    </Button>
                  </DialogContent>
                </Dialog>
                
                <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <p>This session will be billed to your corporate account automatically upon completion.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
