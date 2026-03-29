import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "../features/chat/chatSlice";

const CHAT_STORAGE_KEY = "ai-chatbox-session-state";

const preloadedState = loadChatState();

export const store = configureStore({
  reducer: {
    chat: chatReducer,
  },
  preloadedState,
});

store.subscribe(() => {
  saveChatState(store.getState().chat);
});

function loadChatState() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const storedState = window.sessionStorage.getItem(CHAT_STORAGE_KEY);

    if (!storedState) {
      return undefined;
    }

    return {
      chat: JSON.parse(storedState),
    };
  } catch {
    return undefined;
  }
}

function saveChatState(chatState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatState));
  } catch {
    // Ignore storage errors so chat still works in restricted browsing modes.
  }
}
