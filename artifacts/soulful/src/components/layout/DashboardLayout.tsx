import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, Building2, CreditCard, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Practitioners", href: "/dashboard/practitioners", icon: Users },
  { name: "Companies", href: "/dashboard/companies", icon: Building2 },
  { name: "Employee Wellbeing", href: "/dashboard/employees", icon: HeartHandshake },
  { name: "Subscriptions", href: "/dashboard/subscriptions", icon: CreditCard },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex bg-muted/40">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex-col hidden md:flex sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
            <span className="font-serif text-xl font-bold tracking-tight text-foreground">Soulful</span>
          </Link>
        </div>
        <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Admin</span>
              <span className="text-xs text-muted-foreground">admin@soulfulco.uk</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center px-6 md:hidden sticky top-0 z-10">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
            <span className="font-serif text-xl font-bold text-foreground">Soulful</span>
          </Link>
        </header>
        <div className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
