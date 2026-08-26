"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import type { Attachment, Email, MessageChange } from "@/lib/types";
import type { ThreadMessage } from "@/lib/types";

/**
 * Why the inbox is empty, when it is not simply empty.
 *
 * These used to be one thing. Any 401 or 403 from Gmail became "not
 * connected", so an account that was connected — but whose project had the
 * Gmail API switched off, or whose grant had lapsed — was told to connect the
 * account it had already connected.
 */
export type InboxProblem = "not-connected" | "needs-reconnect" | "gmail-error";

export class InboxError extends Error {
  constructor(
    readonly problem: InboxProblem,
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = "InboxError";
  }
}

/** Kept for callers that only care whether anything is connected at all. */
export class NotConnectedError extends InboxError {
  constructor() {
    super("not-connected", "Gmail not connected");
  }
}

async function fetchEmails(): Promise<Email[]> {
  const res = await fetch("/api/gmail/messages");

  if (res.ok) {
    const data = await res.json();
    return (data.emails ?? []) as Email[];
  }

  const body = await res.json().catch(() => ({}) as Record<string, string>);
  if (res.status === 404) throw new NotConnectedError();
  if (res.status === 409) {
    throw new InboxError("needs-reconnect", body.error ?? "Reconnect Gmail to continue.", body.detail);
  }
  if (res.status === 502) {
    throw new InboxError("gmail-error", body.error ?? "Gmail refused the request.", body.detail);
  }
  throw new Error(body.error ?? "Failed to load inbox");
}

export function useEmails() {
  return useQuery({
    queryKey: ["emails"],
    queryFn: fetchEmails,
    staleTime: 20_000,
    retry: (failureCount, error) => {
      // None of these get better by asking again; they all need a person.
      if (error instanceof InboxError) return false;
      return failureCount < 1;
    },
  });
}

/**
 * Star, read/unread and archive — applied here and at Gmail, or neither.
 *
 * The screen changes first, because waiting on a round trip to show a star
 * feels broken. But the change is only kept if Gmail accepts it: a refusal
 * puts the old value back and says so, rather than leaving the app showing
 * something no other mail client will agree with.
 */
export function useMessageActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const setRead = useStore((s) => s.setRead);
  const setStarred = useStore((s) => s.setStarred);
  const setArchived = useStore((s) => s.setArchived);

  const push = async (ids: string[], change: MessageChange): Promise<boolean> => {
    const res = await fetch("/api/gmail/modify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, ...change }),
    });
    if (res.ok) return true;

    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    toast({
      title: "Gmail didn't accept that",
      description:
        body.code === "GMAIL_NEEDS_RECONNECT"
          ? "Connect Gmail again in Settings — this app now needs permission to change your mail, not just read it."
          : (body.error ?? "The change has been undone."),
      variant: "destructive",
    });
    return false;
  };

  return {
    async star(id: string, starred: boolean) {
      setStarred(id, starred);
      if (!(await push([id], { starred }))) setStarred(id, !starred);
    },

    async read(id: string, read: boolean) {
      setRead(id, read);
      if (!(await push([id], { unread: !read }))) setRead(id, !read);
    },

    async archive(ids: string[]) {
      if (ids.length === 0) return;
      setArchived(ids, true);
      if (await push(ids, { archived: true })) {
        // Gmail's `in:inbox` will now leave these out on its own.
        qc.invalidateQueries({ queryKey: ["emails"] });
      } else {
        setArchived(ids, false);
      }
    },
  };
}

export async function fetchEmailDetail(
  id: string
): Promise<{ body: string; attachments: Attachment[] }> {
  const res = await fetch(`/api/gmail/message/${id}`);
  if (!res.ok) throw new Error("Failed to load message");
  const data = await res.json();
  return { body: data.body ?? "", attachments: data.attachments ?? [] };
}
/**
 * The conversation, not just the message that was clicked.
 *
 * Also how a reply sent from here becomes visible: sent mail is not in the
 * inbox listing, so before this the reply you had just written disappeared the
 * moment you sent it.
 */
export function useThread(threadId: string | undefined) {
  return useQuery<{ messages: ThreadMessage[]; self: string }>({
    queryKey: ["thread", threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      const res = await fetch(`/api/gmail/thread/${threadId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as Record<string, string>);
        throw new Error(body.error ?? "Failed to load the conversation");
      }
      return res.json();
    },
    staleTime: 15_000,
  });
}
