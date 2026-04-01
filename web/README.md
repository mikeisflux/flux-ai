# Flux AI Web

Self-hosted AI coding assistant with a web interface, powered by local models via Ollama.

## Features

- **Chat interface** with streaming responses
- **File uploads** — drag & drop files into the workspace for the AI to work with
- **Tool execution** — AI can run bash commands, read/write files, search codebases
- **Self-improvement** — AI proposes improvements to its own system prompt and config
- **Session history** — save and resume conversations
- **Model switching** — switch between any Ollama model per session
- **No API keys** — runs entirely locally

## Requirements

- [Bun](https://bun.sh) >= 1.1.0
- [Ollama](https://ollama.ai) running locally

## Quick Start

```bash
# 1. Install Ollama and pull a model
ollama pull llama3.2

# 2. Start the server
cd web
bun dev

# 3. Open in browser
open http://localhost:3000
```

## Configuration

Visit Settings in the sidebar to configure:

- **Ollama URL** — default `http://localhost:11434`
- **Default model** — any model pulled with Ollama
- **Context window** — token limit per request
- **System prompt** — the AI's core instructions (can be self-improved)

## Self-Improvement

The AI uses the `propose_self_improvement` tool to suggest changes to its own:
- **System prompt** — improve its instructions and behavior
- **Config** — adjust default settings
- **Skills** — add new capabilities

Proposals appear in the Improvements panel for review and approval.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `FLUX_DATA_DIR` | `./data` | Database and uploads location |
| `FLUX_WORKSPACE` | `./workspace` | AI tool working directory |

## Architecture

```
web/
  index.ts              # Bun.serve entry point
  index.html            # SPA shell
  server/
    api.ts              # HTTP request router
    db.ts               # SQLite database (bun:sqlite)
    ollama.ts           # Ollama streaming client
    tools.ts            # Tool executor (bash, files, search)
    sessions.ts         # Session & message management
    self-improve.ts     # Self-improvement engine
  client/
    main.tsx            # React entry point
    App.tsx             # Root component
    api.ts              # Frontend API client
    components/
      Sidebar.tsx            # Session list + navigation
      ChatPanel.tsx          # Main chat interface
      MessageRenderer.tsx    # Markdown + code rendering
      FileUpload.tsx         # File upload widget
      SettingsPanel.tsx      # Configuration UI
      ImprovementsPanel.tsx  # Self-improvement review UI
```
