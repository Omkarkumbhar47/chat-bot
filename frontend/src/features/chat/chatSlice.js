import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

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

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { chats, activeChatId, selectedModel } = getState().chat;
      const activeChat = chats.find((chat) => chat.id === activeChatId);

      if (!activeChat || activeChat.messages.length === 0) {
        throw new Error("Start a conversation before sending it.");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // The backend keeps provider API keys off the client and normalizes responses.
        body: JSON.stringify({
          model: selectedModel,
          messages: activeChat.messages,
        }),
      });

      const rawBody = await response.text();
      const data = rawBody ? JSON.parse(rawBody) : null;

      if (!response.ok) {
        throw new Error(data?.error || "Unable to fetch AI response");
      }

      return data?.message || "";
    } catch (error) {
      if (error instanceof SyntaxError) {
        return rejectWithValue("The chat server returned an invalid response.");
      }

      if (error instanceof TypeError) {
        return rejectWithValue(
          "The chat server is unavailable. Start it with `npm run dev:backend` and try again.",
        );
      }

      return rejectWithValue(error.message || "An error occurred");
    }
  },
);

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
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const activeChat = getActiveChat(state);

        state.loading = false;

        if (!activeChat) {
          return;
        }

        activeChat.messages.push({ role: "assistant", content: action.payload });
        activeChat.updatedAt = Date.now();
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
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

export const { addUserMessage, clearError, createNewChat, selectChat, setModel } =
  chatSlice.actions;

export default chatSlice.reducer;
