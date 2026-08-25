# InboxPilot

An assistant for the inbox you already have. It connects to your Gmail, sorts what
arrives, drafts replies in the way you write, and answers questions about your mail.

InboxPilot is not a service anyone operates. It is a Next.js app you deploy to your
own account, pointed at your own database, your own Google OAuth client, and a model
key you supply. There is no InboxPilot server between you and Google, because there
is no InboxPilot server.

MIT licensed.

## What it does

**Shows the conversation, not one message.** Opening a message opens the whole
thread — every reply, yours included, oldest first with the newest one open and
the rest folded. Your own messages are tinted, so you can see who said what
without reading a name. A reply sent from here appears in the thread as soon as
it goes, which sent mail otherwise does not, since it is not in the inbox
listing.

**Sorts on arrival.** Every message lands in one of eight categories — To Respond,
Awaiting Reply, FYI, Comment, Notification, Meeting Update, Actioned, Marketing. The
first pass costs nothing and makes no network call: it reads Gmail's own category
labels, the sender's domain, and the `List-Unsubscribe` header, which is what bulk
senders are obliged to set and what a person writing to you never does. You can
re-run a real model on any single message where that guess is wrong, and override
either by hand.

**Sorts on demand, too.** The instant pass is free and usually right. When it is
not, **Sort with AI** re-reads the whole inbox and re-tags it in batches of
twenty-five — one model call per batch, not one per message. Sort the list by
newest, oldest, unread, needs-a-reply or sender, and **See all** clears the
filter from a button that is always on screen.

**Drafts, and sends when you say so.** Describe how you write once — tone, length,
formality, phrases you use, phrases you never want to see — and replies come back in
that register. The draft lands in a normal compose box you can edit.

Send goes out through the Gmail API, in the right thread, from your own account. It
takes two presses and the second one names the recipient, because a sent message
cannot be recalled and the text may have been written by a model. Nothing is ever
sent on a schedule, in the background, or without that press. "Open in Gmail" is
still there for anything this box does not do, like attachments.

**Answers questions about your mail.** "Who am I still owing a reply?" gets answered
from the messages actually in your inbox, with the sender and subject cited. The
system prompt forbids inventing messages that aren't in the provided context, which
helps and is not a guarantee.

**Summarizes a transcript.** Paste what was said in a meeting, get the summary and
the action items. Nothing joins your call.

## What it costs you in trust

Worth being explicit, because "AI email assistant" should make anyone read the fine
print:

- **Gmail is read with `gmail.readonly` and sent with `gmail.send`**, granted through
  Google's own consent screen and revocable from your Google account at any time.
  `gmail.send` can only add a message; it cannot read, delete, or alter anything, and
  it is used at exactly one place in the code — the Send button. There is no scope
  that would let this app modify or delete your mail, and it does not ask for one.
- **Message bodies are fetched when you open a message**, not mirrored into the
  database. What the database holds is your login, your OAuth tokens, and your tone
  profile.
- **Drafting a reply sends that message to whichever model endpoint you configured.**
  That is the whole point, and it is also the part to think about. Pick a provider you
  are willing to show your mail to — or point it at a model running on your own
  machine and show it to nobody.

## Running it

Requires Node 20+ and a Postgres database. Bun is what the lockfile is written
against; npm works.

```bash
git clone https://github.com/JeffreyHamilton6399/inboxpilot.git
cd inboxpilot
bun install
cp .env.example .env
```

`.env.example` documents every variable. The three you cannot skip are
`DATABASE_URL`, `DIRECT_DATABASE_URL`, and `NEXTAUTH_SECRET`.

### The database

Vercel's filesystem is ephemeral, so SQLite is not an option. Supabase's free tier is
what this is written against, though any Postgres works. From **Settings → Database →
Connection string**, take the *Transaction pooler* URI (port 6543) as `DATABASE_URL`
and the *Direct connection* URI (port 5432) as `DIRECT_DATABASE_URL`. Serverless
functions connect through the pooler; Prisma needs the direct connection for
migrations, which pgbouncer cannot proxy.

```bash
bun run db:push     # create the tables
bun run dev         # http://localhost:3000
```

### The model

InboxPilot talks to any endpoint that speaks the OpenAI `/chat/completions` API. Set
three variables and you are done:

```bash
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your-key
AI_MODEL=openai/gpt-oss-120b
AI_REASONING_EFFORT=low
```

Swap the base URL for `https://api.x.ai/v1`, `https://api.openai.com/v1`, or
`http://localhost:11434/v1` for a local Ollama server, and set the model to match.

`AI_REASONING_EFFORT` is only interesting if you change the model. Reasoning
models think before they answer and can spend an entire token budget doing it,
returning an empty completion; the default model is one of those, so the setting
defaults to `low`. Providers that have never heard of the parameter reject the
request, which is detected from their own error and retried without it. If a
model still comes back empty because it thought past its budget, the request is
retried once with four times the headroom before you are shown an error.

Several open models also emit their scratchpad as a `<think>` block in the reply.
Those are stripped on the way out, streaming included, so they never reach a draft.

There is deliberately no fallback provider. An earlier version of this app tried a
second provider whenever the first one failed, which meant a typo in an API key
produced quietly worse answers instead of an error — the harder of the two failures to
debug. Now a missing or broken key returns a 503 that says so. The rest of the app —
mail, categories, settings — works without a key at all.

### Gmail

Without Google credentials the inbox shows a "Connect Gmail" prompt and nothing else.
To enable it, in the [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project, then **APIs & Services → OAuth consent screen** (External, with
   your own address added as a test user).
2. **Credentials → Create credentials → OAuth client ID → Web application**, with
   `http://localhost:3000/api/gmail/callback` as an authorized redirect URI. Add your
   deployment's `/api/gmail/callback` too when you deploy.
3. Enable the **Gmail API** under **Library**.
4. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, and restart.

## Deploying

Import the repo at [vercel.com/new](https://vercel.com/new) and copy in the same
environment variables, with `NEXTAUTH_URL` set to the deployment's own URL and the
Google redirect URI updated to match. Next.js is detected automatically. Run
`bun run db:push` once against the production database.

## How it is put together

| | |
|---|---|
| `src/app/api/gmail/` | OAuth handshake, message list, single message, thread, send |
| `src/app/api/ai/` | categorize, draft, chat, summarize, health |
| `src/lib/ai.ts` | the only place that talks to a model |
| `src/lib/gmail.ts` | token refresh and the Gmail REST calls |
| `src/lib/defaults.ts` | the eight categories and the default tone profile |
| `src/components/inbox-pilot/` | the app: inbox, ask, meetings, settings |
| `src/components/ui/` | shadcn primitives, generated rather than hand-written |

Next.js 16 App Router, Prisma against Postgres, NextAuth with a credentials provider,
TanStack Query for server state and Zustand for local, Tailwind 4 with shadcn/ui.

## Not done yet

Outlook and plain IMAP are not supported — Gmail is the only provider. The inbox is
fetched on demand and cached for fifteen seconds rather than pushed. Category
overrides live in browser storage, so they do not follow you to another machine.
Only one Gmail account per user is read, even though the schema allows several.

## Tests

```bash
bun run test
```

They cover the parts where being wrong is expensive and the answer is checkable
without a network: the OAuth state signing, the instant categorizer, and the
Gmail body extraction. The React views have no tests.

## Contributing

Pull requests welcome. Fork it, self-host it, make it yours.

## License

[MIT](./LICENSE).
