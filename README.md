# AI Chatbox Assignment

This repository is now split into proper `frontend/` and `backend/` applications.

## Structure

- `frontend/` contains the React + Redux chat UI
- `backend/` contains the Node.js API server that keeps provider API keys off the client

## Features

- Redux-powered chat state with multiple chat sessions and sidebar history
- Streaming AI responses in the UI
- Secure backend proxy for OpenAI, Groq, Gemini, and Claude
- Markdown rendering for headings, lists, tables, code blocks, and Mermaid diagrams
- Light and dark theme support using CSS variables from `:root`
- Collapsible sidebar and responsive layout
- Session-based restore on refresh

## Setup

1. Frontend dependencies are already present in `frontend/node_modules` in this workspace. If needed, run `npm install` inside `frontend`.
2. Create `backend/.env` from `backend/.env.example` and add your real API keys.
3. Start the backend:

```bash
npm run dev:backend
```

4. Start the frontend in a second terminal:

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:5173` and proxies `/api/chat` to the backend on `http://localhost:3001`.

## Notes

- OpenAI and Groq use native streaming through the backend.
- Gemini and Claude still stream through the UI endpoint, but their backend responses are finalized in a single chunk because this project keeps provider integration lightweight.
- Backend requests validate message count and message length before calling external providers.
