"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Landing } from "@/components/inbox-pilot/landing";
import { Wordmark } from "@/components/inbox-pilot/logo";
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
        description: "Your mail is loading now.",
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

  if (status === "loading") return <Booting />;

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

/**
 * The first paint, before we know whether there is a session.
 *
 * A spinner here says "something is happening" and nothing else, on a screen
 * that is blank for a few hundred milliseconds at most. The wordmark says
 * which app you have opened, which is the only question anyone has yet.
 */
function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-fade-in-fast opacity-60">
        <Wordmark />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense fallback={<Booting />}>
      <AppContent />
    </React.Suspense>
  );
}
