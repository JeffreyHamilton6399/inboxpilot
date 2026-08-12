"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TONE } from "./sample-data";
import type { CategoryId, ChatMessage, ToneProfile } from "./types";

export type View = "inbox" | "chat" | "meetings" | "settings";

interface IPState {
  activeView: View;
  selectedEmailId: string | null;

  // user profile (mirrored to DB on save; localStorage for instant UX)
  tone: ToneProfile;
  toneHydrated: boolean; // has tone been loaded from the server?

  // per-email client-side overrides (persisted; keyed by Gmail message id)
  drafts: Record<string, string>;
  categoryOverrides: Record<string, CategoryId>;
  readOverrides: Record<string, boolean>;
  starredOverrides: Record<string, boolean>;

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
  clearLocalData: () => void;

  setDraft: (emailId: string, text: string) => void;
  setCategory: (emailId: string, cat: CategoryId) => void;
  toggleRead: (emailId: string, currentUnread: boolean) => void;
  toggleStar: (emailId: string, currentStarred: boolean) => void;
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
      activeView: "inbox",
      selectedEmailId: null,
      tone: DEFAULT_TONE,
      toneHydrated: false,
      drafts: {},
      categoryOverrides: {},
      readOverrides: {},
      starredOverrides: {},
      chat: [],
      chatBusy: false,

      setView: (v) => set({ activeView: v }),
      selectEmail: (id) => set({ selectedEmailId: id }),

      setTone: (patch) => set((s) => ({ tone: { ...s.tone, ...patch } })),
      replaceTone: (t) => set({ tone: t, toneHydrated: true }),
      setToneHydrated: (b) => set({ toneHydrated: b }),
      resetTone: () => set({ tone: DEFAULT_TONE }),
      clearLocalData: () =>
        set({
          drafts: {},
          categoryOverrides: {},
          readOverrides: {},
          starredOverrides: {},
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
      toggleRead: (emailId, currentUnread) =>
        set((s) => ({
          readOverrides: {
            ...s.readOverrides,
            [emailId]: currentUnread, // store the *read* boolean
          },
        })),
      toggleStar: (emailId, currentStarred) =>
        set((s) => ({
          starredOverrides: {
            ...s.starredOverrides,
            [emailId]: !currentStarred,
          },
        })),
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
      name: "inboxpilot-v2",
      partialize: (s) => ({
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
