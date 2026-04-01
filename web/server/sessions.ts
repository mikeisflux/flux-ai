import { db, getConfig } from "./db";
import { v4 as uuidv4 } from "uuid";

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

export function createSession(model?: string, title?: string): Session {
  const id = uuidv4();
  const defaultModel = model ?? getConfig("default_model") ?? "llama3.2";
  db.run(
    "INSERT INTO sessions(id,title,model) VALUES(?,?,?)",
    [id, title ?? "New Session", defaultModel]
  );
  return getSession(id)!;
}

export function getSession(id: string): Session | null {
  return db.query("SELECT * FROM sessions WHERE id = ?").get(id) as Session | null;
}

export function listSessions(): Session[] {
  return db.query("SELECT * FROM sessions ORDER BY updated_at DESC").all() as Session[];
}

export function deleteSession(id: string): void {
  db.run("DELETE FROM sessions WHERE id = ?", [id]);
}

export function updateSessionTitle(id: string, title: string): void {
  db.run("UPDATE sessions SET title=?,updated_at=unixepoch() WHERE id=?", [title, id]);
}

export function updateSessionModel(id: string, model: string): void {
  db.run("UPDATE sessions SET model=?,updated_at=unixepoch() WHERE id=?", [model, id]);
}

export function addMessage(
  sessionId: string,
  role: Message["role"],
  content: string,
  toolCalls?: unknown,
  toolResults?: unknown
): Message {
  const id = uuidv4();
  db.run(
    "INSERT INTO messages(id,session_id,role,content,tool_calls,tool_results) VALUES(?,?,?,?,?,?)",
    [
      id,
      sessionId,
      role,
      content,
      toolCalls ? JSON.stringify(toolCalls) : null,
      toolResults ? JSON.stringify(toolResults) : null,
    ]
  );
  db.run("UPDATE sessions SET updated_at=unixepoch() WHERE id=?", [sessionId]);
  return getMessage(id)!;
}

export function getMessage(id: string): Message | null {
  return db.query("SELECT * FROM messages WHERE id = ?").get(id) as Message | null;
}

export function getMessages(sessionId: string): Message[] {
  return db.query(
    "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(sessionId) as Message[];
}

export function clearMessages(sessionId: string): void {
  db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);
}
