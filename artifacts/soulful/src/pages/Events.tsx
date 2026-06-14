import { useEffect, useMemo, useState } from "react";
import {
  useListEvents,
  getListEventsQueryKey,
  useListEventLocations,
  getListEventLocationsQueryKey,
  useRegisterForEvent,
  confirmEventRegistration,
  type Event as SoulfulEvent,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, CalendarDays, Clock, Users, Loader2, Navigation } from "lucide-react";

const ALL = "__all__";

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

export default function Events() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<string>(ALL);
  const [detecting, setDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  const [selected, setSelected] = useState<SoulfulEvent | null>(null);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");

  const { data: locations } = useListEventLocations({
    query: { queryKey: getListEventLocationsQueryKey() },
  });

  const filters = {
    location: location !== ALL ? location : undefined,
    search: search || undefined,
  };
  const { data: events, isLoading, refetch } = useListEvents(filters, {
    query: { queryKey: getListEventsQueryKey(filters) },
  });

  const registerMut = useRegisterForEvent();

  // Handle return from Stripe checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");
    if (checkout === "success" && sessionId) {
      confirmEventRegistration({ session_id: sessionId })
        .then((res) => {
          if (res.status === "registered") {
            toast({ title: "You're booked in!", description: "Payment received — see you there." });
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
    } else if (checkout === "cancelled") {
      toast({ title: "Checkout cancelled", description: "Your spot wasn't booked.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your browser doesn't support geolocation.", variant: "destructive" });
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const resp = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await resp.json();
          const detectedCity: string = data.city || data.locality || data.principalSubdivision || "";
          const match = (locations ?? []).find(
            (c) => c.toLowerCase() === detectedCity.toLowerCase()
          );
          if (match) {
            setLocation(match);
            setAutoDetected(true);
            toast({ title: "Showing events near you", description: `Filtered to ${match}.` });
          } else {
            toast({
              title: detectedCity ? `No events in ${detectedCity} yet` : "No nearby events",
              description: "Showing all upcoming events instead.",
            });
          }
        } catch {
          toast({ title: "Couldn't detect location", description: "Please pick a location manually.", variant: "destructive" });
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setDetecting(false);
        toast({ title: "Location permission denied", description: "Please pick a location manually.", variant: "destructive" });
      },
      { timeout: 10000 }
    );
  };

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
          toast({ title: "You're registered!", description: `See you at ${selected.title}.` });
          setSelected(null);
          refetch();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            "Could not complete registration. Please try again.";
          toast({ title: "Registration failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const locationOptions = useMemo(() => locations ?? [], [locations]);

  return (
    <div className="container mx-auto px-4 md:px-8 py-12">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6 tracking-tight">Upcoming events</h1>
        <p className="text-xl text-muted-foreground">
          Real-world gatherings to connect, unwind and recharge — open to everyone. Find one near you and reserve your spot.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="pl-9 h-12 bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-foreground font-serif text-lg">
              <MapPin className="h-5 w-5" /> Location
            </div>
            <Select value={location} onValueChange={(v) => { setLocation(v); setAutoDetected(false); }}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {locationOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={detectLocation}
              disabled={detecting}
            >
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {detecting ? "Detecting…" : "Use my location"}
            </Button>
            {autoDetected && (
              <p className="text-xs text-muted-foreground text-center">Showing events near you. Change the dropdown to browse elsewhere.</p>
            )}
          </div>
        </div>

        <div className="w-full lg:w-2/3 xl:w-3/4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl h-[360px]" />
              ))
            ) : events?.length ? (
              events.map((event) => {
                const isFull = event.spotsLeft != null && event.spotsLeft <= 0;
                const isPaid = event.priceGbp > 0;
                return (
                  <Card key={event.id} className="h-full border-none shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden flex flex-col">
                    <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                          <CalendarDays className="h-12 w-12" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {event.category && (
                          <Badge className="bg-background/90 backdrop-blur-sm text-foreground hover:bg-background/90 capitalize">{event.category}</Badge>
                        )}
                        <Badge className={isPaid ? "bg-secondary text-secondary-foreground hover:bg-secondary" : "bg-primary text-primary-foreground hover:bg-primary"}>
                          {isPaid ? `£${event.priceGbp}` : "Free"}
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
                        <Button
                          className="w-full"
                          disabled={isFull}
                          onClick={() => openRegister(event)}
                        >
                          {isFull ? "Fully booked" : isPaid ? `Register · £${event.priceGbp}` : "Register free"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center bg-card rounded-2xl border">
                <h3 className="text-xl font-serif mb-2">No events found</h3>
                <p className="text-muted-foreground mb-6">Try a different location or clear your search.</p>
                <Button variant="outline" onClick={() => { setSearch(""); setLocation(ALL); setAutoDetected(false); }}>Clear filters</Button>
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
                  {selected.priceGbp > 0 ? ` · £${selected.priceGbp} per person` : " · Free"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Your name <span className="text-destructive">*</span></Label>
              <Input id="reg-name" placeholder="Jane Doe" value={regName} onChange={(e) => setRegName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email <span className="text-destructive">*</span></Label>
              <Input id="reg-email" type="email" placeholder="jane@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            </div>
            {selected && selected.priceGbp > 0 && (
              <p className="text-xs text-muted-foreground">
                You'll be taken to a secure checkout to pay £{selected.priceGbp}. Your spot is confirmed once payment completes.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              <Button type="submit" disabled={registerMut.isPending}>
                {registerMut.isPending
                  ? "Processing…"
                  : selected && selected.priceGbp > 0
                    ? "Continue to payment"
                    : "Confirm registration"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
