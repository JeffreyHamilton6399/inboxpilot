"use client";

import { useQuery } from "@tanstack/react-query";
import type { Email } from "@/lib/types";

export class NotConnectedError extends Error {
  constructor() {
    super("Gmail not connected");
    this.name = "NotConnectedError";
  }
}

async function fetchEmails(): Promise<Email[]> {
  const res = await fetch("/api/gmail/messages");
  if (res.status === 404) throw new NotConnectedError();
  if (!res.ok) throw new Error("Failed to load inbox");
  const data = await res.json();
  return (data.emails ?? []) as Email[];
}

export function useEmails() {
  return useQuery({
    queryKey: ["emails"],
    queryFn: fetchEmails,
    staleTime: 20_000,
    retry: (failureCount, error) => {
      // Don't retry "not connected" — it needs user action.
      if (error instanceof NotConnectedError) return false;
      return failureCount < 1;
    },
  });
}

export async function fetchEmailBody(id: string): Promise<string> {
  const res = await fetch(`/api/gmail/message/${id}`);
  if (!res.ok) throw new Error("Failed to load message");
  const data = await res.json();
  return data.body ?? "";
}
