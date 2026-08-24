import type { Category, CategoryId, ToneProfile } from "./types";

export const CATEGORIES: Category[] = [
  {
    id: "to-respond",
    label: "To Respond",
    description: "Needs a reply from you",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25",
    dot: "bg-amber-500",
  },
  {
    id: "fyi",
    label: "FYI",
    description: "Informational, no action needed",
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/25",
    dot: "bg-slate-500",
  },
  {
    id: "comment",
    label: "Comment",
    description: "A reply in an ongoing thread",
    badge:
      "bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/25",
    dot: "bg-teal-500",
  },
  {
    id: "notification",
    label: "Notification",
    description: "Automated system updates",
    badge:
      "bg-stone-500/15 text-stone-700 dark:text-stone-300 ring-1 ring-stone-500/25",
    dot: "bg-stone-500",
  },
  {
    id: "meeting-update",
    label: "Meeting Update",
    description: "Calendar invites & changes",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/25",
    dot: "bg-violet-500",
  },
  {
    id: "awaiting-reply",
    label: "Awaiting Reply",
    description: "You replied, waiting on them",
    badge:
      "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/25",
    dot: "bg-fuchsia-500",
  },
  {
    id: "actioned",
    label: "Actioned",
    description: "Handled and filed",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25",
    dot: "bg-emerald-500",
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Newsletters & promotions",
    badge:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/25",
    dot: "bg-rose-500",
  },
];

export const CATEGORY_MAP: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, Category>;

export const DEFAULT_TONE: ToneProfile = {
  name: "",
  role: "",
  tone: "clear, concise, and friendly",
  signature: "",
  length: "short",
  formality: "neutral",
  samplePhrases: [],
  avoid: ["Hope this email finds you well", "I hope you are doing well"],
};

export const SUGGESTED_CHAT_PROMPTS = [
  "Which emails need a reply today?",
  "Summarize my most recent important thread",
  "Draft a polite follow-up to someone I'm waiting on",
  "What's sitting in my inbox the longest?",
  "Which emails look like newsletters I can archive?",
];
