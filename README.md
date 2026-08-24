# InboxPilot

An assistant for the inbox you already have. It connects to your Gmail, sorts what
arrives, drafts replies in the way you write, and answers questions about your mail.

InboxPilot is not a service anyone operates. It is a Next.js app you deploy to your
own account, pointed at your own database, your own Google OAuth client, and a model
key you supply. There is no InboxPilot server between you and Google, because there
is no InboxPilot server.

MIT licensed.

## What it does

**Sorts on arrival.** Every message lands in one of eight categories — To Respond,
Awaiting Reply, FYI, Comment, Notification, Meeting Update, Actioned, Marketing. A
heuristic pass runs instantly on fetch using Gmail's own labels and sender patterns,
which costs nothing and is right most of the time; you can re-run a real model on any
single message when it isn't, and override either by hand.

**Drafts, but does not send.** Describe how you write once — tone, length, formality,
phrases you use, phrases you never want to see — and replies come back in that
register. The finished draft is handed to Gmail's own compose window, where you send
it yourself. InboxPilot never sends mail, and does not ask for the permission that
would let it.

**Answers questions about your mail.** "Who am I still owing a reply?" gets answered
from the messages actually in your inbox, with the sender and subject cited. The
system prompt forbids inventing messages that aren't in the provided context, which
helps and is not a guarantee.

**Summarizes a transcript.** Paste what was said in a meeting, get the summary and
the action items. Nothing joins your call.

## What it costs you in trust

Worth being explicit, because "AI email assistant" should make anyone read the fine
print:

- **Gmail is read with `gmail.readonly` and nothing more**, granted through Google's
  own consent screen and revocable from your Google account at any time. There is no
  write scope, so nothing here can send, delete, or alter your mail.
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
AI_MODEL=llama-3.3-70b-versatile
```

Swap the base URL for `https://api.x.ai/v1`, `https://api.openai.com/v1`, or
`http://localhost:11434/v1` for a local Ollama server, and set the model to match.

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
| `src/app/api/gmail/` | OAuth handshake, message list, single message fetch |
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
There are no tests.

## Contributing

Pull requests welcome. Fork it, self-host it, make it yours.

## License

[MIT](./LICENSE).
