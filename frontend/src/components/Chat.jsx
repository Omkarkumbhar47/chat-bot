import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addUserMessage,
  clearError,
  createNewChat,
  selectChat,
  sendMessage,
  setModel,
} from "../features/chat/chatSlice";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";

const models = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "claude", label: "Claude" },
];
const emptyMessages = [];

const Chat = () => {
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("dark");
  const messagesEndRef = useRef(null);
  const dispatch = useDispatch();
  const { activeChatId, chats, error, loading, selectedModel } = useSelector(
    (state) => state.chat,
  );

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const messages = activeChat?.messages ?? emptyMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error, activeChatId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = "dark";
    };
  }, [theme]);

  const handleSend = () => {
    if (!input.trim() || loading) {
      return;
    }

    dispatch(addUserMessage(input));
    dispatch(sendMessage());
    setInput("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <aside className="hidden w-80 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 lg:flex">
        <div className="border-b border-[hsl(var(--border))] p-4">
          <Button
            onClick={() => dispatch(createNewChat())}
            className="w-full justify-start rounded-2xl py-3"
          >
            + New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Chat history
          </div>
          <div className="space-y-2">
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <button
                  key={chat.id}
                  onClick={() => dispatch(selectChat(chat.id))}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-3 text-left transition",
                    isActive
                      ? "border-[hsl(var(--primary))]/30 bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]",
                  )}
                >
                  <div className="truncate text-sm font-medium">{chat.title}</div>
                  <div className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {chat.messages.length === 0
                      ? "Empty conversation"
                      : `${chat.messages.length} messages`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => dispatch(createNewChat())}
                variant="outline"
                className="lg:hidden"
              >
                New Chat
              </Button>
              <div>
                <h1 className="text-xl font-bold">AI Chatbox</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  New chat and chat history now live in the left sidebar.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
              </Select>
              <Select value={selectedModel} onChange={(e) => dispatch(setModel(e.target.value))}>
                {models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
          <Card className="flex-1 overflow-hidden border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 shadow-2xl shadow-black/20">
            <CardContent className="flex h-full flex-col space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 p-5 text-sm text-[hsl(var(--muted-foreground))]">
                Start a conversation, then use the left sidebar to return to this chat later.
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={`${activeChatId}-${index}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg sm:max-w-xl ${
                    msg.role === "user"
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-[hsl(var(--secondary))] px-4 py-3 text-[hsl(var(--secondary-foreground))] shadow-lg sm:max-w-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--primary))]"></div>
                    <span>AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="max-w-2xl rounded-2xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-sm text-[hsl(var(--destructive-foreground))]">
                  Error: {error}
                  <button
                    onClick={() => dispatch(clearError())}
                    className="ml-2 underline underline-offset-2"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
            </CardContent>
          </Card>
        </div>

        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="resize-none"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-2xl px-5 py-3"
            >
              Send
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Chat;
