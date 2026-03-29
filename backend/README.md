# Backend

Small Node.js API server that securely forwards chat requests to OpenAI, Gemini, Groq, or Claude.

## Features

- Keeps provider API keys on the server
- Validates message count and message length before forwarding requests
- Streams OpenAI and Groq responses to the frontend
- Normalizes provider responses into one frontend-friendly format

## Run

```bash
npm run dev
```

The server listens on `http://localhost:3001` by default and expects API keys in `backend/.env`.
