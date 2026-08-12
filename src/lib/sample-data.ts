import type { Category, CategoryId, Email, Meeting, ToneProfile } from "./types";

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

const AV = {
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  fuchsia: "bg-fuchsia-500",
  stone: "bg-stone-500",
  slate: "bg-slate-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-600",
};

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

export const DEFAULT_TONE: ToneProfile = {
  name: "Alex Rivera",
  role: "Senior Technical Recruiter",
  tone: "warm, direct, concise",
  signature: "Alex",
  length: "short",
  formality: "neutral",
  samplePhrases: [
    "Happy to jump on a quick call",
    "Let me know what works for you",
    "Great hearing from you",
  ],
  avoid: ["Hope this email finds you well", "I hope you are doing well"],
};

interface EmailSeed {
  id: string;
  from: { name: string; email: string; avatarColor: string };
  subject: string;
  preview: string;
  body: string;
  receivedAt: number; // minutes ago
  category: CategoryId;
  aiCategoryReason: string;
  unread: boolean;
  starred: boolean;
  hasAttachment?: boolean;
}

const EMAIL_SEEDS: EmailSeed[] = [
  {
    id: "e1",
    from: { name: "Priya Nair", email: "priya.nair@gmail.com", avatarColor: AV.violet },
    subject: "Re: Senior Backend Engineer @ FintechCo — interested!",
    preview: "Hi Alex, thanks for reaching out! This looks great. Could you share the comp band and remote policy?",
    body: `Hi Alex,

Thanks for reaching out about the Senior Backend Engineer role at FintechCo — it sounds like a great fit with what I'm looking for.

Before I commit to a call, could you share:
- The compensation band
- The remote/hybrid policy
- What the team stack looks like these days

Happy to jump on a quick call once I have those. Wednesday or Thursday afternoon works for me.

Thanks!
Priya`,
    receivedAt: 22,
    category: "to-respond",
    aiCategoryReason: "Candidate asking specific questions that require a direct reply.",
    unread: true,
    starred: true,
  },
  {
    id: "e2",
    from: { name: "Marcus Lee", email: "marcus@venturelabs.io", avatarColor: AV.teal },
    subject: "Intro: Jordan (ex-Stripe) → your portfolio companies",
    preview: "Alex — quick intro as promised. Jordan is a killer PM looking for her next thing. Worth 15 min?",
    body: `Hey Alex,

Quick intro as promised on the call last week.

Jordan Park (cc'd) is a senior PM, most recently at Stripe where she led the Connect onboarding rebuild. She's quietly exploring her next role and I thought of your portfolio companies immediately — especially the two in fintech infra.

Jordan, Alex runs talent strategy across the fund's early-stage bets and knows everyone worth knowing. Worth a 15-min intro call?

Cheers,
Marcus`,
    receivedAt: 48,
    category: "to-respond",
    aiCategoryReason: "A warm intro that expects you to acknowledge and set up a call.",
    unread: true,
    starred: false,
  },
  {
    id: "e3",
    from: { name: "Greenhouse", email: "no-reply@greenhouse.io", avatarColor: AV.stone },
    subject: "3 candidates moved to Onsite stage",
    preview: "Automation: 3 candidates were advanced to the Onsite stage for Senior Backend Engineer.",
    body: `[Greenhouse Automation]

3 candidates have been advanced to the Onsite stage for the Senior Backend Engineer req (#BE-204):

1. Priya Nair
2. Devon Carter
3. Sana Ahmed

Review the updated pipeline: https://greenhouse.io/pipeline/BE-204

You are receiving this because you are the recruiter on this req.`,
    receivedAt: 65,
    category: "notification",
    aiCategoryReason: "Automated system notification; no reply expected.",
    unread: false,
    starred: false,
  },
  {
    id: "e4",
    from: { name: "Calendly", email: "no-reply@calendly.com", avatarColor: AV.stone },
    subject: "New event: Intro call with Devon Carter — Thu 2:00pm",
    preview: "Devon Carter booked Intro Call (30m) for Thursday at 2:00 PM PT.",
    body: `[Calendly]

Devon Carter booked:
Event: Intro Call (30m)
When: Thursday, 2:00 PM – 2:30 PM (Pacific Time)

Add to calendar · Reschedule · Cancel`,
    receivedAt: 90,
    category: "meeting-update",
    aiCategoryReason: "Calendar/meeting booking confirmation.",
    unread: false,
    starred: false,
  },
  {
    id: "e5",
    from: { name: "Sana Ahmed", email: "sana.ahmed@protonmail.com", avatarColor: AV.rose },
    subject: "Following up — take-home feedback?",
    preview: "Hi Alex, I submitted the take-home last Tuesday and wanted to follow up on next steps. No rush!",
    body: `Hi Alex,

I submitted the take-home assignment last Tuesday and just wanted to follow up on next steps — totally understand the team is busy, no rush at all.

Let me know if there's anything else you need from my end.

Best,
Sana`,
    receivedAt: 140,
    category: "awaiting-reply",
    aiCategoryReason: "Candidate is waiting on you; you already owe a reply internally.",
    unread: false,
    starred: false,
  },
  {
    id: "e6",
    from: { name: "Hiring Manager — Tom B.", email: "tom.briggs@fintechco.com", avatarColor: AV.green },
    subject: "Re: debrief for Priya — go/no go?",
    preview: "She's a strong yes from me. Can we move to offer? Need numbers by EOD Friday.",
    body: `Alex,

Watched the onsite recording. Priya's a strong yes from me — system design was sharp and she pushed back well on the tradeoffs.

Can we move to offer? I need to get numbers to finance by EOD Friday so we don't lose her to the other offer she mentioned.

What's the band we're targeting?

Tom`,
    receivedAt: 180,
    category: "comment",
    aiCategoryReason: "Internal thread continuation requiring your input.",
    unread: false,
    starred: true,
  },
  {
    id: "e7",
    from: { name: "Engineering Leadership Weekly", email: "digest@engleadership.dev", avatarColor: AV.rose },
    subject: "This week: hiring loops that don't leak talent",
    preview: "5 reads on building hiring loops that convert. Plus: the 'take-home' debate, settled.",
    body: `Engineering Leadership Weekly

This week's edition:
- 5 hiring loops that don't leak senior talent
- The take-home debate, settled
- Compensation bands for 2025 (report)

Read online · Unsubscribe`,
    receivedAt: 220,
    category: "marketing",
    aiCategoryReason: "Newsletter / promotional digest.",
    unread: true,
    starred: false,
  },
  {
    id: "e8",
    from: { name: "Devon Carter", email: "devon.carter@hey.com", avatarColor: AV.amber },
    subject: "Thanks! Looking forward to Thursday",
    preview: "Appreciate the flexibility on the time, Alex. See you Thursday at 2. I'll have the laptop ready.",
    body: `Hey Alex,

Appreciate the flexibility moving the call to 2pm — Thursday works perfectly.

I'll have read up on FintechCo's recent Series C news so we can skip the basics. See you then!

Devon`,
    receivedAt: 260,
    category: "actioned",
    aiCategoryReason: "Confirmation of a scheduled call; already handled.",
    unread: false,
    starred: false,
  },
  {
    id: "e9",
    from: { name: "GitHub", email: "noreply@github.com", avatarColor: AV.stone },
    subject: "[inboxpilot] PR #142 merged into main",
    preview: "feat(ai): streaming chat fallback — merged by @alexrivera",
    body: `[GitHub]

PR #142 "feat(ai): streaming chat fallback" was merged into main by @alexrivera.

2 files changed, +186 / -12.

View changes`,
    receivedAt: 300,
    category: "notification",
    aiCategoryReason: "Automated developer tooling notification.",
    unread: false,
    starred: false,
  },
  {
    id: "e10",
    from: { name: "Jordan Park", email: "jordan.park@gmail.com", avatarColor: AV.fuchsia },
    subject: "Re: Intro — thanks Marcus!",
    preview: "Thanks Marcus! Alex, I'd love to chat. I'm free Mon/Tue next week — let me know what works.",
    body: `Thanks Marcus for the intro!

Alex — lovely to e-meet you. I'd love to chat about the fintech infra roles you mentioned. I'm free Monday or Tuesday next week, mornings Pacific work best for me.

Looking forward to it,
Jordan`,
    receivedAt: 340,
    category: "to-respond",
    aiCategoryReason: "New contact replying to an intro; expects scheduling.",
    unread: true,
    starred: false,
  },
  {
    id: "e11",
    from: { name: "People Ops", email: "peopleops@fintechco.com", avatarColor: AV.slate },
    subject: "Q3 hiring plan — your input requested by Fri",
    preview: "Heads up: we're finalizing Q3 headcount. Please submit your req priorities by Friday EOD.",
    body: `Hi Alex,

Quick heads up — we're finalizing the Q3 headcount plan and need your input on req priorities for the engineering org.

Please submit your top 5 priorities + rationale by Friday EOD via the planning doc:
https://docs.fintechco.com/q3-planning

This will feed directly into the Friday leadership review.

Thanks,
People Ops`,
    receivedAt: 420,
    category: "fyi",
    aiCategoryReason: "Informational deadline notice; flagged for awareness.",
    unread: false,
    starred: true,
  },
  {
    id: "e12",
    from: { name: "Lenny's Newsletter", email: "lenny@lennysnewsletter.com", avatarColor: AV.rose },
    subject: "How the best recruiters source in 2025",
    preview: "The sourcing playbooks that actually work — from 12 top in-house recruiters.",
    body: `Lenny's Newsletter

This week: How the best recruiters source in 2025.
We interviewed 12 in-house recruiters at top startups.

Read the full breakdown →`,
    receivedAt: 600,
    category: "marketing",
    aiCategoryReason: "Newsletter / promotional content.",
    unread: false,
    starred: false,
  },
];

