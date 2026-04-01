import { handleRequest } from "./server/api";
import index from "./index.html";

const PORT = parseInt(process.env.PORT ?? "3000");

const server = Bun.serve({
  port: PORT,
  routes: {
    // Serve the React SPA
    "/": index,

    // All API routes
    "/api/*": handleRequest,

    // Health check (non-API)
    "/healthz": () => new Response("ok"),
  },

  // Fallback: serve index.html for client-side routing
  fetch(req) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response(Bun.file("./index.html"));
    }
    return handleRequest(req);
  },

  development: {
    hmr: true,
    console: true,
  },

  error(err) {
    console.error("[Server Error]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`
⚡ Flux AI is running!
   Local:  http://localhost:${PORT}

   Make sure Ollama is running: ollama serve
   Pull a model:               ollama pull llama3.2
`);
