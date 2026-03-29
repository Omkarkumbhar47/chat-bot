import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const PORT = Number(process.env.PORT || 3001);

loadEnvFile(ENV_PATH);

const MODEL_CONFIG = {
  openai: {
    envKey: "OPENAI_API_KEY",
    request: (messages) => ({
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
        }),
      },
      parse: (data) => data.choices?.[0]?.message?.content,
    }),
  },
  groq: {
    envKey: "GROQ_API_KEY",
    request: (messages) => ({
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
        }),
      },
      parse: (data) => data.choices?.[0]?.message?.content,
    }),
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    request: (messages) => ({
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
      parse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
    }),
  },
  claude: {
    envKey: "CLAUDE_API_KEY",
    request: (messages) => ({
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
      parse: (data) => data.content?.[0]?.text,
    }),
  },
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    try {
      const body = await readJsonBody(request);
      const model = body?.model;
      const messages = body?.messages;

      if (!MODEL_CONFIG[model]) {
        sendJson(response, 400, { error: "Unsupported model selected." });
        return;
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        sendJson(response, 400, { error: "At least one message is required." });
        return;
      }

      const { envKey, request: buildRequest } = MODEL_CONFIG[model];
      const apiKey = process.env[envKey];

      if (!apiKey) {
        sendJson(response, 500, { error: `Missing ${envKey} in server environment.` });
        return;
      }

      const config = buildRequest(messages);
      const upstreamResponse = await fetch(config.url, config.options);
      const data = await upstreamResponse.json();

      if (!upstreamResponse.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.error ||
          data?.message ||
          "Provider request failed.";

        sendJson(response, upstreamResponse.status, { error: errorMessage });
        return;
      }

      const message = config.parse(data);

      if (!message) {
        sendJson(response, 502, { error: "Provider returned an empty response." });
        return;
      }

      sendJson(response, 200, { message });
      return;
    } catch (error) {
      sendJson(response, 500, { error: error.message || "Server error." });
      return;
    }
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Chat API server listening on http://localhost:${PORT}`);
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

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
