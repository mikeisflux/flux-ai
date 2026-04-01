import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ImprovementsPanel } from "./components/ImprovementsPanel";
import { api, type Session, type HealthStatus } from "./api";

export type Panel = "chat" | "settings" | "improvements";

export function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadSessions = useCallback(async () => {
    const data = await api.sessions.list().catch(() => []);
    setSessions(data);
  }, []);

  useEffect(() => {
    loadSessions();
    api.health().then((h) => {
      setHealth(h);
      setModels(h.models);
    }).catch(() => {});
    api.models().then((r) => setModels(r.models)).catch(() => {});
  }, [loadSessions]);

  const createSession = async () => {
    const session = await api.sessions.create(models[0]);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setPanel("chat");
  };

  const deleteSession = async (id: string) => {
    await api.sessions.delete(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        panel={panel}
        health={health}
        onSelectSession={(id) => { setActiveSessionId(id); setPanel("chat"); }}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onSetPanel={setPanel}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {panel === "chat" && (
          <ChatPanel
            session={activeSession}
            models={models}
            onSessionUpdate={(updated) => {
              setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
            }}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
        )}
        {panel === "settings" && (
          <SettingsPanel models={models} onClose={() => setPanel("chat")} />
        )}
        {panel === "improvements" && (
          <ImprovementsPanel onClose={() => setPanel("chat")} />
        )}
      </main>
    </div>
  );
}
