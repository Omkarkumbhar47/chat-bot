import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addUserMessage,
  clearError,
  sendMessage,
  setModel,
} from "../features/chat/chatSlice";

const Chat = () => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const dispatch = useDispatch();
  const { messages, loading, error, selectedModel } = useSelector((state) => state.chat);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  const handleSend = () => {
    if (input.trim()) {
      dispatch(addUserMessage(input));
      dispatch(sendMessage());
      setInput("");
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleModelChange = (model) => {
    dispatch(setModel(model));
  };

  const models = [
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Gemini" },
    { value: "groq", label: "Groq" },
    { value: "claude", label: "Claude" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">AI Chatbox</h1>
            <p className="text-sm text-slate-300">
              Redux-powered chat with secure server-side AI requests.
            </p>
          </div>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
          >
            {models.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/40">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/80 p-5 text-sm text-slate-300">
              Start the conversation with a prompt. The full chat history will appear on the left.
            </div>
          )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className="flex justify-start"
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg sm:max-w-xl ${
                msg.role === "user"
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-slate-800 px-4 py-3 text-slate-100 shadow-lg sm:max-w-xl">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-400"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <div className="max-w-2xl rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
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
        </div>
      </div>
      <div className="border-t border-white/10 bg-slate-900/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
