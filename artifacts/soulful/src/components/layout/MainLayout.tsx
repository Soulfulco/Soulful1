import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const NavLinks = () => (
    <>
      <Link href="/for-corporates" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/for-corporates" ? "text-primary" : "text-muted-foreground"}`}>
        For Corporates
      </Link>
      <Link href="/for-practitioners" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/for-practitioners" ? "text-primary" : "text-muted-foreground"}`}>
        For Practitioners
      </Link>
      <Link href="/events" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/events" ? "text-primary" : "text-muted-foreground"}`}>
        Events
      </Link>
      <Link href="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
        Admin
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
              <Button variant="ghost" asChild>
                <Link href="/for-corporates">Sign In</Link>
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6" asChild>
                <Link href="/for-corporates">Get Started</Link>
              </Button>
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
                <Button variant="outline" className="w-full justify-center" asChild>
                  <Link href="/for-corporates">Sign In</Link>
                </Button>
                <Button className="w-full justify-center rounded-full" asChild>
                  <Link href="/for-corporates">Get Started</Link>
                </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Soulful Wellbeing Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
