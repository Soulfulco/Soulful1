import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

function MailingListSignup() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mailing-list/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "footer" }),
      });
      if (!res.ok) throw new Error();
      setSubscribed(true);
      setEmail("");
      toast({ title: "You're on the list!", description: "Thanks for subscribing." });
    } catch {
      toast({ title: "Couldn't subscribe", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (subscribed) {
    return <p className="text-sm text-primary">Thanks — you're subscribed!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Get wellbeing tips and event updates in your inbox.</p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10"
        />
        <Button type="submit" size="sm" className="h-10 shrink-0" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
        </Button>
      </div>
    </form>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    const checkEmployee = () => setIsEmployee(!!localStorage.getItem("soulful_employee"));
    checkEmployee();
    window.addEventListener("storage", checkEmployee);
    window.addEventListener("focus", checkEmployee);
    return () => {
      window.removeEventListener("storage", checkEmployee);
      window.removeEventListener("focus", checkEmployee);
    };
  }, []);

  const NavLinks = () => (
    <>
      <Link href="/practitioners" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/practitioners" ? "text-primary" : "text-muted-foreground"}`}>
        Practitioners
      </Link>
      <Link href="/events" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/events" ? "text-primary" : "text-muted-foreground"}`}>
        Events
      </Link>
      <Link href="/volunteering" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/volunteering" ? "text-primary" : "text-muted-foreground"}`}>
        Volunteering
      </Link>
      <Link href="/for-corporates" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/for-corporates" ? "text-primary" : "text-muted-foreground"}`}>
        For Corporates
      </Link>
      <Link href="/for-practitioners" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/for-practitioners" ? "text-primary" : "text-muted-foreground"}`}>
        For Practitioners
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/images/logo.png" alt="Soulful" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-serif text-2xl font-bold tracking-tight text-foreground">Soulful</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <NavLinks />
            <div className="flex items-center gap-4 ml-4 border-l pl-8">
              {isEmployee ? (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6" asChild>
                  <Link href="/employee">
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    My Wellbeing
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6" asChild>
                    <Link href="/for-corporates">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-6 pt-12">
              <NavLinks />
              <div className="flex flex-col gap-4 mt-8 border-t pt-8">
                {isEmployee ? (
                  <Button className="w-full justify-center rounded-full" asChild>
                    <Link href="/employee">
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      My Wellbeing
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="w-full justify-center" asChild>
                      <Link href="/login">Sign In</Link>
                    </Button>
                    <Button className="w-full justify-center rounded-full" asChild>
                      <Link href="/for-corporates">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto py-12 px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="flex flex-col gap-4 md:col-span-1">
              <Link href="/" className="flex items-center gap-2 hover:opacity-90">
                <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
                <span className="font-serif text-xl font-bold text-foreground">Soulful</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A sanctuary for corporate wellbeing. Connecting teams with vetted practitioners across the UK.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <h4 className="font-semibold font-serif text-foreground">Platform</h4>
              <Link href="/for-corporates" className="text-sm text-muted-foreground hover:text-primary transition-colors">For Corporates</Link>
              <Link href="/for-practitioners" className="text-sm text-muted-foreground hover:text-primary transition-colors">For Practitioners</Link>
              <Link href="/volunteering" className="text-sm text-muted-foreground hover:text-primary transition-colors">Volunteering &amp; Fundraising</Link>
              <Link href="/propose-session" className="text-sm text-muted-foreground hover:text-primary transition-colors">Propose a Session</Link>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-semibold font-serif text-foreground">Company</h4>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Careers</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact</a>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-semibold font-serif text-foreground">Legal</h4>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</a>
            </div>

            <div className="flex flex-col gap-3 md:col-span-1">
              <h4 className="font-semibold font-serif text-foreground">Stay in the loop</h4>
              <MailingListSignup />
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Soulful Wellbeing Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
