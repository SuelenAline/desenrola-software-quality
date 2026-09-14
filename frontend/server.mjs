import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/domain.js", ["domain.js", "text/javascript; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);

export function createServer(apiOrigin = "http://127.0.0.1:3000") {
  const backend = new URL(apiOrigin);
  if (backend.protocol !== "http:")
    throw new Error("API_ORIGIN deve ser uma URL HTTP do backend local.");
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      const headers = {
        "content-type": req.headers["content-type"] || "application/json",
      };
      if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];
      else if (req.headers["transfer-encoding"]) headers["transfer-encoding"] = "chunked";
      if (req.headers.authorization)
        headers.authorization = req.headers.authorization;
      // Fixed origin and selected headers: never forward arbitrary hosts or proxy headers.
      const upstream = http.request(
        {
          hostname: backend.hostname,
          port: backend.port || 80,
          path: req.url.slice(4),
          method: req.method,
          headers,
          timeout: 15_000,
        },
        (response) => {
          res.statusCode = response.statusCode || 502;
          for (const header of [
            "content-type",
            "retry-after",
            "ratelimit",
            "ratelimit-policy",
          ]) {
            if (response.headers[header])
              res.setHeader(header, response.headers[header]);
          }
          response.on("error", () => res.destroy());
          response.pipe(res);
        },
      );
      upstream.on("timeout", () =>
        upstream.destroy(new Error("Backend timeout")),
      );
      upstream.on("error", () => {
        if (res.headersSent) return res.destroy();
        res.writeHead(502, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            message:
              "Não foi possível conectar à API. Verifique se o backend está em execução.",
          }),
        );
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    const file = files.get(pathname);
    if (!file || !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(404);
      res.end("Não encontrado");
      return;
    }
    try {
      const content = await readFile(
        new URL(`./public/${file[0]}`, import.meta.url),
      );
      res.writeHead(200, { "content-type": file[1] });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(500);
      res.end("Não foi possível carregar a página.");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.FRONTEND_PORT || 5173);
  const server = createServer(process.env.API_ORIGIN);
  server.listen(port, "127.0.0.1", () =>
    console.log(`Desenrola disponível em http://localhost:${port}`),
  );
}
