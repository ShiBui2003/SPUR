# ShopEase AI Support Chat

A mini AI-powered customer support chat agent for **ShopEase**, a fictional e-commerce store. Built as a take-home assignment for Spur.

**Stack:** Node.js + TypeScript · React + Vite · SQLite (Node's built-in `node:sqlite`) · Meta Llama 3.3 70B via Groq

---

## Local Setup

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/) (free tier available)

### 1. Clone & install

```bash
git clone <your-repo-url>
cd spur-chat

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Configure environment variables

**Server** — create `server/.env` from the example:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```
GROQ_API_KEY=your_key_here
PORT=3001
CLIENT_URL=http://localhost:5173
```

**Client** — create `client/.env` from the example:

```bash
cp client/.env.example client/.env
```

The default `VITE_API_URL=http://localhost:3001` works as-is if the server runs on port 3001.

### 3. Run

Open two terminals:

```bash
# Terminal 1 — Backend (port 3001)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev
```

**The SQLite database (`server/chat.db`) is created automatically on first run. No migrations or seed steps needed.**

Open [http://localhost:5173](http://localhost:5173).

---

## Architecture Overview

```
spur-chat/
├── server/
│   └── src/
│       ├── index.ts          # Express app, middleware wiring
│       ├── db.ts             # SQLite singleton + schema bootstrap
│       ├── llm.ts            # Gemini LLM service — generateReply()
│       └── routes/
│           └── chat.ts       # POST /chat/message · GET /chat/history/:id
└── client/
    └── src/
        ├── App.tsx           # Chat UI, state, API calls
        └── index.css         # Styles (no CSS framework)
```

### Backend layers

| Layer | File | Responsibility |
|---|---|---|
| HTTP / Routing | `routes/chat.ts` | Input validation, request/response shaping |
| LLM Service | `llm.ts` | All Gemini API interaction, history formatting |
| Persistence | `db.ts` | SQLite connection, schema, query execution |
| App bootstrap | `index.ts` | Express setup, CORS, middleware, listen |

**Extensibility:** Adding a new channel (WhatsApp, Instagram) means creating a new route/adapter that calls the same `generateReply(history, message)` service and the same DB helpers — zero changes to LLM or persistence logic.

### Data model

```sql
conversations (id TEXT PK, createdAt TEXT)
messages      (id TEXT PK, conversationId TEXT FK, sender TEXT, text TEXT, timestamp TEXT)
```

`sessionId` in the API maps 1:1 to `conversations.id`. Stored in `localStorage` on the client.

---

## LLM Notes

**Provider:** Groq (`llama-3.3-70b-versatile` — Meta Llama 3.3 70B)

**Prompt approach:**
- System message bakes in store knowledge (shipping policy, returns, support hours) and agent persona.
- The last **10 messages** of the conversation are passed as history on every call, giving the model contextual memory without unbounded cost.
- Max output is capped at **500 tokens** per reply.

**Error classes handled:**
| Error | User-facing message |
|---|---|
| Missing/invalid API key | "agent isn't configured right now…" |
| Rate limit (429) | "too many requests, try again…" |
| Any other LLM failure | "having trouble connecting…" |

---

### Why `node:sqlite` instead of `better-sqlite3`

Node 22.5+ ships a built-in `node:sqlite` module with a synchronous API nearly identical to `better-sqlite3`. Using it means zero native compilation, no `node-gyp`, and no prebuilt binary compatibility concerns — the database just works out of the box on any Node 22+ platform.

### Why Groq + Llama 3.3 over Google Gemini

Groq's API is OpenAI-compatible, making the integration straightforward. Llama 3.3 70B is a top-tier open-source model that handles support conversations well. Groq's free tier requires no billing setup, unblocking local development immediately.

---

## Trade-offs & If I Had More Time

- **Streaming:** Gemini supports SSE streaming. Adding it would make replies feel instant rather than waiting for the full response. Skipped for simplicity.
- **Auth:** `sessionId` is trusted as-is from `localStorage`. In production this would be a signed JWT or a server-side session cookie.
- **Redis caching:** Frequently asked questions (shipping, returns) could be answered from a cache, cutting LLM calls by ~50% for a typical store.
- **Rate limiting:** No per-IP rate limiting. `express-rate-limit` would be a quick add.
- **Docker Compose:** A `docker-compose.yml` would make local setup a single command — skipped since SQLite needs no database container.
- **Multi-channel adapter pattern:** The LLM service is already channel-agnostic. A WhatsApp adapter would be ~50 lines: receive webhook → call `generateReply` → send reply via WhatsApp API.
