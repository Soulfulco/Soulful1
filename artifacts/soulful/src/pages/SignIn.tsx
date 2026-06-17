import { Link } from "wouter";
import { Building2, Users } from "lucide-react";

export default function SignIn() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="h-16 border-b bg-background flex items-center px-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <img src="/images/logo.png" alt="Soulful" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-serif text-2xl font-bold tracking-tight text-foreground">Soulful</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-10">
          <div className="text-center space-y-3">
            <h1 className="font-serif text-4xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-base">Choose how you'd like to sign in</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link href="/dashboard/login">
              <div className="group cursor-pointer rounded-2xl border bg-card p-8 hover:border-primary/50 hover:shadow-md transition-all space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-xl font-semibold text-foreground">Corporate / HR</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sign in to your company's HR portal to manage employee wellbeing, bookings, and your team.
                  </p>
                </div>
                <span className="inline-block text-sm font-medium text-primary group-hover:underline underline-offset-4">
                  Sign in to HR Portal →
                </span>
              </div>
            </Link>

            <Link href="/join">
              <div className="group cursor-pointer rounded-2xl border bg-card p-8 hover:border-primary/50 hover:shadow-md transition-all space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-xl font-semibold text-foreground">Employee</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Access your wellbeing sessions. Use the invite code your HR team shared to get started.
                  </p>
                </div>
                <span className="inline-block text-sm font-medium text-primary group-hover:underline underline-offset-4">
                  Access employee portal →
                </span>
              </div>
            </Link>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Are you a wellbeing practitioner?{" "}
            <Link href="/practitioner/login" className="text-primary underline underline-offset-4 hover:no-underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background">
        © {new Date().getFullYear()} Soulful. All rights reserved.
      </footer>
    </div>
  );
}
