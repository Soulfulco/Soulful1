import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout/MainLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";

// Lazy load pages for better performance
const Home = lazy(() => import("@/pages/Home"));
const Practitioners = lazy(() => import("@/pages/Practitioners"));
const PractitionerProfile = lazy(() => import("@/pages/PractitionerProfile"));
const ForCorporates = lazy(() => import("@/pages/ForCorporates"));
const ForPractitioners = lazy(() => import("@/pages/ForPractitioners"));
const Locations = lazy(() => import("@/pages/Locations"));
const Join = lazy(() => import("@/pages/Join"));
const EmployeePortal = lazy(() => import("@/pages/EmployeePortal"));
const DashboardLogin = lazy(() => import("@/pages/DashboardLogin"));

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardBookings = lazy(() => import("@/pages/DashboardBookings"));
const DashboardPractitioners = lazy(() => import("@/pages/DashboardPractitioners"));
const DashboardCompanies = lazy(() => import("@/pages/DashboardCompanies"));
const DashboardSubscriptions = lazy(() => import("@/pages/DashboardSubscriptions"));
const DashboardEmployees = lazy(() => import("@/pages/DashboardEmployees"));
const DashboardGroupSessions = lazy(() => import("@/pages/DashboardGroupSessions"));
const DashboardSocialCalendar = lazy(() => import("@/pages/DashboardSocialCalendar"));
const DashboardHrUsers = lazy(() => import("@/pages/DashboardHrUsers"));
const DashboardWellbeing = lazy(() => import("@/pages/DashboardWellbeing"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingFallback() {
  return (
    <div className="p-8 w-full max-w-4xl mx-auto flex flex-col gap-8">
      <Skeleton className="h-12 w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Public Routes */}
        <Route path="/">
          <MainLayout><Home /></MainLayout>
        </Route>
        <Route path="/practitioners">
          <MainLayout><Practitioners /></MainLayout>
        </Route>
        <Route path="/practitioners/:id">
          {(params) => <MainLayout><PractitionerProfile id={params.id!} /></MainLayout>}
        </Route>
        <Route path="/for-corporates">
          <MainLayout><ForCorporates /></MainLayout>
        </Route>
        <Route path="/for-practitioners">
          <MainLayout><ForPractitioners /></MainLayout>
        </Route>
        <Route path="/locations">
          <MainLayout><Locations /></MainLayout>
        </Route>
        <Route path="/join">
          <Join />
        </Route>
        <Route path="/employee">
          <EmployeePortal />
        </Route>

        {/* Login */}
        <Route path="/dashboard/login">
          <DashboardLogin />
        </Route>

        {/* Protected Dashboard Routes */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <DashboardLayout><Dashboard /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/bookings">
          <ProtectedRoute>
            <DashboardLayout><DashboardBookings /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/practitioners">
          <ProtectedRoute requireAdmin>
            <DashboardLayout><DashboardPractitioners /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/companies">
          <ProtectedRoute requireAdmin>
            <DashboardLayout><DashboardCompanies /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/employees">
          <ProtectedRoute>
            <DashboardLayout><DashboardEmployees /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/group-sessions">
          <ProtectedRoute>
            <DashboardLayout><DashboardGroupSessions /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/social-calendar">
          <ProtectedRoute>
            <DashboardLayout><DashboardSocialCalendar /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/subscriptions">
          <ProtectedRoute requireAdmin>
            <DashboardLayout><DashboardSubscriptions /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/hr-users">
          <ProtectedRoute requireAdmin>
            <DashboardLayout><DashboardHrUsers /></DashboardLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/wellbeing">
          <ProtectedRoute>
            <DashboardLayout><DashboardWellbeing /></DashboardLayout>
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
