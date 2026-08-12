"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { Landing } from "@/components/inbox-pilot/landing";
import { Dashboard } from "@/components/inbox-pilot/dashboard";

export default function Page() {
  const launched = useStore((s) => s.launched);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: persisted state hydrates on the client.
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return launched ? <Dashboard /> : <Landing />;
}
