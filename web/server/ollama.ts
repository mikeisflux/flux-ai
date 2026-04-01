import { getConfig } from "./db";

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
}

export async function* streamChat(
  model: string,
  messages: OllamaMessage[],
  tools?: OllamaTool[],
  signal?: AbortSignal
): AsyncGenerator<OllamaStreamChunk> {
  const ollamaUrl = getConfig("ollama_url") ?? "http://localhost:11434";

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    options: { num_ctx: parseInt(getConfig("max_context_tokens") ?? "8192") },
  };
  if (tools?.length) body.tools = tools;

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as OllamaStreamChunk;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function listModels(): Promise<string[]> {
  const ollamaUrl = getConfig("ollama_url") ?? "http://localhost:11434";
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json() as { models: { name: string }[] };
    return data.models.map((m) => m.name);
  } catch {
    return [];
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  const ollamaUrl = getConfig("ollama_url") ?? "http://localhost:11434";
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
