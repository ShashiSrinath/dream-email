import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useEmailStore } from "@/lib/store";
import { useEffect } from "react";
import "../styles.css";

const RootLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const accounts = useEmailStore((state) => state.accounts);
  const init = useEmailStore((state) => state.init);
  
  const isAuthRoute = pathname === "/onboarding" || pathname === "/accounts/new";

  useEffect(() => {
    return init();
  }, [init]);

  useEffect(() => {
    // If no accounts and not on an auth route, redirect to onboarding
    if (accounts.length === 0 && !isAuthRoute) {
      navigate({ to: "/onboarding" });
    }
  }, [accounts.length, isAuthRoute, navigate]);

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
        <TanStackRouterDevtools />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
      <TanStackRouterDevtools />
    </SidebarProvider>
  );
};

export const Route = createRootRoute({ component: RootLayout });