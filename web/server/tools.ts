import type { OllamaTool } from "./ollama";
import { join, resolve, relative } from "path";
import { existsSync, mkdirSync } from "fs";

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// Sandbox: all file ops are relative to workspace
export function getWorkspace(): string {
  const ws = process.env.FLUX_WORKSPACE ?? join(process.cwd(), "workspace");
  mkdirSync(ws, { recursive: true });
  return ws;
}

function safePath(filePath: string): string {
  const workspace = getWorkspace();
  const resolved = resolve(workspace, filePath);
  if (!resolved.startsWith(workspace)) {
    throw new Error(`Path escape attempt blocked: ${filePath}`);
  }
  return resolved;
}

export const TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a bash command in the workspace directory. Use for running tests, installing packages, git operations, etc.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The bash command to run" },
          timeout_ms: { type: "number", description: "Timeout in milliseconds (default 30000)" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in the workspace (creates directories if needed)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories in the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path relative to workspace (default: root)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for text patterns in files using grep",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for" },
          path: { type: "string", description: "Directory or file to search in (default: workspace root)" },
          file_pattern: { type: "string", description: "File glob pattern (e.g. '*.ts')" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_self_improvement",
      description: "Propose an improvement to your own system prompt, configuration, or behavior. This is how you improve yourself over time.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Type of improvement: 'prompt', 'skill', or 'config'" },
          description: { type: "string", description: "Human-readable description of why this improvement helps" },
          before_value: { type: "string", description: "The current value being improved" },
          after_value: { type: "string", description: "The proposed improved value" },
        },
        required: ["type", "description", "before_value", "after_value"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case "bash": {
        const command = args.command as string;
        const timeout = (args.timeout_ms as number) ?? 30000;
        const workspace = getWorkspace();
        const result = await Bun.$`bash -c ${command}`.cwd(workspace).timeout(timeout).nothrow();
        const stdout = result.stdout.toString().trim();
        const stderr = result.stderr.toString().trim();
        const output = [stdout, stderr ? `[stderr]: ${stderr}` : ""].filter(Boolean).join("\n");
        return {
          success: result.exitCode === 0,
          output: output || "(no output)",
          error: result.exitCode !== 0 ? `Exit code: ${result.exitCode}` : undefined,
        };
      }

      case "read_file": {
        const path = safePath(args.path as string);
        if (!existsSync(path)) return { success: false, output: "", error: `File not found: ${args.path}` };
        const content = await Bun.file(path).text();
        return { success: true, output: content };
      }

      case "write_file": {
        const path = safePath(args.path as string);
        mkdirSync(resolve(path, ".."), { recursive: true });
        await Bun.write(path, args.content as string);
        return { success: true, output: `Written ${(args.content as string).length} bytes to ${args.path}` };
      }

      case "list_files": {
        const dirPath = safePath((args.path as string) ?? ".");
        if (!existsSync(dirPath)) return { success: false, output: "", error: "Directory not found" };
        const result = await Bun.$`find ${dirPath} -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*'`.nothrow();
        const workspace = getWorkspace();
        const lines = result.stdout
          .toString()
          .split("\n")
          .filter(Boolean)
          .map((p) => relative(workspace, p))
          .join("\n");
        return { success: true, output: lines };
      }

      case "search_files": {
        const searchPath = safePath((args.path as string) ?? ".");
        const pattern = args.pattern as string;
        const filePattern = args.file_pattern as string | undefined;
        const cmd = filePattern
          ? `grep -r --include="${filePattern}" -n "${pattern}" "${searchPath}" 2>/dev/null | head -100`
          : `grep -r -n "${pattern}" "${searchPath}" 2>/dev/null | head -100`;
        const result = await Bun.$`bash -c ${cmd}`.nothrow();
        const output = result.stdout.toString().trim();
        return { success: true, output: output || "No matches found" };
      }

      case "propose_self_improvement": {
        const { db } = await import("./db");
        const { v4: uuidv4 } = await import("uuid");
        const id = uuidv4();
        db.run(
          "INSERT INTO self_improvements(id,type,description,before_value,after_value) VALUES(?,?,?,?,?)",
          [id, args.type, args.description, args.before_value, args.after_value]
        );
        return {
          success: true,
          output: `Self-improvement proposal #${id.slice(0, 8)} recorded. An admin can review and apply it.`,
        };
      }

      default:
        return { success: false, output: "", error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { success: false, output: "", error: String(err) };
  }
}
