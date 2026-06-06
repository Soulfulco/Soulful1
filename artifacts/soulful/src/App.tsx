import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import NotFound from "@/pages/not-found";
import MainLayout from "@/components/layout/MainLayout";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Lazy load pages for better performance
const Home = lazy(() => import("@/pages/Home"));
const Practitioners = lazy(() => import("@/pages/Practitioners"));
const PractitionerProfile = lazy(() => import("@/pages/PractitionerProfile"));
const ForCorporates = lazy(() => import("@/pages/ForCorporates"));
const ForPractitioners = lazy(() => import("@/pages/ForPractitioners"));
const Locations = lazy(() => import("@/pages/Locations"));

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardBookings = lazy(() => import("@/pages/DashboardBookings"));
const DashboardPractitioners = lazy(() => import("@/pages/DashboardPractitioners"));
const DashboardCompanies = lazy(() => import("@/pages/DashboardCompanies"));
const DashboardSubscriptions = lazy(() => import("@/pages/DashboardSubscriptions"));

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
        {/* Main App Routes */}
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

        {/* Dashboard Routes */}
        <Route path="/dashboard">
          <DashboardLayout><Dashboard /></DashboardLayout>
        </Route>
        <Route path="/dashboard/bookings">
          <DashboardLayout><DashboardBookings /></DashboardLayout>
        </Route>
        <Route path="/dashboard/practitioners">
          <DashboardLayout><DashboardPractitioners /></DashboardLayout>
        </Route>
        <Route path="/dashboard/companies">
          <DashboardLayout><DashboardCompanies /></DashboardLayout>
        </Route>
        <Route path="/dashboard/subscriptions">
          <DashboardLayout><DashboardSubscriptions /></DashboardLayout>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
