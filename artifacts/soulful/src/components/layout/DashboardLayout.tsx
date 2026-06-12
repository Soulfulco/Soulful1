import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, Building2, CreditCard, HeartHandshake, UsersRound, CalendarDays, LogOut, UserCog, Heart, Inbox, BookOpen, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const adminNavigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Group Sessions", href: "/dashboard/group-sessions", icon: UsersRound },
  { name: "Social Calendar", href: "/dashboard/social-calendar", icon: CalendarDays },
  { name: "Practitioners", href: "/dashboard/practitioners", icon: Users },
  { name: "Companies", href: "/dashboard/companies", icon: Building2 },
  { name: "Employee Wellbeing", href: "/dashboard/employees", icon: HeartHandshake },
  { name: "Subscriptions", href: "/dashboard/subscriptions", icon: CreditCard },
  { name: "Wellbeing Programmes", href: "/dashboard/programmes", icon: BookOpen },
  { name: "Team Wellbeing", href: "/dashboard/wellbeing", icon: Heart },
  { name: "Session Proposals", href: "/dashboard/proposals", icon: Inbox },
  { name: "Site Content", href: "/dashboard/content", icon: PencilLine },
  { name: "HR Portal Users", href: "/dashboard/hr-users", icon: UserCog },
];

const hrNavigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Group Sessions", href: "/dashboard/group-sessions", icon: UsersRound },
  { name: "Social Calendar", href: "/dashboard/social-calendar", icon: CalendarDays },
  { name: "Wellbeing Programmes", href: "/dashboard/programmes", icon: BookOpen },
  { name: "Employees", href: "/dashboard/employees", icon: HeartHandshake },
  { name: "Team Wellbeing", href: "/dashboard/wellbeing", icon: Heart },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, hrSession, isAdminUser, logout } = useAuth();

  const navigation = isAdminUser ? adminNavigation : hrNavigation;

  const displayName = hrSession?.user
    ? [hrSession.user.firstName, hrSession.user.lastName].filter(Boolean).join(" ") || hrSession.user.email || "HR Manager"
    : [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Admin";

  const displayEmail = hrSession
    ? `${hrSession.companyName}`
    : (user?.email ?? "admin@soulfulco.uk");

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "AD";

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

        {hrSession && (
          <div className="px-4 py-3 border-b bg-secondary/30">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Company</p>
            <p className="text-sm font-semibold text-foreground truncate">{hrSession.companyName}</p>
          </div>
        )}

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
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
                {initials}
              </div>
            )}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">{displayEmail}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-6 md:hidden sticky top-0 z-10">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <img src="/images/logo.png" alt="Soulful" className="h-7 w-7 rounded-md object-cover" />
            <span className="font-serif text-xl font-bold text-foreground">Soulful</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
