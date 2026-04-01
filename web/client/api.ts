const BASE = "/api";

export interface Session {
  id: string;
  title: string;
  model: string;
  system_prompt: string | null;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls: string | null;
  tool_results: string | null;
  created_at: number;
}

export interface HealthStatus {
  ok: boolean;
  ollama: boolean;
  models: string[];
}

export interface SelfImprovement {
  id: string;
  type: "prompt" | "skill" | "config";
  description: string;
  before_value: string;
  after_value: string;
  applied: number;
  created_at: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthStatus>("/health"),
  models: () => request<{ models: string[] }>("/models"),

  config: {
    get: () => request<Record<string, string>>("/config"),
    set: (data: Record<string, string>) =>
      request<{ ok: boolean }>("/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },

  sessions: {
    list: () => request<Session[]>("/sessions"),
    create: (model?: string, title?: string) =>
      request<Session>("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, title }),
      }),
    get: (id: string) => request<Session>(`/sessions/${id}`),
    delete: (id: string) => request<{ ok: boolean }>(`/sessions/${id}`, { method: "DELETE" }),
    setTitle: (id: string, title: string) =>
      request<{ ok: boolean }>(`/sessions/${id}/title`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }),
    setModel: (id: string, model: string) =>
      request<{ ok: boolean }>(`/sessions/${id}/model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      }),
    messages: (id: string) => request<Message[]>(`/sessions/${id}/messages`),
    clearMessages: (id: string) => request<{ ok: boolean }>(`/sessions/${id}/messages`, { method: "DELETE" }),
  },

  files: {
    upload: async (file: File, sessionId?: string): Promise<{ id: string; name: string; size: number; workspace_path: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      if (sessionId) fd.append("session_id", sessionId);
      const res = await fetch(`${BASE}/files`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    list: (sessionId?: string) =>
      request<{ id: string; name: string; size: number; workspace_path: string }[]>(
        `/files${sessionId ? `?session_id=${sessionId}` : ""}`
      ),
  },

  improvements: {
    list: () => request<SelfImprovement[]>("/improvements"),
    stats: () => request<{ pending: number; applied: number; total: number }>("/improvements/stats"),
    apply: (id: string) => request<{ success: boolean; message: string }>(`/improvements/${id}/apply`, { method: "POST" }),
    reject: (id: string) => request<{ ok: boolean }>(`/improvements/${id}/reject`, { method: "POST" }),
  },

  // Server-Sent Events for streaming chat
  chat: (sessionId: string, message: string, onEvent: (event: ChatEvent) => void, signal?: AbortSignal): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${BASE}/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          signal,
        });

        if (!res.ok) throw new Error("Chat request failed");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) { resolve(); break; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as ChatEvent;
                onEvent(event);
              } catch { /* skip */ }
            }
          }
        }
      } catch (err) {
        reject(err);
      }
    });
  },
};

export type ChatEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; tools: string[] }
  | { type: "tool_result"; name: string; result: string; success: boolean }
  | { type: "done"; message_id: string }
  | { type: "error"; message: string };
