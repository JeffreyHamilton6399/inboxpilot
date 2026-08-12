# InboxPilot

**Your AI email.** Log in, connect Gmail, and let AI organize your inbox, draft replies in your voice, and answer questions about your email — all in one open-source app.

InboxPilot is a real email client (not an overlay): you sign up with email/password, connect your Gmail via official Google OAuth, and the app reads your actual inbox. No template data, no third-party inbox SaaS — your email flows through your own deployment.

> Free, open source (MIT), and self-hostable.

---

## ✨ Features

- **Email login** — sign up and log in with email + password (NextAuth credentials).
- **Connect Gmail** — official Google OAuth (`gmail.readonly` + `gmail.send`). Read your real inbox; disconnect any time.
- **Smart inbox organizer** — every email auto-sorted into 8 categories (To Respond, FYI, Awaiting Reply, …). Override any category; re-run the AI on any email.
- **Drafts in your voice** — a per-account tone profile shapes every draft. Refine before sending — the AI never sends for you.
- **Chat with your inbox** — ask "who haven't I replied to?" in plain English. Streaming answers grounded in your real emails.
- **Meeting summaries** — paste any transcript, get a summary + action items. No bot joins your call.
- **Private by design** — runs on your own Vercel account with your own AI key.
- **Bring your own AI** — Grok (xAI) out of the box, or the built-in fallback with zero configuration. All AI endpoints are auth-gated.

---

## 🚀 Quick start

```bash
git clone https://github.com/JeffreyHamilton6399/inboxpilot.git
cd inboxpilot
bun install            # or: npm install
cp .env.example .env
```

### Set up the database (Supabase — free, 2 min)

SQLite doesn't work on Vercel, so we use **Supabase** (free hosted Postgres) for both local dev and production:

1. Create a free project at [supabase.com](https://supabase.com)
2. In your Supabase project: **Settings → Database → Connection string**
3. Copy the **Transaction pooler** URI (port 6543) → paste as `DATABASE_URL` in `.env`
4. Copy the **Direct connection** URI (port 5432) → paste as `DIRECT_DATABASE_URL` in `.env`
5. Create the tables:
   ```bash
   bun run db:push
   ```

### Finish your `.env`

```bash
# Generate a session secret:
openssl rand -base64 32   # paste the output as NEXTAUTH_SECRET

# Optionally add Grok (or use the built-in fallback with no key):
# GROK_API_KEY=xai-...
```

### Run it

```bash
bun run dev
```

Open http://localhost:3000. Create an account, then connect Gmail (see below).

> **Memory note:** the dev server is memory-hungry. On a machine with < 4 GB RAM, start it with:
> `NODE_OPTIONS="--max-old-space-size=2048" bun run dev`

---

## 🔑 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase **Transaction pooler** URI (port 6543, with `?pgbouncer=true`). Used at runtime. |
| `DIRECT_DATABASE_URL` | Yes | Supabase **Direct connection** URI (port 5432). Used by Prisma for migrations. |
| `NEXTAUTH_SECRET` | Yes | Session secret. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | App URL (`http://localhost:3000` locally; your Vercel URL in prod). |
| `GROK_API_KEY` | No | xAI Grok key. If set, Grok powers AI. If empty, built-in fallback. All AI endpoints require login. |
| `GROK_MODEL` | No | Grok model id (default `grok-2-latest`). |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client id (enables Gmail connect). |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret. |

---

## 📧 Gmail setup (to enable "Connect Gmail")

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project → **APIs & Services → OAuth consent screen** (External, add your email as a test user).
3. **Credentials → Create credentials → OAuth client ID** → Web application.
4. Add an **Authorized redirect URI**:
   - Local: `http://localhost:3000/api/gmail/callback`
   - Prod: `https://YOUR-VERCEL-URL/api/gmail/callback`
5. Enable the **Gmail API** under APIs & Services → Library.
6. Copy the Client ID + Secret into `.env.local` (or Vercel env vars):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
7. Restart the app. The Inbox and Settings pages now show "Connect Gmail".

Without these, the app still works — AI chat runs generically, and you can paste meeting transcripts. The inbox just shows a "Connect Gmail" prompt.

---

## ☁️ Deploy to Vercel

1. The repo is already on GitHub (public): [JeffreyHamilton6399/inboxpilot](https://github.com/JeffreyHamilton6399/inboxpilot)
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Add these environment variables (from your Supabase project + `.env`):
   - `DATABASE_URL` — Supabase pooler URI (port 6543, with `?pgbouncer=true`)
   - `DIRECT_DATABASE_URL` — Supabase direct URI (port 5432)
   - `NEXTAUTH_SECRET` — the secret you generated
   - `NEXTAUTH_URL` — your Vercel URL (e.g. `https://inboxpilot.vercel.app`)
   - `GROK_API_KEY` — your xAI key (optional)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for Gmail (optional)
4. Deploy. Vercel auto-detects Next.js. The Postgres schema is already set to `postgresql` — no code changes needed.
5. After deploy, run `bun run db:push` once locally to ensure tables exist (or add a postbuild script).

---

## 🧱 Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Auth**: NextAuth.js v4 (credentials provider, JWT sessions)
- **Email**: Gmail API via Google OAuth (`google-auth-library`)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **State**: Zustand (persisted) + TanStack Query (server state)
- **AI**: xAI Grok (OpenAI-compatible) with a z-ai-web-dev-sdk fallback
- **DB**: Prisma + Supabase (Postgres — same for local dev and Vercel)
- **Icons**: Lucide · **Animation**: Framer Motion · **Themes**: next-themes

---

## 🗺️ Roadmap

- [ ] Outlook (Microsoft Graph) integration
- [ ] IMAP support for any provider
- [ ] Send replies directly from InboxPilot (drafts currently copy-to-compose)
- [ ] Real-time inbox polling / push
- [ ] Calendar + scheduling links
- [ ] PWA + mobile install
- [ ] MCP server for use from other AI tools

---

## 🤝 Contributing

PRs welcome. Fork it, self-host it, make it yours.

## 📄 License

[MIT](./LICENSE) — free for personal and commercial use.
