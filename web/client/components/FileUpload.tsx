import React, { useRef, useState } from "react";
import { api } from "../api";

interface Props {
  sessionId: string | null;
  onUpload: (info: { name: string; workspace_path: string }) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function FileUpload({ sessionId, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [recentFiles, setRecentFiles] = useState<{ name: string; size: number }[]>([]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.files.upload(file, sessionId ?? undefined);
      setRecentFiles((prev) => [{ name: file.name, size: file.size }, ...prev.slice(0, 4)]);
      onUpload({ name: result.name, workspace_path: result.workspace_path });
    } catch (err) {
      alert(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(upload);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-ghost p-2 rounded-lg relative"
        title="Upload file"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>

      {/* Recent files tooltip */}
      {recentFiles.length > 0 && (
        <div className="absolute bottom-full mb-1 right-0 bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs w-48 z-10">
          <p className="text-gray-400 mb-1">Recent uploads:</p>
          {recentFiles.map((f, i) => (
            <div key={i} className="flex justify-between text-gray-300">
              <span className="truncate">{f.name}</span>
              <span className="text-gray-500 ml-2">{formatBytes(f.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
