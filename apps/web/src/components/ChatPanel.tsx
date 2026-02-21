"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";

const QUICK_PROMPTS = [
  "What markets are available?",
  "Quote a 3-leg parlay with legs 1, 5, 12 for $50",
  "How healthy is the vault?",
  "What are the protocol fees?",
];

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } =
    useChat({ api: "/api/chat" });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendPrompt = (prompt: string) => {
    append({ role: "user", content: prompt });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple shadow-lg shadow-brand-purple/30 transition-transform hover:scale-110"
        aria-label="Open AI Chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-brand-purple/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-sm font-semibold text-white">ParlayVoo AI</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 transition-colors hover:text-white"
          aria-label="Close chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Ask me about markets, quotes, risk, or protocol health.
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendPrompt(p)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-brand-purple text-white"
                  : "bg-white/5 text-gray-200"
              }`}
            >
              {/* Render tool invocations inline */}
              {m.toolInvocations?.map((ti, i) => {
                if (ti.state === "result") {
                  return (
                    <details key={i} className="mt-2 text-xs">
                      <summary className="cursor-pointer text-brand-purple-1">
                        Tool: {ti.toolName}
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] text-gray-400">
                        {JSON.stringify(ti.result, null, 2)}
                      </pre>
                    </details>
                  );
                }
                return (
                  <div key={i} className="mt-1 text-xs text-gray-500 italic">
                    Calling {ti.toolName}...
                  </div>
                );
              })}
              {m.content && (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:0.2s]">.</span>
                <span className="animate-bounce [animation-delay:0.4s]">.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 bg-surface-2 px-3 py-3"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about markets, quotes, risk..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-purple"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
