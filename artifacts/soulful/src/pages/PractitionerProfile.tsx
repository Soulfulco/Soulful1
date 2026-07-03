import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { MapPin, Star, Clock, GraduationCap, ArrowLeft, CheckCircle2, CreditCard, Loader2, EyeOff } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function PractitionerProfile({ id }: { id: string }) {
  const practitionerId = parseInt(id, 10);
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isSelfFunded = params.get("paymentType") === "self";
  const checkoutParam = params.get("checkout");
  const sessionId = params.get("session_id");

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
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [shareWithEmployer, setShareWithEmployer] = useState(true);
  const [bookingForm, setBookingForm] = useState({
    employeeName: "",
    employeeEmail: "",
    companyId: 1,
    notes: ""
  });

  // Handle Stripe redirect-back toasts
  useEffect(() => {
    if (checkoutParam === "success" && sessionId) {
      // Confirm the booking server-side then show success
      fetch(`/api/bookings/confirm?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(() => {
          toast({
            title: "Payment confirmed!",
            description: "Your self-funded session is booked. You'll receive a confirmation email shortly.",
          });
        })
        .catch(() => {
          toast({
            title: "Session booked",
            description: "Your payment was received. Check your email for confirmation.",
          });
        });
    } else if (checkoutParam === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "Your session slot has been released. Feel free to pick another time.",
        variant: "destructive",
      });
    }
    // Only run on mount (from redirect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        notes: bookingForm.notes,
        paymentType: isSelfFunded ? "self" : "corporate",
        shareWithEmployer: isSelfFunded ? shareWithEmployer : true,
      }
    }, {
      onSuccess: (data: unknown) => {
        const result = data as { status?: string; checkoutUrl?: string | null };
        // Self-funded: redirect to Stripe Checkout
        if (result?.status === "payment_required" && result?.checkoutUrl) {
          setIsRedirecting(true);
          window.location.href = result.checkoutUrl;
          return;
        }
        // Corporate: confirm immediately
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
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="inline-block px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-medium uppercase tracking-wider">
                      {practitioner.specialism}
                    </div>
                    {isSelfFunded && (
                      <Badge variant="outline" className="gap-1 text-xs border-primary/40 text-primary">
                        <CreditCard className="h-3 w-3" /> Personal booking
                      </Badge>
                    )}
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
              <div className={`p-6 text-center ${isSelfFunded ? "bg-gradient-to-br from-primary to-primary/80" : "bg-primary"} text-primary-foreground`}>
                {isSelfFunded && (
                  <div className="text-xs font-medium bg-primary-foreground/20 rounded-full px-3 py-1 mb-3 inline-block">
                    You pay directly — not billed to your company
                  </div>
                )}
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
                    if (date < new Date(new Date().setHours(0,0,0,0))) return true;
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
                      {isSelfFunded ? (
                        <><CreditCard className="h-4 w-4 mr-2" /> Continue to Payment</>
                      ) : (
                        "Continue to Booking"
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-serif">
                        {isSelfFunded ? "Book & Pay" : "Confirm Booking"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {isSelfFunded && (
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
                          <CreditCard className="h-4 w-4 shrink-0" />
                          <span>You'll be taken to a secure Stripe checkout to pay the session fee directly.</span>
                        </div>
                      )}

                      {isSelfFunded && (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40">
                          <div className="flex items-start gap-2">
                            <EyeOff className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium leading-tight">Share details with my employer</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {shareWithEmployer
                                  ? "Your name and session will appear on company reports."
                                  : "Only the practitioner name will be visible to your employer."}
                              </p>
                            </div>
                          </div>
                          <Switch checked={shareWithEmployer} onCheckedChange={setShareWithEmployer} />
                        </div>
                      )}

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
                        <Label htmlFor="name">Your Name</Label>
                        <Input 
                          id="name" 
                          value={bookingForm.employeeName} 
                          onChange={(e) => setBookingForm({...bookingForm, employeeName: e.target.value})} 
                          placeholder="Jane Doe" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Your Email</Label>
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
                      disabled={createBooking.isPending || isRedirecting || !bookingForm.employeeName || !bookingForm.employeeEmail}
                    >
                      {(createBooking.isPending || isRedirecting) ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isRedirecting ? "Redirecting to payment..." : "Processing..."}</>
                      ) : isSelfFunded ? (
                        <><CreditCard className="h-4 w-4 mr-2" /> Pay & Confirm Booking</>
                      ) : (
                        "Confirm Booking"
                      )}
                    </Button>
                  </DialogContent>
                </Dialog>
                
                <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                  {isSelfFunded ? (
                    <>
                      <CreditCard className="h-4 w-4 text-primary shrink-0" />
                      <p>Payment processed securely via Stripe. This session is personal and won't appear on your company account.</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <p>This session will be billed to your corporate account automatically upon completion.</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
