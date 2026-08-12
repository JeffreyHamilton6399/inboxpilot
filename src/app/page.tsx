"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Landing } from "@/components/inbox-pilot/landing";
import { Dashboard } from "@/components/inbox-pilot/dashboard";
import { AuthModal } from "@/components/inbox-pilot/auth-modal";

export default function Page() {
  const { status } = useSession();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<"login" | "signup">("signup");

  const openAuth = (tab: "login" | "signup" = "signup") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

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
