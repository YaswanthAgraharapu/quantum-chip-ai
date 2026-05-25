import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT ?? 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = join(root, requestedPath);
  const finalPath = existsSync(filePath) ? filePath : join(root, "index.html");

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(finalPath)] ?? "application/octet-stream",
  });
  createReadStream(finalPath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Quantum Chip AI Designer running at http://localhost:${port}`);
});
