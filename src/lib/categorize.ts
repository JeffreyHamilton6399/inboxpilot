import type { CategoryId } from "./types";

/**
 * The instant, no-model pass that runs over every message as it is fetched.
 *
 * It exists so an inbox is sorted before any request leaves the machine, and
 * so the model is spent on the messages where the answer is actually unclear.
 * Being wrong here is cheap — every category can be overridden by hand, and
 * the model can be re-run on any single message.
 *
 * Matching is done on the sender's *domain*, never on a substring of the whole
 * address. An earlier version tested `address.includes("mail")`, which is true
 * of every gmail.com address ever sent, and filed the entire inbox as
 * marketing.
 */

export interface CategoryInput {
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  labelIds: string[];
  /** The RFC 2369 header. Its presence is the strongest bulk-mail signal there is. */
  listUnsubscribe?: string;
  /** The To header, used to tell "addressed to me" from "cc'd on a thread". */
  to?: string;
  /** The address of the connected mailbox. */
  userEmail?: string;
}

/** Local parts that mean a human will not read your reply. */
const NO_REPLY_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "notifications",
  "notification",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "automated",
  "alerts",
  "alert",
];

/** Services whose mail is machine-generated regardless of the local part. */
const NOTIFICATION_DOMAINS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "atlassian.net",
  "atlassian.com",
  "trello.com",
  "asana.com",
  "linear.app",
  "vercel.com",
  "netlify.com",
  "heroku.com",
  "amazonaws.com",
  "stripe.com",
  "paypal.com",
  "squareup.com",
  "docusign.net",
  "sentry.io",
  "statuspage.io",
];

const MARKETING_DOMAINS = [
  "substack.com",
  "mailchimp.com",
  "mailchimpapp.net",
  "sendgrid.net",
  "constantcontact.com",
  "hubspot.com",
  "klaviyo.com",
  "eventbrite.com",
  "meetup.com",
  "linkedin.com",
  "facebookmail.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "redditmail.com",
  "medium.com",
];

const CALENDAR_DOMAINS = ["calendar.google.com", "zoom.us", "meet.google.com"];

/** Whole words, so "off" cannot match "coffee" and "sale" cannot match "resale". */
const MARKETING_PHRASES = [
  "unsubscribe",
  "newsletter",
  "% off",
  "discount",
  "promo code",
  "limited time",
  "shop now",
  "free shipping",
  "black friday",
  "flash sale",
];

const CALENDAR_PHRASES = [
  "invitation:",
  "updated invitation",
  "canceled event",
  "cancelled event",
  "accepted:",
  "declined:",
  "calendar invite",
];

/** Phrases that ask the reader for something. */
const ASK_PHRASES = [
  "can you",
  "could you",
  "would you",
  "let me know",
  "thoughts",
  "any update",
  "following up",
  "circling back",
  "waiting on",
  "please review",
  "please confirm",
  "your thoughts",
  "what do you think",
  "when you get a chance",
];

export function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).toLowerCase().trim();
}

export function localPartOf(address: string): string {
  const at = address.lastIndexOf("@");
  return (at === -1 ? address : address.slice(0, at)).toLowerCase().trim();
}

/** True when `domain` is the listed domain or a subdomain of it. */
function domainMatches(domain: string, candidates: string[]): boolean {
  return candidates.some((c) => domain === c || domain.endsWith(`.${c}`));
}

function containsWord(haystack: string, phrase: string): boolean {
  // Phrases with punctuation ("% off", "invitation:") are matched literally;
  // bare words get word boundaries so they cannot match inside another word.
  if (/[^a-z0-9 ]/.test(phrase)) return haystack.includes(phrase);
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(haystack);
}

export function categorize(input: CategoryInput): CategoryId {
  const {
    fromEmail,
    subject,
    snippet,
    labelIds,
    listUnsubscribe,
    to = "",
    userEmail = "",
  } = input;

  const domain = domainOf(fromEmail);
  const local = localPartOf(fromEmail);
  const subj = subject.toLowerCase();
  const text = `${subj} ${snippet.toLowerCase()}`;

  // Mail you sent is not mail you need to act on.
  if (labelIds.includes("SENT")) return "actioned";

  // Gmail has already done this classification on its own infrastructure with
  // far more signal than is available here, so it wins where it has an opinion.
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "marketing";
  if (labelIds.includes("CATEGORY_SOCIAL")) return "notification";
  if (labelIds.includes("CATEGORY_FORUMS")) return "notification";

  const automated =
    NO_REPLY_LOCAL_PARTS.some((p) => local === p || local.startsWith(`${p}@`) || local.includes(p)) ||
    domainMatches(domain, NOTIFICATION_DOMAINS);

  // Calendar traffic before the automated check, because invitations come from
  // calendar-notification@google.com and are still meeting updates.
  if (domainMatches(domain, CALENDAR_DOMAINS)) return "meeting-update";
  if (CALENDAR_PHRASES.some((p) => containsWord(subj, p))) return "meeting-update";

  if (domainMatches(domain, MARKETING_DOMAINS)) return "marketing";

  // List-Unsubscribe is what bulk senders are required to set. A service that
  // is telling you your build failed does not set it; a newsletter does.
  if (listUnsubscribe && !automated) return "marketing";
  if (MARKETING_PHRASES.some((p) => containsWord(text, p))) return "marketing";

  if (automated || labelIds.includes("CATEGORY_UPDATES")) return "notification";

  // What is left was written by a person, so the question becomes whether it
  // wants something from you.
  const addressedToMe =
    userEmail !== "" && to.toLowerCase().includes(userEmail.toLowerCase());
  const isReply = /^(re|aw|sv):/i.test(subject.trim());
  const asks =
    ASK_PHRASES.some((p) => containsWord(text, p)) || subject.includes("?") || snippet.includes("?");

  if (asks && (addressedToMe || isReply)) return "to-respond";
  if (isReply) return "comment";
  if (addressedToMe && labelIds.includes("UNREAD")) return "to-respond";

  return "fyi";
}
