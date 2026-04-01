import React, { useState, useEffect } from "react";
import { api, type SelfImprovement } from "../api";

interface Props {
  onClose: () => void;
}

export function ImprovementsPanel({ onClose }: Props) {
  const [improvements, setImprovements] = useState<SelfImprovement[]>([]);
  const [stats, setStats] = useState({ pending: 0, applied: 0, total: 0 });
  const [filter, setFilter] = useState<"all" | "pending" | "applied">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    api.improvements.list().then(setImprovements).catch(() => {});
    api.improvements.stats().then(setStats).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const apply = async (id: string) => {
    const result = await api.improvements.apply(id).catch((e) => ({ success: false, message: String(e) }));
    if (result.success) load();
    else alert(result.message);
  };

  const reject = async (id: string) => {
    if (!confirm("Reject and delete this improvement?")) return;
    await api.improvements.reject(id).catch(() => {});
    load();
  };

  const filtered = improvements.filter((imp) => {
    if (filter === "pending") return !imp.applied;
    if (filter === "applied") return imp.applied === 1;
    return true;
  });

  const typeColor = (type: string) => ({
    prompt: "text-blue-400 bg-blue-400/10",
    skill: "text-green-400 bg-green-400/10",
    config: "text-orange-400 bg-orange-400/10",
  }[type] ?? "text-gray-400 bg-gray-400/10");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            ✨ Self-Improvements
            {stats.pending > 0 && (
              <span className="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">
                {stats.pending} pending
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.applied} applied · {stats.total} total proposals
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost">✕</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 pt-4">
        {(["pending", "all", "applied"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors
              ${filter === f ? "bg-violet-600/20 text-violet-300 border border-violet-500/30" : "btn-ghost"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-4xl mb-3">✨</div>
            <p>No {filter === "all" ? "" : filter} improvements yet</p>
            <p className="text-xs mt-1">Ask Flux AI to improve itself or solve a complex problem</p>
          </div>
        )}

        {filtered.map((imp) => (
          <div
            key={imp.id}
            className={`border rounded-xl overflow-hidden transition-all
              ${imp.applied ? "border-gray-700/50 opacity-70" : "border-gray-700 hover:border-gray-600"}`}
          >
            <div
              className="flex items-start gap-3 p-4 cursor-pointer"
              onClick={() => setExpanded(expanded === imp.id ? null : imp.id)}
            >
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeColor(imp.type)}`}>
                {imp.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium">{imp.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {imp.applied ? "✓ Applied" : "Pending review"} ·{" "}
                  {new Date(imp.created_at * 1000).toLocaleDateString()}
                </p>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`shrink-0 transition-transform ${expanded === imp.id ? "rotate-180" : ""} text-gray-500`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {expanded === imp.id && (
              <div className="border-t border-gray-800 bg-gray-900/50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Before</p>
                    <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {imp.before_value.slice(0, 500)}{imp.before_value.length > 500 ? "…" : ""}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">After</p>
                    <pre className="text-xs text-green-400 bg-gray-900 rounded-lg p-3 overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {imp.after_value.slice(0, 500)}{imp.after_value.length > 500 ? "…" : ""}
                    </pre>
                  </div>
                </div>

                {!imp.applied && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => apply(imp.id)} className="btn-primary flex-1">
                      ✓ Apply Improvement
                    </button>
                    <button onClick={() => reject(imp.id)} className="btn-danger flex-1">
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
