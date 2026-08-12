"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSampleEmails, DEFAULT_TONE } from "./sample-data";
import type { CategoryId, ChatMessage, Email, ToneProfile } from "./types";

export type View = "inbox" | "chat" | "meetings" | "settings";

interface IPState {
  // app lifecycle
  launched: boolean;
  activeView: View;
  selectedEmailId: string | null;

  // user profile
  tone: ToneProfile;

  // per-email overrides (persisted; sample timestamps stay fresh)
  drafts: Record<string, string>;
  categoryOverrides: Record<string, CategoryId>;
  readOverrides: Record<string, boolean>;
  starredOverrides: Record<string, boolean>;

  // chat
  chat: ChatMessage[];
  chatBusy: boolean;

  // actions
  launch: () => void;
  reset: () => void;
  setView: (v: View) => void;
  selectEmail: (id: string | null) => void;

  setTone: (patch: Partial<ToneProfile>) => void;
  resetTone: () => void;

  setDraft: (emailId: string, text: string) => void;
  setCategory: (emailId: string, cat: CategoryId) => void;
  toggleRead: (emailId: string) => void;
  toggleStar: (emailId: string) => void;
  markRead: (emailId: string) => void;

  addChat: (msg: ChatMessage) => void;
  updateChat: (id: string, content: string) => void;
  appendChat: (id: string, chunk: string) => void;
  setChatBusy: (b: boolean) => void;
  clearChat: () => void;
}

export const useStore = create<IPState>()(
  persist(
    (set) => ({
      launched: false,
      activeView: "inbox",
      selectedEmailId: null,
      tone: DEFAULT_TONE,
      drafts: {},
      categoryOverrides: {},
      readOverrides: {},
      starredOverrides: {},
      chat: [],
      chatBusy: false,

      launch: () => set({ launched: true }),
      reset: () =>
        set({
          launched: false,
          activeView: "inbox",
          selectedEmailId: null,
          tone: DEFAULT_TONE,
          drafts: {},
          categoryOverrides: {},
          readOverrides: {},
          starredOverrides: {},
          chat: [],
          chatBusy: false,
        }),
      setView: (v) => set({ activeView: v }),
      selectEmail: (id) => set({ selectedEmailId: id }),

      setTone: (patch) => set((s) => ({ tone: { ...s.tone, ...patch } })),
      resetTone: () => set({ tone: DEFAULT_TONE }),

      setDraft: (emailId, text) =>
        set((s) => ({ drafts: { ...s.drafts, [emailId]: text } })),
      setCategory: (emailId, cat) =>
        set((s) => ({
          categoryOverrides: { ...s.categoryOverrides, [emailId]: cat },
        })),
      toggleRead: (emailId) =>
        set((s) => {
          const base = baseEmail(emailId);
          const current =
            s.readOverrides[emailId] ?? base?.unread === false;
          return {
            readOverrides: { ...s.readOverrides, [emailId]: !current },
          };
        }),
      toggleStar: (emailId) =>
        set((s) => {
          const base = baseEmail(emailId);
          const current = s.starredOverrides[emailId] ?? base?.starred ?? false;
          return {
            starredOverrides: { ...s.starredOverrides, [emailId]: !current },
          };
        }),
      markRead: (emailId) =>
        set((s) => ({ readOverrides: { ...s.readOverrides, [emailId]: true } })),

      addChat: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
      updateChat: (id, content) =>
        set((s) => ({
          chat: s.chat.map((m) => (m.id === id ? { ...m, content } : m)),
        })),
      appendChat: (id, chunk) =>
        set((s) => ({
          chat: s.chat.map((m) =>
            m.id === id ? { ...m, content: m.content + chunk } : m
          ),
        })),
      setChatBusy: (b) => set({ chatBusy: b }),
      clearChat: () => set({ chat: [] }),
    }),
    {
      name: "inboxpilot-v1",
      partialize: (s) => ({
        launched: s.launched,
        activeView: s.activeView,
        selectedEmailId: s.selectedEmailId,
        tone: s.tone,
        drafts: s.drafts,
        categoryOverrides: s.categoryOverrides,
        readOverrides: s.readOverrides,
        starredOverrides: s.starredOverrides,
        chat: s.chat,
      }),
    }
  )
);

// --- Derived data helpers ---

const BASE_EMAILS = getSampleEmails();
const BASE_BY_ID = new Map(BASE_EMAILS.map((e) => [e.id, e]));

function baseEmail(id: string): Email | undefined {
  return BASE_BY_ID.get(id);
}

type OverrideSlice = Pick<
  IPState,
  "drafts" | "categoryOverrides" | "readOverrides" | "starredOverrides"
>;

/** Merge sample emails with persisted overrides (pure). */
export function selectEmails(s: OverrideSlice): Email[] {
  return BASE_EMAILS.map((e) => {
    const draft = s.drafts[e.id];
    const category = s.categoryOverrides[e.id] ?? e.category;
    const unread =
      s.readOverrides[e.id] !== undefined
        ? !s.readOverrides[e.id]
        : e.unread;
    const starred = s.starredOverrides[e.id] ?? e.starred;
    return {
      ...e,
      category,
      unread,
      starred,
      draft: draft ?? e.draft,
    };
  });
}

/**
 * Memoized hook over the derived emails. Selects the stable override maps
 * individually (so zustand doesn't see a new reference each render) and
 * recomputes via useMemo only when they actually change.
 */
export function useEmails(): Email[] {
  const drafts = useStore((s) => s.drafts);
  const categoryOverrides = useStore((s) => s.categoryOverrides);
  const readOverrides = useStore((s) => s.readOverrides);
  const starredOverrides = useStore((s) => s.starredOverrides);
  return React.useMemo(
    () =>
      selectEmails({
        drafts,
        categoryOverrides,
        readOverrides,
        starredOverrides,
      }),
    [drafts, categoryOverrides, readOverrides, starredOverrides]
  );
}

export { BASE_EMAILS };
