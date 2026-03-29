# Frontend

React + Redux chat client for the AI Chatbox assignment.

## Features

- Multiple AI model selection
- Redux Toolkit state for chat sessions, loading, and errors
- Streaming message rendering in the chat window
- Markdown, table, code block, and Mermaid rendering
- Collapsible sidebar with session history
- Light and dark themes driven by CSS variables

## Run

```bash
npm run dev
```

Create `frontend/.env` from `frontend/.env.example` if you want an explicit backend URL:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

If `VITE_API_BASE_URL` is not set, local development still works through the Vite `/api` proxy as long as the backend is running on `http://localhost:3001`.

For Vercel deployment, set:

```bash
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```
