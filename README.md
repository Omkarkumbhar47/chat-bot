# AI Chatbox Assignment

This repository is now split into proper `frontend/` and `backend/` applications.

## Structure

- `frontend/` contains the React + Redux chat UI
- `backend/` contains the Node.js API server that keeps provider API keys off the client

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
