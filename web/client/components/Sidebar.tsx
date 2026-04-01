import React from "react";
import type { Session, HealthStatus } from "../api";
import type { Panel } from "../App";

interface Props {
  open: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  panel: Panel;
  health: HealthStatus | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onSetPanel: (panel: Panel) => void;
  onToggle: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function Sidebar({
  open, sessions, activeSessionId, panel, health,
  onSelectSession, onCreateSession, onDeleteSession, onSetPanel, onToggle,
}: Props) {
  if (!open) {
    return (
      <div className="w-12 border-r border-gray-800 flex flex-col items-center py-3 gap-3">
        <button onClick={onToggle} className="btn-ghost p-2 rounded-lg" title="Open sidebar">
          <MenuIcon />
        </button>
        <button onClick={onCreateSession} className="btn-ghost p-2 rounded-lg" title="New session">
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 border-r border-gray-800 flex flex-col bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="font-bold text-white">Flux AI</span>
          <span className={`w-2 h-2 rounded-full ${health?.ollama ? "bg-green-400" : "bg-red-400"}`}
            title={health?.ollama ? "Ollama connected" : "Ollama offline"} />
        </div>
        <button onClick={onToggle} className="btn-ghost p-1.5 rounded-lg" title="Close sidebar">
          <ChevronLeftIcon />
        </button>
      </div>

      {/* New session button */}
      <div className="px-3 py-2">
        <button onClick={onCreateSession} className="btn-primary w-full flex items-center gap-2 justify-center">
          <PlusIcon />
          New Session
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {sessions.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-0.5
              transition-colors ${activeSessionId === s.id && panel === "chat"
                ? "bg-violet-600/20 border border-violet-500/30"
                : "hover:bg-gray-800/60"}`}
            onClick={() => onSelectSession(s.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{s.title}</p>
              <p className="text-xs text-gray-500">{timeAgo(s.updated_at)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-600 transition-all rounded"
              title="Delete session"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-gray-800 p-2 flex gap-1">
        <button
          onClick={() => onSetPanel("settings")}
          className={`btn-ghost flex-1 flex items-center gap-1.5 justify-center text-xs
            ${panel === "settings" ? "text-violet-400" : ""}`}
        >
          <GearIcon /> Settings
        </button>
        <button
          onClick={() => onSetPanel("improvements")}
          className={`btn-ghost flex-1 flex items-center gap-1.5 justify-center text-xs
            ${panel === "improvements" ? "text-violet-400" : ""}`}
        >
          <SparkleIcon /> Improve
        </button>
      </div>
    </aside>
  );
}

// Minimal inline SVG icons
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
);
const GearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
);
const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);
