// Core domain types for InboxPilot

export type CategoryId =
  | "to-respond"
  | "fyi"
  | "comment"
  | "notification"
  | "meeting-update"
  | "awaiting-reply"
  | "actioned"
  | "marketing";

export interface Category {
  id: CategoryId;
  label: string;
  description: string;
  /** tailwind classes for badge */
  badge: string;
  /** dot color */
  dot: string;
}

/** A file on a message. Bytes are fetched on demand from our own route. */
/**
 * What a message can be asked to become. Everything is optional; anything
 * left out is left alone. Lives here rather than in `gmail.ts` because the
 * client sends these too, and `gmail.ts` is server-only.
 */
export interface MessageChange {
  starred?: boolean;
  unread?: boolean;
  /** True archives (drops INBOX), false moves it back to the inbox. */
  archived?: boolean;
}

export interface Attachment {
  id: string;
  /** Position in the message's MIME tree — what the URLs are keyed on. */
  partId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface Email {
  id: string;
  /** The conversation this message belongs to. */
  threadId: string;
  from: { name: string; email: string; avatarColor: string };
  to: string;
  subject: string;
  preview: string;
  body: string;
  receivedAt: string; // ISO
  category: CategoryId;
  aiCategoryReason?: string;
  unread: boolean;
  starred: boolean;
  hasAttachment?: boolean;
  draft?: string; // generated draft text
  draftTone?: string;
}

export interface Meeting {
  id: string;
  title: string;
  platform: "Google Meet" | "Zoom" | "Teams";
  date: string; // ISO
  durationMin: number;
  attendees: string[];
  transcript: { speaker: string; text: string; ts: string }[];
  summary: string;
  actionItems: string[];
  status: "completed" | "upcoming";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string; // ISO
}

export interface ToneProfile {
  name: string;
  role: string; // e.g. "Senior Recruiter"
  tone: string; // e.g. "warm, direct, concise"
  signature: string;
  length: "short" | "medium" | "long";
  formality: "casual" | "neutral" | "formal";
  samplePhrases: string[]; // phrases you often use
  avoid: string[]; // phrases to avoid
}

export interface HealthResponse {
  /** Effort actually being sent, or null when the parameter is not in use. */
  reasoningEffort: string | null;
  /** Host of the configured OpenAI-compatible endpoint, e.g. "api.groq.com". */
  host: string;
  model: string;
  ready: boolean;
}

export interface ThreadMessage {
  id: string;
  from: { name: string; email: string };
  to: string;
  receivedAt: string;
  body: string;
  /** True for messages the connected account sent, including replies from here. */
  fromMe: boolean;
}
