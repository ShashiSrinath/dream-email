import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useEmailStore } from "@/lib/store";
import { useEffect } from "react";
import { Mail } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import "../styles.css";

const RootLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const accounts = useEmailStore((state) => state.accounts);
  const isInitialized = useEmailStore((state) => state.isInitialized);
  const init = useEmailStore((state) => state.init);

  const isAuthRoute =
    pathname === "/onboarding" || pathname === "/accounts/new";

  useEffect(() => {
    return init();
  }, [init]);

  useEffect(() => {
    if (!isInitialized) return;

    // If no accounts and not on an auth route, redirect to onboarding
    if (accounts.length === 0 && !isAuthRoute) {
      navigate({ to: "/onboarding" });
    }
  }, [accounts.length, isAuthRoute, navigate, isInitialized]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary text-primary-foreground p-4 rounded-3xl animate-pulse">
            <Mail className="w-12 h-12" />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Dream Email</h1>
            <div className="flex gap-1 justify-center">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
        <Toaster />
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
      <Toaster />
      <TanStackRouterDevtools />
    </SidebarProvider>
  );
};

export const Route = createRootRoute({ component: RootLayout });
