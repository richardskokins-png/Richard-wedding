import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "Local reference mode is active. Deploy to Vercel with environment variables for live integrations.", code: "SETUP_REQUIRED" }));
      return;
    }
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const resolved = path.resolve(root, relative);
    if (!resolved.startsWith(root + path.sep) && resolved !== path.join(root, "index.html")) throw new Error("Invalid path");
    const data = await fs.readFile(resolved);
    res.writeHead(200, { "Content-Type": mime[path.extname(resolved)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    try {
      const data = await fs.readFile(path.join(root, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Friends Included preview: http://127.0.0.1:${port}`);
});
