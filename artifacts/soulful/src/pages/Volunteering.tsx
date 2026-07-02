import { useEffect, useMemo, useState } from "react";
import {
  useListEvents,
  getListEventsQueryKey,
  useRegisterForEvent,
  confirmEventRegistration,
  type Event as SoulfulEvent,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Users, HeartHandshake, Gift } from "lucide-react";

const VOLUNTEER_CATEGORIES = ["volunteering", "fundraising"];

function isVolunteeringEvent(e: SoulfulEvent): boolean {
  return VOLUNTEER_CATEGORIES.includes((e.category ?? "").toLowerCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Volunteering() {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<SoulfulEvent | null>(null);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");

  const filters = {};
  const { data: events, isLoading, refetch } = useListEvents(filters, {
    query: { queryKey: getListEventsQueryKey(filters) },
  });

  const registerMut = useRegisterForEvent();

  const volunteeringEvents = useMemo(
    () => (events ?? []).filter(isVolunteeringEvent).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events]
  );

  const eventDays = useMemo(() => volunteeringEvents.map((e) => new Date(e.startsAt)), [volunteeringEvents]);

  const visibleEvents = useMemo(() => {
    if (!selectedDay) return volunteeringEvents;
    return volunteeringEvents.filter((e) => sameDay(new Date(e.startsAt), selectedDay));
  }, [volunteeringEvents, selectedDay]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (checkout === "success" && sessionId) {
      confirmEventRegistration({ session_id: sessionId })
        .then((res) => {
          if (res.status === "registered") {
            toast({ title: "You're signed up!", description: "See you there." });
          } else {
            toast({ title: "Payment processing", description: "We'll confirm your spot shortly." });
          }
        })
        .catch(() => {
          toast({ title: "Couldn't confirm payment", description: "Please contact us if you were charged.", variant: "destructive" });
        })
        .finally(() => {
          window.history.replaceState({}, "", window.location.pathname);
        });
    }
  }, [toast]);

  const openRegister = (event: SoulfulEvent) => {
    setSelected(event);
    setRegName("");
    setRegEmail("");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regName.trim() || !emailRe.test(regEmail.trim())) {
      toast({ title: "Check your details", description: "Please enter your name and a valid email.", variant: "destructive" });
      return;
    }
    registerMut.mutate(
      { id: selected.id, data: { name: regName.trim(), email: regEmail.trim() } },
      {
        onSuccess: (res) => {
          if (res.status === "payment_required" && res.checkoutUrl) {
            window.location.href = res.checkoutUrl;
            return;
          }
          toast({ title: "You're signed up!", description: `See you at ${selected.title}.` });
          setSelected(null);
          refetch();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            "Could not complete sign up. Please try again.";
          toast({ title: "Sign up failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-12">
      <div className="max-w-3xl mb-12">
        <div className="flex items-center gap-2 mb-4">
          <HeartHandshake className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wide">Give back</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6 tracking-tight">
          Volunteering &amp; fundraising
        </h1>
        <p className="text-xl text-muted-foreground">
          Give your time or raise money for causes that matter. Anyone can sign up to a slot below — no company account needed.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/3 xl:w-1/4">
          <div className="bg-card border rounded-2xl p-4 shadow-sm sticky top-4">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(d) => setSelectedDay((prev) => (prev && d && sameDay(prev, d) ? undefined : d))}
              modifiers={{ hasEvent: eventDays }}
              modifiersClassNames={{ hasEvent: "bg-primary/15 text-primary font-semibold rounded-md" }}
              className="w-full"
            />
            {selectedDay ? (
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setSelectedDay(undefined)}>
                Show all dates
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground text-center mt-3 px-2">
                Highlighted dates have opportunities. Tap a date to filter.
              </p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-2/3 xl:w-3/4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl h-[320px]" />
              ))
            ) : visibleEvents.length ? (
              visibleEvents.map((event) => {
                const isFull = event.spotsLeft != null && event.spotsLeft <= 0;
                const isFundraising = (event.category ?? "").toLowerCase() === "fundraising";
                return (
                  <Card key={event.id} className="h-full border-none shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden flex flex-col">
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                          {isFundraising ? <Gift className="h-12 w-12" /> : <HeartHandshake className="h-12 w-12" />}
                        </div>
                      )}
                      <div className="absolute top-4 left-4 flex gap-2">
                        <Badge className="bg-background/90 backdrop-blur-sm text-foreground hover:bg-background/90 capitalize">
                          {event.category}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-6 flex flex-col flex-1">
                      <h3 className="font-serif text-xl font-medium mb-2">{event.title}</h3>
                      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0" /> {formatDate(event.startsAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0" /> {formatTime(event.startsAt)}
                          {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" /> {event.venue}, {event.city}
                        </div>
                        {event.capacity != null && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 shrink-0" />
                            {isFull ? "Fully booked" : `${event.spotsLeft} of ${event.capacity} spots left`}
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{event.description}</p>
                      <div className="mt-auto pt-2">
                        <Button className="w-full" disabled={isFull} onClick={() => openRegister(event)}>
                          {isFull ? "Fully booked" : "Sign up"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center bg-card rounded-2xl border">
                <h3 className="text-xl font-serif mb-2">
                  {selectedDay ? "No opportunities on this date" : "No opportunities yet"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {selectedDay ? "Try a different date on the calendar." : "Check back soon — new volunteering and fundraising slots are added regularly."}
                </p>
                {selectedDay && (
                  <Button variant="outline" onClick={() => setSelectedDay(undefined)}>Show all dates</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  {formatDate(selected.startsAt)} at {formatTime(selected.startsAt)} · {selected.venue}, {selected.city}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="vol-reg-name">Your name <span className="text-destructive">*</span></Label>
              <Input id="vol-reg-name" placeholder="Jane Doe" value={regName} onChange={(e) => setRegName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vol-reg-email">Email <span className="text-destructive">*</span></Label>
              <Input id="vol-reg-email" type="email" placeholder="jane@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              <Button type="submit" disabled={registerMut.isPending}>
                {registerMut.isPending ? "Processing…" : "Confirm sign up"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
