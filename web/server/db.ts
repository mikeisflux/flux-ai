import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR = process.env.FLUX_DATA_DIR ?? join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, "flux.db"), { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Session',
    model TEXT NOT NULL DEFAULT 'llama3.2',
    system_prompt TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','assistant','tool','system')),
    content TEXT NOT NULL,
    tool_calls TEXT,
    tool_results TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS self_improvements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('prompt','skill','config')),
    description TEXT NOT NULL,
    before_value TEXT NOT NULL,
    after_value TEXT NOT NULL,
    applied INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

// Seed default config
const defaultConfig: Record<string, string> = {
  ollama_url: "http://localhost:11434",
  default_model: "llama3.2",
  system_prompt: `You are Flux AI, a powerful self-hosted AI assistant and coding agent.
You can read and write files, run bash commands, search codebases, and help with any programming task.
You are also capable of improving yourself - when you identify ways to be more helpful,
you can propose improvements to your own system prompt, tools, or configuration.
Always be honest about your capabilities and limitations.`,
  max_context_tokens: "8192",
  self_improve_enabled: "true",
};

const upsertConfig = db.prepare(`
  INSERT INTO config(key, value) VALUES(?, ?)
  ON CONFLICT(key) DO NOTHING
`);
for (const [key, value] of Object.entries(defaultConfig)) {
  upsertConfig.run(key, value);
}

export function getConfig(key: string): string | null {
  const row = db.query("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  db.run(
    "INSERT INTO config(key,value,updated_at) VALUES(?,?,unixepoch()) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()",
    [key, value]
  );
}
