import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { db, getConfig, setConfig } from "./db";
import { streamChat, listModels, isOllamaRunning } from "./ollama";
import { executeTool, TOOLS, getWorkspace } from "./tools";
import {
  createSession, getSession, listSessions, deleteSession,
  updateSessionTitle, updateSessionModel, addMessage, getMessages, clearMessages,
  type Message,
} from "./sessions";
import { listImprovements, applyImprovement, rejectImprovement, getImprovementStats } from "./self-improve";
import type { OllamaMessage } from "./ollama";

const UPLOADS_DIR = join(process.cwd(), "data", "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  const error = (msg: string, status = 400) => json({ error: msg }, status);

  try {
    // ── Health ──────────────────────────────────────────────────────────────
    if (path === "/api/health" && method === "GET") {
      const ollamaOk = await isOllamaRunning();
      const models = ollamaOk ? await listModels() : [];
      return json({ ok: true, ollama: ollamaOk, models });
    }

    // ── Models ──────────────────────────────────────────────────────────────
    if (path === "/api/models" && method === "GET") {
      const models = await listModels();
      return json({ models });
    }

    // ── Config ──────────────────────────────────────────────────────────────
    if (path === "/api/config" && method === "GET") {
      const rows = db.query("SELECT key, value FROM config").all() as { key: string; value: string }[];
      return json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    }

    if (path === "/api/config" && method === "PUT") {
      const body = await req.json() as Record<string, string>;
      for (const [key, value] of Object.entries(body)) {
        setConfig(key, String(value));
      }
      return json({ ok: true });
    }

    // ── Sessions ────────────────────────────────────────────────────────────
    if (path === "/api/sessions" && method === "GET") {
      return json(listSessions());
    }

    if (path === "/api/sessions" && method === "POST") {
      const body = await req.json() as { model?: string; title?: string };
      return json(createSession(body.model, body.title), 201);
    }

    const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)(\/.*)?$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const sub = sessionMatch[2] ?? "";
      const session = getSession(sessionId);
      if (!session) return error("Session not found", 404);

      if (sub === "" && method === "GET") return json(session);
      if (sub === "" && method === "DELETE") { deleteSession(sessionId); return json({ ok: true }); }

      if (sub === "/messages" && method === "GET") return json(getMessages(sessionId));
      if (sub === "/messages" && method === "DELETE") { clearMessages(sessionId); return json({ ok: true }); }

      if (sub === "/title" && method === "PUT") {
        const { title } = await req.json() as { title: string };
        updateSessionTitle(sessionId, title);
        return json({ ok: true });
      }

      if (sub === "/model" && method === "PUT") {
        const { model } = await req.json() as { model: string };
        updateSessionModel(sessionId, model);
        return json({ ok: true });
      }

      // ── Chat (streaming) ─────────────────────────────────────────────────
      if (sub === "/chat" && method === "POST") {
        const body = await req.json() as { message: string; file_ids?: string[] };
        if (!body.message?.trim()) return error("Message required");

        // Save user message
        addMessage(sessionId, "user", body.message);

        // Build context
        const systemPrompt = session.system_prompt ?? getConfig("system_prompt") ?? "";
        const history = getMessages(sessionId);
        const ollamaMessages: OllamaMessage[] = [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({
            role: m.role as OllamaMessage["role"],
            content: m.content,
          })),
        ];

        // Stream response with tool execution
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            const send = (data: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

            try {
              let assistantContent = "";
              let iteration = 0;
              const MAX_TOOL_ITERATIONS = 10;

              while (iteration < MAX_TOOL_ITERATIONS) {
                iteration++;
                let toolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> = [];
                assistantContent = "";

                const chatStream = streamChat(session.model, ollamaMessages, TOOLS);

                for await (const chunk of chatStream) {
                  if (chunk.message.content) {
                    assistantContent += chunk.message.content;
                    send({ type: "token", content: chunk.message.content });
                  }
                  if (chunk.message.tool_calls?.length) {
                    toolCalls = chunk.message.tool_calls;
                  }
                  if (chunk.done) break;
                }

                if (!toolCalls.length) {
                  // No tools - we're done
                  const saved = addMessage(sessionId, "assistant", assistantContent);
                  send({ type: "done", message_id: saved.id });
                  break;
                }

                // Execute tools
                send({ type: "tool_start", tools: toolCalls.map((t) => t.function.name) });

                const toolResults: Array<{ name: string; result: string }> = [];
                for (const tc of toolCalls) {
                  const result = await executeTool(tc.function.name, tc.function.arguments);
                  toolResults.push({ name: tc.function.name, result: result.output });
                  send({ type: "tool_result", name: tc.function.name, result: result.output, success: result.success });
                }

                // Save assistant message with tool calls
                addMessage(sessionId, "assistant", assistantContent || "(tool call)", toolCalls, toolResults);

                // Add results to context and continue
                ollamaMessages.push({ role: "assistant", content: assistantContent, tool_calls: toolCalls });
                for (const tr of toolResults) {
                  ollamaMessages.push({ role: "tool", content: tr.result });
                }
              }
            } catch (err) {
              send({ type: "error", message: String(err) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            ...headers,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      }
    }

    // ── File uploads ────────────────────────────────────────────────────────
    if (path === "/api/files" && method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const sessionId = formData.get("session_id") as string | null;

      if (!file) return error("No file provided");

      const id = uuidv4();
      const ext = file.name.split(".").pop() ?? "bin";
      const savedName = `${id}.${ext}`;
      const savedPath = join(UPLOADS_DIR, savedName);

      await Bun.write(savedPath, await file.arrayBuffer());

      // Also copy into workspace so AI can access it
      const workspacePath = join(getWorkspace(), "uploads", file.name);
      mkdirSync(join(getWorkspace(), "uploads"), { recursive: true });
      await Bun.write(workspacePath, await Bun.file(savedPath).arrayBuffer());

      db.run(
        "INSERT INTO files(id,session_id,name,path,size,mime_type) VALUES(?,?,?,?,?,?)",
        [id, sessionId, file.name, savedPath, file.size, file.type]
      );

      return json({ id, name: file.name, size: file.size, workspace_path: `uploads/${file.name}` }, 201);
    }

    if (path === "/api/files" && method === "GET") {
      const sessionId = url.searchParams.get("session_id");
      const rows = sessionId
        ? db.query("SELECT * FROM files WHERE session_id = ? ORDER BY created_at DESC").all(sessionId)
        : db.query("SELECT * FROM files ORDER BY created_at DESC").all();
      return json(rows);
    }

    // ── Self-improvement ────────────────────────────────────────────────────
    if (path === "/api/improvements" && method === "GET") {
      return json(listImprovements());
    }

    if (path === "/api/improvements/stats" && method === "GET") {
      return json(getImprovementStats());
    }

    const improveMatch = path.match(/^\/api\/improvements\/([^/]+)\/(apply|reject)$/);
    if (improveMatch && method === "POST") {
      const [, id, action] = improveMatch;
      if (action === "apply") return json(applyImprovement(id));
      rejectImprovement(id);
      return json({ ok: true });
    }

    return error("Not found", 404);
  } catch (err) {
    console.error("[API Error]", err);
    return error(`Internal server error: ${String(err)}`, 500);
  }
}
