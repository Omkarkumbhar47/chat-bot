# Frontend

React + Redux chat client for the AI Chatbox assignment.

## Features

- Chat with multiple AI models
- Model selection dropdown (OpenAI, Gemini, Groq, Claude)
- Redux state management for messages, loading, and errors
- Full conversation history is sent with each request
- Responsive UI with loading and error states
- API keys stay on the server instead of the browser bundle

## Run

```bash
npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:3001`, so the backend must also be running.

## Features

- Responsive chat interface
- Redux Toolkit state for messages, loading, error, and model selection
- Loading/error feedback
- Full conversation history sent through the backend
