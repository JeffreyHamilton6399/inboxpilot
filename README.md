# InboxPilot

**The open-source AI executive assistant for your inbox.** A free, self-hostable alternative to [Fyxer](https://fyxer.com).

InboxPilot auto-organizes your inbox, drafts tone-matched replies in your voice, and lets you chat with your email — just like Fyxer. Except it's **free**, **open source (MIT)**, and **runs on your own account**. Your inbox context never touches a third-party SaaS.

> Status: alpha — the demo runs on sample inbox data. Real Gmail/Outlook sync is on the roadmap.

---

## ✨ Features

- **AI Inbox Organizer** — every incoming email auto-sorted into 8 smart categories (To Respond, FYI, Awaiting Reply, …). Fully overridable, and you can re-run the AI on any email.
- **Tone-matched drafts** — reply drafts written in *your* voice, trained on the phrases you actually use. You review, you hit send — the AI never sends for you.
- **Chat with your inbox** — ask *"who haven't I replied to?"* or *"summarize Priya's candidacy"* in plain English. Streaming answers grounded in your real emails.
- **Meeting summaries** — drop in a transcript and get a tight summary plus concrete action items. **No bot joins your call** (a feature Fyxer can't offer).
- **Private by design** — self-host on your own Vercel account with your own API key.
- **Bring your own model** — plug in [Grok](https://x.ai) out of the box, or run on the built-in fallback with **zero configuration**.

### InboxPilot vs Fyxer

| Feature | Fyxer | InboxPilot |
| --- | --- | --- |
| Price | $22–50 / user / month | **Free, forever** |
| Open source | ❌ | ✅ MIT |
| Self-hostable | ❌ | ✅ |
| Your own API key | ❌ | ✅ |
| Customizable categories | Fixed 8 | Fully editable |
| AI draft replies | ✅ | ✅ |
| Inbox chat / RAG | ✅ | ✅ |
| Meeting summaries | Bot joins call | **Bot-free** |
| Free trial | 7 days, card required | No trial needed |
| Privacy | Third-party SaaS | Runs on your account |

---

## 🚀 Quick start

```bash
git clone https://github.com/<you>/inboxpilot.git
cd inboxpilot
bun install            # or: npm install
cp .env.example .env.local   # optional: add GROK_API_KEY to use Grok
bun run dev
```

Open http://localhost:3000. Without a Grok key, the app uses the built-in AI fallback — everything works out of the box.

---

## ☁️ Deploy to Vercel (free)

1. Push this repo to GitHub (private is fine).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. (Optional) Add an environment variable:
   - `GROK_API_KEY` — your xAI key from [x.ai](https://x.ai). If omitted, the built-in fallback is used.
4. Deploy. That's it — Vercel auto-detects Next.js.

> 💡 No database required. The demo persists state in your browser via `localStorage`. The app is fully serverless-friendly.

---

## 🔧 Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `GROK_API_KEY` | No | xAI Grok API key. If set, Grok powers all AI features. If empty, the built-in model is used. |
| `GROK_MODEL` | No | Grok model id (default `grok-2-latest`). |
| `DATABASE_URL` | No | SQLite URL, only if you extend the app with Prisma. |

---

## 🧱 Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **State**: Zustand (persisted to localStorage) + TanStack Query
- **AI**: xAI Grok (OpenAI-compatible) with a z-ai-web-dev-sdk fallback
- **Icons**: Lucide · **Animation**: Framer Motion · **Themes**: next-themes

---

## 🗺️ Roadmap

- [ ] Real Gmail & Outlook sync (OAuth)
- [ ] IMAP support (a gap Fyxer leaves open)
- [ ] Live calendar / scheduling links
- [ ] Server-side persistence (Postgres / Vercel KV)
- [ ] PWA + mobile install
- [ ] Slack / Teams integrations
- [ ] MCP server for use from other AI tools

---

## 🤝 Contributing

PRs welcome. This is a community project built as a free alternative to paid AI-inbox SaaS. Fork it, self-host it, make it yours.

## 📄 License

[MIT](./LICENSE) — free for personal and commercial use.
