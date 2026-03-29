import { createSlice } from "@reduxjs/toolkit";

const createChat = () => ({
  id: createChatId(),
  title: "New chat",
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const initialChat = createChat();

const initialState = {
  chats: [initialChat],
  activeChatId: initialChat.id,
  loading: false,
  error: null,
  selectedModel: "groq",
};

export const sendMessage = () => async (dispatch, getState) => {
  const { chats, activeChatId, selectedModel } = getState().chat;
  const activeChat = chats.find((chat) => chat.id === activeChatId);

  if (!activeChat || activeChat.messages.length === 0) {
    dispatch(setError("Start a conversation before sending it."));
    return;
  }

  const messagesSnapshot = activeChat.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  dispatch(startStreamingResponse());

  try {
    const payload = {
      model: selectedModel,
      messages: messagesSnapshot,
    };
    const response = await requestChatStream(payload);

    if (!response.ok) {
      const rawBody = await response.text();
      const data = rawBody ? JSON.parse(rawBody) : null;
      throw new Error(data?.error || "Unable to fetch AI response.");
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();
      dispatch(appendStreamingResponse(data?.message || ""));
      dispatch(finishStreamingResponse());
      return;
    }

    if (!response.body) {
      throw new Error("The chat server did not return a stream.");
    }

    const reader = response.body.getReader();
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
        const dataLine = event
          .split("\n")
          .find((line) => line.startsWith("data:"));

        if (!dataLine) {
          continue;
        }

        const payload = dataLine.slice(5).trim();

        if (!payload) {
          continue;
        }

        if (payload === "[DONE]") {
          dispatch(finishStreamingResponse());
          return;
        }

        const parsed = JSON.parse(payload);

        if (parsed.type === "delta" && parsed.delta) {
          dispatch(appendStreamingResponse(parsed.delta));
        }

        if (parsed.type === "error") {
          throw new Error(parsed.error || "Streaming failed.");
        }

        if (parsed.type === "done") {
          dispatch(finishStreamingResponse());
          return;
        }
      }
    }

    dispatch(finishStreamingResponse());
  } catch (error) {
    if (error instanceof SyntaxError) {
      dispatch(failStreamingResponse("The chat server returned an invalid response."));
      return;
    }

    if (error instanceof TypeError) {
      dispatch(
        failStreamingResponse("Unable to reach the chat server right now. Please try again."),
      );
      return;
    }

    dispatch(failStreamingResponse(error.message || "An error occurred."));
  }
};

async function requestChatStream(payload) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 404) {
    return response;
  }

  return fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addUserMessage: (state, action) => {
      const activeChat = getActiveChat(state);

      if (!activeChat) {
        return;
      }

      activeChat.messages.push({ role: "user", content: action.payload });
      activeChat.updatedAt = Date.now();

      // Use the first prompt as a lightweight session title for the history list.
      if (activeChat.title === "New chat") {
        activeChat.title = buildChatTitle(action.payload);
      }
    },
    startStreamingResponse: (state) => {
      const activeChat = getActiveChat(state);

      state.loading = true;
      state.error = null;

      if (!activeChat) {
        return;
      }

      activeChat.messages.push({ role: "assistant", content: "", isStreaming: true });
      activeChat.updatedAt = Date.now();
    },
    appendStreamingResponse: (state, action) => {
      const activeChat = getActiveChat(state);

      if (!activeChat) {
        return;
      }

      const streamingMessage = [...activeChat.messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.isStreaming);

      if (!streamingMessage) {
        return;
      }

      streamingMessage.content += action.payload;
      activeChat.updatedAt = Date.now();
    },
    finishStreamingResponse: (state) => {
      const activeChat = getActiveChat(state);

      state.loading = false;

      if (!activeChat) {
        return;
      }

      const streamingMessage = [...activeChat.messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.isStreaming);

      if (!streamingMessage) {
        return;
      }

      streamingMessage.isStreaming = false;
      streamingMessage.content = streamingMessage.content.trim() || "No response received.";
      activeChat.updatedAt = Date.now();
    },
    failStreamingResponse: (state, action) => {
      const activeChat = getActiveChat(state);

      state.loading = false;
      state.error = action.payload;

      if (!activeChat) {
        return;
      }

      activeChat.messages = activeChat.messages.filter((message) => !message.isStreaming);
      activeChat.updatedAt = Date.now();
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setModel: (state, action) => {
      state.selectedModel = action.payload;
    },
    createNewChat: (state) => {
      const newChat = createChat();
      state.chats.unshift(newChat);
      state.activeChatId = newChat.id;
      state.error = null;
      state.loading = false;
    },
    selectChat: (state, action) => {
      state.activeChatId = action.payload;
      state.error = null;
    },
  },
});

function getActiveChat(state) {
  return state.chats.find((chat) => chat.id === state.activeChatId);
}

function buildChatTitle(message) {
  const normalized = message.trim().replace(/\s+/g, " ");
  return normalized.slice(0, 32) || "New chat";
}

function createChatId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const {
  addUserMessage,
  appendStreamingResponse,
  clearError,
  createNewChat,
  failStreamingResponse,
  finishStreamingResponse,
  selectChat,
  setError,
  setModel,
  startStreamingResponse,
} = chatSlice.actions;

export default chatSlice.reducer;
