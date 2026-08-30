"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TONE } from "./defaults";
import type { CategoryId, ChatMessage, ToneProfile } from "./types";

export type View = "inbox" | "chat" | "meetings" | "settings";

interface IPState {
  activeView: View;
  selectedEmailId: string | null;

  // user profile (mirrored to DB on save; localStorage for instant UX)
  tone: ToneProfile;
  toneHydrated: boolean; // has tone been loaded from the server?

  /**
   * Whether setup has been walked past. Persisted, because the alternative is
   * showing the setup page again on every reload to anyone who chose to skip
   * it, which is nagging rather than onboarding.
   */
  setupDismissed: boolean;

  // per-email client-side overrides (persisted; keyed by Gmail message id)
  drafts: Record<string, string>;
  categoryOverrides: Record<string, CategoryId>;
  readOverrides: Record<string, boolean>;
  starredOverrides: Record<string, boolean>;
  /**
   * Archived in this session, hidden from the list until the server catches
   * up. Deliberately not persisted: once Gmail has the change, `in:inbox`
   * stops returning the message and the server is the better authority.
   */
  archivedIds: string[];

  // AI chat (per-browser)
  chat: ChatMessage[];
  chatBusy: boolean;

  // actions
  setView: (v: View) => void;
  selectEmail: (id: string | null) => void;

  setTone: (patch: Partial<ToneProfile>) => void;
  replaceTone: (t: ToneProfile) => void;
  setToneHydrated: (b: boolean) => void;
  resetTone: () => void;
  dismissSetup: () => void;
  clearLocalData: () => void;

  setDraft: (emailId: string, text: string) => void;
  setCategory: (emailId: string, cat: CategoryId) => void;
  setRead: (emailId: string, read: boolean) => void;
  setStarred: (emailId: string, starred: boolean) => void;
  setArchived: (emailIds: string[], archived: boolean) => void;

  addChat: (msg: ChatMessage) => void;
  updateChat: (id: string, content: string) => void;
  appendChat: (id: string, chunk: string) => void;
  setChatBusy: (b: boolean) => void;
  clearChat: () => void;
}

export const useStore = create<IPState>()(
  persist(
    (set) => ({
      activeView: "inbox",
      selectedEmailId: null,
      tone: DEFAULT_TONE,
      toneHydrated: false,
      setupDismissed: false,
      drafts: {},
      categoryOverrides: {},
      readOverrides: {},
      starredOverrides: {},
      archivedIds: [],
      chat: [],
      chatBusy: false,

      setView: (v) => set({ activeView: v }),
      selectEmail: (id) => set({ selectedEmailId: id }),

      setTone: (patch) => set((s) => ({ tone: { ...s.tone, ...patch } })),
      replaceTone: (t) => set({ tone: t, toneHydrated: true }),
      setToneHydrated: (b) => set({ toneHydrated: b }),
      resetTone: () => set({ tone: DEFAULT_TONE }),
      dismissSetup: () => set({ setupDismissed: true }),
      clearLocalData: () =>
        set({
          drafts: {},
          categoryOverrides: {},
          readOverrides: {},
          starredOverrides: {},
          archivedIds: [],
          chat: [],
          chatBusy: false,
          selectedEmailId: null,
        }),

      setDraft: (emailId, text) =>
        set((s) => ({ drafts: { ...s.drafts, [emailId]: text } })),
      setCategory: (emailId, cat) =>
        set((s) => ({
          categoryOverrides: { ...s.categoryOverrides, [emailId]: cat },
        })),
      // Absolute rather than toggling, so a failed change can be put back
      // exactly as it was instead of flipped again and hoped for. These only
      // move what is on screen; useMessageActions is what tells Gmail, and
      // what calls these back if Gmail says no.
      setRead: (emailId, read) =>
        set((s) => ({ readOverrides: { ...s.readOverrides, [emailId]: read } })),
      setStarred: (emailId, starred) =>
        set((s) => ({ starredOverrides: { ...s.starredOverrides, [emailId]: starred } })),
      setArchived: (emailIds, archived) =>
        set((s) => ({
          archivedIds: archived
            ? [...new Set([...s.archivedIds, ...emailIds])]
            : s.archivedIds.filter((id) => !emailIds.includes(id)),
        })),

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
      name: "inboxpilot-v2",
      partialize: (s) => ({
        activeView: s.activeView,
        selectedEmailId: s.selectedEmailId,
        tone: s.tone,
        setupDismissed: s.setupDismissed,
        drafts: s.drafts,
        categoryOverrides: s.categoryOverrides,
        readOverrides: s.readOverrides,
        starredOverrides: s.starredOverrides,
        chat: s.chat,
      }),
    }
  )
);
