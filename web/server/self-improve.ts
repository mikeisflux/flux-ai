import { db, getConfig, setConfig } from "./db";

export interface SelfImprovement {
  id: string;
  type: "prompt" | "skill" | "config";
  description: string;
  before_value: string;
  after_value: string;
  applied: number;
  created_at: number;
}

export function listImprovements(applied?: boolean): SelfImprovement[] {
  if (applied === undefined) {
    return db.query("SELECT * FROM self_improvements ORDER BY created_at DESC").all() as SelfImprovement[];
  }
  return db
    .query("SELECT * FROM self_improvements WHERE applied = ? ORDER BY created_at DESC")
    .all(applied ? 1 : 0) as SelfImprovement[];
}

export function applyImprovement(id: string): { success: boolean; message: string } {
  const improvement = db
    .query("SELECT * FROM self_improvements WHERE id = ?")
    .get(id) as SelfImprovement | null;

  if (!improvement) return { success: false, message: "Improvement not found" };
  if (improvement.applied) return { success: false, message: "Already applied" };

  try {
    switch (improvement.type) {
      case "prompt":
        setConfig("system_prompt", improvement.after_value);
        break;
      case "config": {
        // after_value is JSON: { key: string, value: string }
        const cfg = JSON.parse(improvement.after_value) as { key: string; value: string };
        setConfig(cfg.key, cfg.value);
        break;
      }
      case "skill":
        // Skills are saved as files in the workspace
        // after_value is JSON: { filename: string, content: string }
        const skill = JSON.parse(improvement.after_value) as { filename: string; content: string };
        Bun.write(`./skills/${skill.filename}`, skill.content);
        break;
    }

    db.run(
      "UPDATE self_improvements SET applied = 1 WHERE id = ?",
      [id]
    );

    return { success: true, message: `Applied ${improvement.type} improvement: ${improvement.description}` };
  } catch (err) {
    return { success: false, message: `Failed to apply: ${String(err)}` };
  }
}

export function rejectImprovement(id: string): void {
  db.run("DELETE FROM self_improvements WHERE id = ?", [id]);
}

export function getImprovementStats(): { pending: number; applied: number; total: number } {
  const total = (db.query("SELECT COUNT(*) as n FROM self_improvements").get() as { n: number }).n;
  const applied = (db.query("SELECT COUNT(*) as n FROM self_improvements WHERE applied=1").get() as { n: number }).n;
  return { total, applied, pending: total - applied };
}

// Auto-apply improvements if self_improve_enabled and below risk threshold
export async function maybeAutoApply(): Promise<void> {
  const enabled = getConfig("self_improve_enabled") === "true";
  if (!enabled) return;

  // Only auto-apply config changes (lowest risk); prompts need human review
  const safeImprovements = db
    .query("SELECT * FROM self_improvements WHERE applied=0 AND type='config'")
    .all() as SelfImprovement[];

  for (const imp of safeImprovements) {
    applyImprovement(imp.id);
  }
}
