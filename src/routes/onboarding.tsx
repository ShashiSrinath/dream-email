import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/lib/store";
import { useEffect } from "react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingComponent,
});

function OnboardingComponent() {
  const navigate = useNavigate();
  const accounts = useEmailStore((state) => state.accounts);

  useEffect(() => {
    if (accounts.length > 0) {
      navigate({ to: "/" });
    }
  }, [accounts, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl w-full space-y-12">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-3xl">
              <Mail className="w-16 h-16 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            Welcome to Dream Email
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            The modern, lightning-fast desktop email client designed for power users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Unified Inbox</h3>
            <p className="text-sm text-muted-foreground">
              All your accounts in one beautiful view.
            </p>
          </div>
          <div className="space-y-3">
            <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Privacy First</h3>
            <p className="text-sm text-muted-foreground">
              Local data storage and secure OAuth authentication.
            </p>
          </div>
          <div className="space-y-3">
            <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Offline Sync</h3>
            <p className="text-sm text-muted-foreground">
              Search and read emails even without internet.
            </p>
          </div>
        </div>

        <div className="pt-8">
          <Button
            size="lg"
            className="rounded-full px-8 text-lg font-semibold h-14"
            onClick={() => navigate({ to: "/accounts/new" })}
          >
            Get Started
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Connect your first account to begin.
          </p>
        </div>
      </div>
    </div>
  );
}
