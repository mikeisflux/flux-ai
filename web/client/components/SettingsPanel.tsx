import React, { useState, useEffect } from "react";
import { api } from "../api";

interface Props {
  models: string[];
  onClose: () => void;
}

export function SettingsPanel({ models, onClose }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.config.get().then(setConfig).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.config.set(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <button onClick={onClose} className="btn-ghost">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 max-w-2xl">
        {/* Ollama */}
        <section>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Local AI (Ollama)</h3>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-400 mb-1 block">Ollama URL</span>
              <input
                type="url"
                value={config.ollama_url ?? "http://localhost:11434"}
                onChange={(e) => set("ollama_url", e.target.value)}
                className="input"
                placeholder="http://localhost:11434"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-400 mb-1 block">Default Model</span>
              <select
                value={config.default_model ?? "llama3.2"}
                onChange={(e) => set("default_model", e.target.value)}
                className="input"
              >
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
                {models.length === 0 && <option value={config.default_model}>{config.default_model ?? "llama3.2"}</option>}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Run <code className="text-violet-400">ollama pull llama3.2</code> to download a model
              </p>
            </label>
            <label className="block">
              <span className="text-sm text-gray-400 mb-1 block">Context Window (tokens)</span>
              <input
                type="number"
                value={config.max_context_tokens ?? "8192"}
                onChange={(e) => set("max_context_tokens", e.target.value)}
                className="input"
                min={1024}
                max={131072}
                step={1024}
              />
            </label>
          </div>
        </section>

        {/* System Prompt */}
        <section>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">System Prompt</h3>
          <textarea
            value={config.system_prompt ?? ""}
            onChange={(e) => set("system_prompt", e.target.value)}
            className="input font-mono text-xs"
            rows={12}
            placeholder="You are Flux AI..."
          />
          <p className="text-xs text-gray-500 mt-1">
            The AI can propose improvements to this via the <code className="text-violet-400">propose_self_improvement</code> tool.
          </p>
        </section>

        {/* Self-improvement */}
        <section>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Self-Improvement</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.self_improve_enabled === "true"}
              onChange={(e) => set("self_improve_enabled", e.target.checked ? "true" : "false")}
              className="w-4 h-4 rounded accent-violet-600"
            />
            <div>
              <p className="text-sm text-gray-200">Enable self-improvement</p>
              <p className="text-xs text-gray-500">Allow AI to propose and auto-apply safe configuration improvements</p>
            </div>
          </label>
        </section>
      </div>

      <div className="border-t border-gray-800 px-6 py-4 flex justify-end gap-3">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
