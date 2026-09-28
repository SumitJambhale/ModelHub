# ModelHub

Unified multi-model AI chat hub that acts as an **AI harness** around GPT, Claude, Gemini, and Grok — with document grounding, web search, and email assistance.

> **Harness (conceptual):** the scaffolding around LLMs — routing, context injection, tool-like capabilities, session memory, and fault tolerance — not a third-party platform.

## Overview

ModelHub is a React + Express app that:

- Routes chat requests across multiple AI providers through one interface
- Injects document and web-search context into prompts before calling a model
- Adds practical capabilities (docs, search, Gmail draft) the base model does not have alone
- Persists conversation state and recovers gracefully from failures

```text
User
  → Harness (ModelHub UI + services)
       → optional tools (docs / search / email)
       → context + history packing
       → provider router
       → LLM APIs (or backend relay)
  ← reply / sources / errors / retry
```

## Features (Harness Concepts → Code)

| Harness concept | What ModelHub does | Primary location |
|---|---|---|
| Model abstraction / routing | One `executeAiCompletion` API over GPT / Claude / Gemini / Grok | `src/services/aiProviders.ts` |
| Context injection | Document text + web search results → system prompt | `aiProviders.ts`, `src/App.tsx` |
| Tool-like capabilities | Attach docs, Tavily search, Gmail read + AI draft | `documentParser.ts`, `webSearch.ts`, `EmailDrawer.tsx` |
| Memory / session state | Chat history in `localStorage` | `src/App.tsx` |
| Orchestration pipeline | Key check → optional search → model call → reply/error | `App.tsx` (`handleSendMessage`) |
| Resilience | Search failure continues; CORS → relay; retry last message | `App.tsx`, `aiProviders.ts` |
| Config / secrets surface | Per-provider keys, model choice, backend URL, key test | `SettingsModal.tsx`, `testApiKeyConnection` |

### 1. Unified model interface

One call site; provider-specific APIs stay behind it.

```ts
// src/services/aiProviders.ts
export async function executeAiCompletion(options: SendMessageOptions): Promise<string> {
  // routes to claude | gpt | gemini | grok
}
```

Supported providers (see `PROVIDERS` / `PROVIDER_MODELS` in `aiProviders.ts`):

- **GPT** (OpenAI)
- **Claude** (Anthropic)
- **Gemini** (Google)
- **Grok** (xAI)

### 2. Context assembly (grounding)

Documents and search results are packed into a system prompt before the model runs.

```ts
// src/services/aiProviders.ts
if (documentContext?.text) {
  systemPromptChunks.push(`The user has shared a document titled '...' ...`);
}
if (searchResults?.length) {
  systemPromptChunks.push(`Web search results for reference:\n...`);
}
```

### 3. Request orchestration loop

Control flow lives in the harness, not in the model:

1. Validate API key
2. Optionally run Tavily web search (warn and continue on failure)
3. Append user message
4. Call `executeAiCompletion` with conversation + document + search context
5. Append assistant reply or error bubble

See `handleSendMessage` in `src/App.tsx`.

### 4. Tool-adjacent capabilities

Not formal tool-calling JSON — same idea: capabilities bolted onto the model.

| Capability | Behavior | Files |
|---|---|---|
| Document grounding | Parse `.pdf`, `.docx`, `.txt`, `.md`; truncate ~60k chars | `src/utils/documentParser.ts` |
| Web search | Tavily search (max 5 results), optional toggle | `src/services/webSearch.ts` |
| Email assistant | Gmail IMAP fetch + AI draft reply | `EmailDrawer.tsx`, `/api/email/*` |

### 5. Session memory

Conversation is loaded/saved under `modelhub_conversation` in `localStorage` (`src/App.tsx`).

### 6. Fault tolerance

- Missing key → prompt to open Settings
- Web search fails → still call the model
- Browser/CORS issues → backend relay (`/api/chat`)
- Model call fails → error bubble + retry last user message (`handleRetryLast`)

## Project structure

```text
ModelHub/
├── src/
│   ├── App.tsx                 # Orchestration loop, state, drawers
│   ├── components/
│   │   ├── TopBar.tsx          # Provider / model selector
│   │   ├── Composer.tsx        # Input, doc attach, web search toggle
│   │   ├── MessageList.tsx     # Chat UI, retry, example prompts
│   │   ├── SettingsModal.tsx   # API keys, models, key test
│   │   └── EmailDrawer.tsx     # Gmail read + draft
│   ├── services/
│   │   ├── aiProviders.ts      # Multi-model router + key test
│   │   ├── webSearch.ts        # Tavily grounding
│   │   └── emailService.ts     # Email client → backend
│   └── utils/
│       └── documentParser.ts   # PDF / DOCX / TXT / MD extraction
├── server/
│   └── server.js               # Relay + IMAP email APIs
├── server.ts                   # Dev/prod server (Vite + relay)
└── package.json
```

## Getting started

### Prerequisites

- Node.js 18+
- API keys for the providers you want to use (OpenAI, Anthropic, Google, xAI)
- Optional: [Tavily](https://tavily.com) key for web search
- Optional: Gmail address + App Password for email assistant

### Install & run

```bash
npm install
npm run dev
```

Build / production-style start:

```bash
npm run build
npm start
```

Open the app, go to **Settings**, add provider keys (and optional Tavily / email / backend URL), then chat.

## Configuration (Settings)

Stored in browser `localStorage` (examples):

| Key | Purpose |
|---|---|
| `modelhub_openai_key` / `modelhub_anthropic_key` / `modelhub_google_key` / `modelhub_xai_key` | Provider API keys |
| `modelhub_model_<provider>` | Selected model per provider |
| `modelhub_tavily_key` | Web search |
| `modelhub_email_address` / `modelhub_email_app_password` | Gmail IMAP |
| `modelhub_backend_url` | Backend relay base URL |
| `modelhub_conversation` | Saved chat history |

Gemini can also fall back to `VITE_GEMINI_API_KEY` when no stored key is set.

## Backend relay

Express endpoints used by the harness for CORS-sensitive or server-side work:

| Endpoint | Role |
|---|---|
| `GET /api/health` | Health check |
| `POST /api/chat` | Chat relay (Anthropic / OpenAI / xAI; Gemini via main `server.ts`) |
| `POST /api/test-key` | Validate API keys + latency |
| `POST /api/email/fetch` | Recent Gmail messages (IMAP) |
| `POST /api/email/read` | Full message body by UID |

## Mental model

**Harness = everything around the models** — routing, context packing, tool-like features, persistence, and recovery — mainly in `App.tsx` and `aiProviders.ts`, with capabilities in `documentParser`, `webSearch`, and `EmailDrawer`.

## License

Apache-2.0 (see file headers in source).