export function getSampleEmails(): Email[] {
  return EMAIL_SEEDS.map((s) => ({
    id: s.id,
    from: s.from,
    to: "alex@inboxpilot.app",
    subject: s.subject,
    preview: s.preview,
    body: s.body,
    receivedAt: iso(s.receivedAt),
    category: s.category,
    aiCategoryReason: s.aiCategoryReason,
    unread: s.unread,
    starred: s.starred,
    hasAttachment: s.hasAttachment,
  }));
}

export const SAMPLE_MEETINGS: Meeting[] = [
  {
    id: "m1",
    title: "Debrief — Priya Nair (Sr Backend Eng)",
    platform: "Google Meet",
    date: iso(60 * 5),
    durationMin: 45,
    attendees: ["Alex Rivera", "Tom Briggs", "Lena Wu"],
    status: "completed",
    transcript: [
      { speaker: "Alex", text: "So, overall thoughts on Priya from the onsite?", ts: "00:00" },
      { speaker: "Tom", text: "Strong yes. The system design on the rate-limiter was the cleanest I've seen this quarter.", ts: "00:12" },
      { speaker: "Lena", text: "Agreed. Behavioral was solid too — she owned the failure story without deflecting.", ts: "00:34" },
      { speaker: "Alex", text: "Comp expectation she mentioned was around 220 base. That within band?", ts: "01:02" },
      { speaker: "Tom", text: "Top of band, but doable. Let's move to offer before her other one lands.", ts: "01:20" },
    ],
    summary:
      "Hiring panel unanimously recommended moving Priya Nair to offer for the Senior Backend Engineer role. System design and behavioral signals were both strong. Comp expectation (~$220k base) is at the top of band but approved. Action: extend offer before competing offer lands.",
    actionItems: [
      "Alex to extend verbal offer to Priya today",
      "Tom to confirm comp numbers with Finance by EOD",
      "Lena to prepare offer letter template",
    ],
  },
  {
    id: "m2",
    title: "Weekly sync — Q3 hiring plan",
    platform: "Zoom",
    date: iso(60 * 26),
    durationMin: 30,
    attendees: ["Alex Rivera", "People Ops", "VP Eng"],
    status: "completed",
    summary:
      "Reviewed Q3 headcount priorities. Engineering wants 3 senior backend + 2 infra hires. People Ops flagged budget constraints on the infra roles — to be revisited after the Friday leadership review.",
    actionItems: [
      "Submit top 5 req priorities to planning doc by Friday",
      "Re-scope infra headcount after leadership review",
    ],
    transcript: [
      { speaker: "Alex", text: "Engineering is asking for three senior backend and two infra hires in Q3.", ts: "00:00" },
      { speaker: "VP Eng", text: "The backend ones are non-negotiable. Infra we can phase.", ts: "00:30" },
      { speaker: "People Ops", text: "Budget may not cover all five. Let's revisit after Friday's review.", ts: "01:05" },
    ],
  },
];

export const SUGGESTED_CHAT_PROMPTS = [
  "Which emails need a reply today?",
  "Summarize Priya Nair's candidacy",
  "Draft a follow-up to Sana about her take-home",
  "What's the status of the Q3 hiring plan?",
  "Who haven't I replied to this week?",
];
