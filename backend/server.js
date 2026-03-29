import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const PORT = Number(process.env.PORT || 3001);
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 8000;
const CONFIGURED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

loadEnvFile(ENV_PATH);

// Each provider has slightly different request/response shapes, so the server
// adapts them into one consistent API for the frontend.
const MODEL_CONFIG = {
  openai: {
    envKey: "OPENAI_API_KEY",
    buildRequest: (messages, { stream = false } = {}) => ({
      url: "https://api.openai.com/v1/chat/completions",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          stream,
        }),
      },
    }),
    parse: (data) => data.choices?.[0]?.message?.content,
    parseStreamLine: (line) => {
      const data = JSON.parse(line);
      return data.choices?.[0]?.delta?.content || "";
    },
    supportsStreaming: true,
  },
  groq: {
    envKey: "GROQ_API_KEY",
    buildRequest: (messages, { stream = false } = {}) => ({
      url: "https://api.groq.com/openai/v1/chat/completions",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          stream,
        }),
      },
    }),
    parse: (data) => data.choices?.[0]?.message?.content,
    parseStreamLine: (line) => {
      const data = JSON.parse(line);
      return data.choices?.[0]?.delta?.content || "";
    },
    supportsStreaming: true,
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    buildRequest: (messages) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
        }),
      },
    }),
    parse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
    supportsStreaming: false,
  },
  claude: {
    envKey: "CLAUDE_API_KEY",
    buildRequest: (messages) => ({
      url: "https://api.anthropic.com/v1/messages",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1024,
          messages: messages.map(({ role, content }) => ({
            role: role === "assistant" ? "assistant" : "user",
            content,
          })),
        }),
      },
    }),
    parse: (data) => data.content?.[0]?.text,
    supportsStreaming: false,
  },
};

const server = createServer(async (request, response) => {
  const requestOrigin = request.headers.origin;

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(requestOrigin));
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    await handleChatRequest(request, response, false);
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat/stream") {
    await handleChatRequest(request, response, true);
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Chat API server listening on http://localhost:${PORT}`);
});

async function handleChatRequest(request, response, shouldStream) {
  try {
    const requestOrigin = request.headers.origin;
    const body = await readJsonBody(request);
    const model = body?.model;
    const rawMessages = body?.messages;

    if (!MODEL_CONFIG[model]) {
      sendJson(response, 400, { error: "Unsupported model selected." }, requestOrigin);
      return;
    }

    const messages = validateMessages(rawMessages);
    const config = MODEL_CONFIG[model];
    const apiKey = process.env[config.envKey];

    if (!apiKey) {
      sendJson(
        response,
        500,
        { error: `Missing ${config.envKey} in server environment.` },
        requestOrigin,
      );
      return;
    }

    if (shouldStream) {
      await streamProviderResponse(response, config, messages, requestOrigin);
      return;
    }

    const upstreamConfig = config.buildRequest(messages);
    const upstreamResponse = await fetch(upstreamConfig.url, upstreamConfig.options);
    const data = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      sendJson(response, upstreamResponse.status, {
        error: extractProviderError(data),
      }, requestOrigin);
      return;
    }

    const message = config.parse(data);

    if (!message) {
      sendJson(response, 502, { error: "Provider returned an empty response." }, requestOrigin);
      return;
    }

    sendJson(response, 200, { message }, requestOrigin);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error." }, request.headers.origin);
  }
}

async function streamProviderResponse(response, config, messages, requestOrigin) {
  if (!config.supportsStreaming) {
    const upstreamConfig = config.buildRequest(messages);
    const upstreamResponse = await fetch(upstreamConfig.url, upstreamConfig.options);
    const data = await upstreamResponse.json();

    if (!upstreamResponse.ok) {
      sendSse(response, {
        type: "error",
        error: extractProviderError(data),
      }, requestOrigin);
      response.end();
      return;
    }

    const message = config.parse(data);

    if (message) {
      sendSse(response, { type: "delta", delta: message }, requestOrigin);
    }

    sendSse(response, { type: "done" }, requestOrigin);
    response.end();
    return;
  }

  response.writeHead(200, {
    ...corsHeaders(requestOrigin),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const upstreamConfig = config.buildRequest(messages, { stream: true });
  const upstreamResponse = await fetch(upstreamConfig.url, upstreamConfig.options);

  if (!upstreamResponse.ok) {
    const data = await upstreamResponse.json();
    sendSse(response, {
      type: "error",
      error: extractProviderError(data),
    }, requestOrigin);
    response.end();
    return;
  }

  if (!upstreamResponse.body) {
    sendSse(response, {
      type: "error",
      error: "Streaming response body was unavailable.",
    }, requestOrigin);
    response.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);

      for (const line of dataLines) {
        if (line === "[DONE]") {
          sendSse(response, { type: "done" }, requestOrigin);
          response.end();
          return;
        }

        try {
          const delta = config.parseStreamLine(line);

          if (delta) {
            sendSse(response, { type: "delta", delta }, requestOrigin);
          }
        } catch {
          // Ignore malformed stream lines and continue consuming the provider stream.
        }
      }
    }
  }

  sendSse(response, { type: "done" }, requestOrigin);
  response.end();
}

function validateMessages(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new Error("At least one message is required.");
  }

  if (rawMessages.length > MAX_MESSAGES) {
    throw new Error(`Too many messages. Limit the request to ${MAX_MESSAGES} items.`);
  }

  return rawMessages.map((message, index) => {
    const role = message?.role;
    const content = sanitizeMessageContent(message?.content);

    if (!["user", "assistant", "system"].includes(role)) {
      throw new Error(`Message ${index + 1} has an unsupported role.`);
    }

    if (!content) {
      throw new Error(`Message ${index + 1} must include text content.`);
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message ${index + 1} is too long. Keep each message under ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    return {
      role,
      content,
    };
  });
}

function sanitizeMessageContent(content) {
  return String(content || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function extractProviderError(data) {
  return data?.error?.message || data?.error || data?.message || "Provider request failed.";
}

function corsHeaders(requestOrigin) {
  const allowedOrigin = getAllowedOrigin(requestOrigin);

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function sendJson(response, statusCode, payload, requestOrigin) {
  response.writeHead(statusCode, {
    ...corsHeaders(requestOrigin),
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function sendSse(response, payload, requestOrigin) {
  if (!response.headersSent) {
    response.writeHead(200, {
      ...corsHeaders(requestOrigin),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
  }

  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function getAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return "*";
  }

  if (
    requestOrigin.startsWith("http://localhost:") ||
    requestOrigin.startsWith("http://127.0.0.1:") ||
    requestOrigin.endsWith(".vercel.app") ||
    CONFIGURED_ORIGINS.includes(requestOrigin)
  ) {
    return requestOrigin;
  }

  return CONFIGURED_ORIGINS[0] || "*";
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  // Lightweight .env loader keeps the backend dependency-free for the assignment.
  const fileContents = readFileSync(filePath, "utf8");

  for (const line of fileContents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;
    });

    request.on("end", () => {
      try {
        resolveBody(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        rejectBody(new Error("Invalid JSON body."));
      }
    });

    request.on("error", () => {
      rejectBody(new Error("Unable to read request body."));
    });
  });
}
