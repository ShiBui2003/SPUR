# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ShopEase AI Support Chat — a take-home assignment for Spur. A single-page chat UI backed by an Express API that calls Google Gemini to answer customer support questions for a fictional e-commerce store.

## Dev Commands

Run each in its own terminal from the repo root:

```bash
# Backend (port 3001)
cd server && npm run dev       # tsx watch — hot-reloads on save

# Frontend (port 5173)
cd client && npm run dev       # Vite dev server
```

Type-check without running:

```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

There are no tests and no linter configured.

## Environment Setup

**`server/.env`** (required, not committed):
```
GROQ_API_KEY=gsk_...    # get from console.groq.com
PORT=3001
CLIENT_URL=http://localhost:5173
```

**`client/.env`** (optional — falls back to `http://localhost:3001` if absent):
```
VITE_API_URL=http://localhost:3001
```

## Architecture

```
spur-chat/
├── server/src/
│   ├── index.ts       # Express bootstrap, CORS, middleware
│   ├── db.ts          # node:sqlite singleton, schema bootstrap (WAL mode)
│   ├── llm.ts         # Gemini service — generateReply(history, message)
│   └── routes/chat.ts # POST /chat/message · GET /chat/history/:sessionId
└── client/src/
    ├── App.tsx         # Entire UI — state, API calls, optimistic updates
    └── index.css       # All styles (no CSS framework)
```

### Request flow

`POST /chat/message` →
1. Resolve or create a `conversations` row keyed by `sessionId` (UUID, stored in `localStorage`)
2. Insert user message into `messages`
3. Fetch the last 10 messages as history
4. Call `generateReply(history, userMessage)` in `llm.ts`
5. Insert AI reply into `messages`
6. Return `{ reply, sessionId }`

### Key constraints

- **LLM provider** — `llm.ts` uses Groq `llama-3.3-70b-versatile`. Groq's SDK is OpenAI-compatible; history is a flat `{role, content}[]` array with a system message prepended.
- **`node:sqlite`** requires Node 22.5+. The DB file (`server/chat.db`) is created automatically on first run; no migration step needed.
- **Session identity** — `sessionId` is a plain UUID trusted from the client; no auth. The client stores it in `localStorage` under the key `shopease_session_id`.
- **LLM errors are non-fatal** — `chat.ts` catches all `generateReply` throws and substitutes a user-friendly fallback reply so the conversation round-trip always completes with HTTP 200.
- **History cap** — only the last 10 messages are passed to Gemini on each call (max 500 output tokens).

### Extending to a new channel (e.g. WhatsApp)

`generateReply` and the DB helpers are channel-agnostic. A new channel adapter only needs to call `generateReply(history, message)` and the same `db.prepare(...)` queries — no changes to `llm.ts` or `db.ts`.
