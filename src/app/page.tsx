"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Landing } from "@/components/inbox-pilot/landing";
import { Dashboard } from "@/components/inbox-pilot/dashboard";
import { AuthModal } from "@/components/inbox-pilot/auth-modal";
import { useToast } from "@/hooks/use-toast";

function AppContent() {
  const { status } = useSession();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<"login" | "signup">("signup");
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const openAuth = (tab: "login" | "signup" = "signup") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  // Handle OAuth callback params (?gmail_connected=1 or ?gmail_error=...)
  React.useEffect(() => {
    const connected = searchParams.get("gmail_connected");
    const error = searchParams.get("gmail_error");
    if (connected) {
      // Invalidate cached queries so the inbox re-fetches with the new connection
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast({
        title: "Gmail connected",
        description: "Your inbox is loading now.",
      });
      router.replace("/");
    } else if (error) {
      toast({
        title: "Gmail connection failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      router.replace("/");
    }
  }, [searchParams, router, qc, toast]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === "authenticated") {
    return <Dashboard />;
  }

  return (
    <>
      <Landing onGetStarted={openAuth} />
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultTab={authTab}
      />
    </>
  );
}

export default function Page() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <AppContent />
    </React.Suspense>
  );
}
