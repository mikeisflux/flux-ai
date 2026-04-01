import React, { useState, useEffect, useRef, useCallback } from "react";
import { api, type Session, type Message, type ChatEvent } from "../api";
import { MessageRenderer } from "./MessageRenderer";
import { FileUpload } from "./FileUpload";

interface Props {
  session: Session | null;
  models: string[];
  onSessionUpdate: (session: Session) => void;
  onToggleSidebar: () => void;
}

interface StreamingState {
  content: string;
  toolActivity: { name: string; status: "running" | "done"; result?: string }[];
  isStreaming: boolean;
}

export function ChatPanel({ session, models, onSessionUpdate, onToggleSidebar }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<StreamingState>({
    content: "", toolActivity: [], isStreaming: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!session) { setMessages([]); return; }
    api.sessions.messages(session.id).then(setMessages).catch(() => {});
  }, [session?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.content]);

  const sendMessage = useCallback(async () => {
    if (!session || !input.trim() || streaming.isStreaming) return;

    const text = input.trim();
    setInput("");

    // Optimistic user message
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      session_id: session.id,
      role: "user",
      content: text,
      tool_calls: null,
      tool_results: null,
      created_at: Date.now() / 1000,
    };
    setMessages((prev) => [...prev, optimistic]);

    setStreaming({ content: "", toolActivity: [], isStreaming: true });

    abortRef.current = new AbortController();

    try {
      await api.chat(session.id, text, (event: ChatEvent) => {
        if (event.type === "token") {
          setStreaming((prev) => ({ ...prev, content: prev.content + event.content }));
        } else if (event.type === "tool_start") {
          setStreaming((prev) => ({
            ...prev,
            toolActivity: event.tools.map((name) => ({ name, status: "running" as const })),
          }));
        } else if (event.type === "tool_result") {
          setStreaming((prev) => ({
            ...prev,
            toolActivity: prev.toolActivity.map((t) =>
              t.name === event.name ? { ...t, status: "done", result: event.result } : t
            ),
          }));
        } else if (event.type === "done") {
          setStreaming({ content: "", toolActivity: [], isStreaming: false });
          // Reload messages from server
          api.sessions.messages(session.id).then(setMessages).catch(() => {});
          // Auto-title after first exchange
          if (messages.length === 0) {
            const title = text.slice(0, 50) + (text.length > 50 ? "…" : "");
            api.sessions.setTitle(session.id, title).then(() => {
              api.sessions.get(session.id).then(onSessionUpdate).catch(() => {});
            }).catch(() => {});
          }
        } else if (event.type === "error") {
          setStreaming({ content: "", toolActivity: [], isStreaming: false });
          console.error("Chat error:", event.message);
        }
      }, abortRef.current.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
      setStreaming({ content: "", toolActivity: [], isStreaming: false });
    }
  }, [session, input, streaming.isStreaming, messages.length, onSessionUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = (info: { name: string; workspace_path: string }) => {
    setInput((prev) => prev + `\n[File uploaded: ${info.name} → workspace/${info.workspace_path}]`);
  };

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
        <div className="text-6xl">⚡</div>
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-300">Welcome to Flux AI</p>
          <p className="text-sm mt-1">Create a new session to get started</p>
        </div>
        {models.length === 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-3 text-sm text-yellow-300 max-w-sm text-center">
            ⚠️ Ollama not detected. Install Ollama and pull a model to use Flux AI locally.
            <br /><code className="text-xs mt-1 block opacity-80">ollama pull llama3.2</code>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/30">
        <button onClick={onToggleSidebar} className="btn-ghost p-1.5 rounded-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <h1 className="text-sm font-medium text-gray-200 flex-1 truncate">{session.title}</h1>

        {/* Model selector */}
        <select
          value={session.model}
          onChange={(e) => {
            api.sessions.setModel(session.id, e.target.value).then(() => {
              api.sessions.get(session.id).then(onSessionUpdate).catch(() => {});
            }).catch(() => {});
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300
                     focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
          {!models.includes(session.model) && <option value={session.model}>{session.model}</option>}
        </select>

        {/* Clear */}
        <button
          onClick={() => {
            if (confirm("Clear all messages?")) {
              api.sessions.clearMessages(session.id).then(() => setMessages([])).catch(() => {});
            }
          }}
          className="btn-ghost p-1.5 rounded-lg text-gray-500 hover:text-red-400"
          title="Clear messages"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming.isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <p className="text-sm">Send a message to start</p>
            <div className="grid grid-cols-2 gap-2 max-w-lg">
              {["Analyze my codebase", "Write a Python script", "Explain this error", "Improve yourself"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-xs text-left px-3 py-2 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "user" && (
              <div className="message-user">
                <MessageRenderer content={msg.content} role="user" />
              </div>
            )}
            {msg.role === "assistant" && (
              <div className="message-assistant">
                <div className="flex items-center gap-1.5 mb-1.5 text-xs text-violet-400">
                  <span>⚡</span>
                  <span>Flux AI</span>
                </div>
                <MessageRenderer content={msg.content} role="assistant" />
                {msg.tool_calls && <ToolCallBadges toolCalls={msg.tool_calls} toolResults={msg.tool_results} />}
              </div>
            )}
          </div>
        ))}

        {/* Streaming output */}
        {streaming.isStreaming && (
          <div className="flex justify-start">
            <div className="message-assistant">
              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-violet-400">
                <span>⚡</span>
                <span>Flux AI</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </div>

              {/* Tool activity */}
              {streaming.toolActivity.map((t, i) => (
                <div key={i} className="message-tool mb-2">
                  <div className="flex items-center gap-1.5">
                    {t.status === "running" ? (
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                      </svg>
                    ) : (
                      <span className="text-green-400">✓</span>
                    )}
                    <span className="text-violet-300">{t.name}</span>
                  </div>
                  {t.result && (
                    <div className="mt-1 text-gray-500 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {t.result.slice(0, 500)}{t.result.length > 500 ? "…" : ""}
                    </div>
                  )}
                </div>
              ))}

              {streaming.content && <MessageRenderer content={streaming.content} role="assistant" />}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/30">
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex items-end gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2
                          focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/30 transition-all">
            <FileUpload sessionId={session.id} onUpload={handleFileUpload} />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Flux AI… (Enter to send, Shift+Enter for newline)"
              disabled={streaming.isStreaming}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none
                         focus:outline-none disabled:opacity-50 max-h-48 overflow-y-auto"
              style={{ minHeight: "24px" }}
            />
          </div>

          {streaming.isStreaming ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="btn-danger px-3 py-2.5 rounded-xl flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="btn-primary px-3 py-2.5 rounded-xl"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1.5 text-center">
          Flux AI can run code and edit files in the workspace directory
        </p>
      </div>
    </div>
  );
}

function ToolCallBadges({ toolCalls, toolResults }: { toolCalls: string; toolResults: string | null }) {
  const [open, setOpen] = useState(false);
  let calls: Array<{ function: { name: string } }> = [];
  try { calls = JSON.parse(toolCalls); } catch { return null; }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>{calls.length} tool call{calls.length !== 1 ? "s" : ""}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {calls.map((c, i) => (
            <div key={i} className="message-tool">
              <span className="text-violet-400">{c.function.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
