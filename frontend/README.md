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

The Vite dev server proxies `/api` requests to `http://localhost:3001`, so the backend must also be running.
