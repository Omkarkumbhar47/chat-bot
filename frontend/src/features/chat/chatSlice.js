import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { messages, selectedModel } = getState().chat;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
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
          "The chat server is unavailable. Start it with `npm run server` and try again.",
        );
      }

      return rejectWithValue(error.message || "An error occurred");
    }
  },
);

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    loading: false,
    error: null,
    selectedModel: "openai",
  },
  reducers: {
    addUserMessage: (state, action) => {
      state.messages.push({ role: "user", content: action.payload });
    },
    clearError: (state) => {
      state.error = null;
    },
    setModel: (state, action) => {
      state.selectedModel = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push({ role: "assistant", content: action.payload });
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addUserMessage, clearError, setModel } = chatSlice.actions;
export default chatSlice.reducer;
