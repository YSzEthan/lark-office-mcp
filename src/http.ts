/**
 * Streamable HTTP transport — a single long-lived process shared by every
 * Claude Code session.
 *
 * Why this exists: in stdio mode each session forks its own process, so the
 * module-level rate limiter (3 QPS, Lark's per-app cap) and the cached user
 * access token are duplicated N times. N processes each honouring 3 QPS means
 * 3N QPS at Lark's door, and concurrent token refreshes invalidate each
 * other's refresh_token. One process fixes both.
 *
 * Stateless mode: server + transport are built per request and torn down when
 * the response closes. The shared state that matters (token cache, rate
 * limiter) lives at module scope, so it survives across requests regardless.
 */

import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { once } from "node:events";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { HTTP_PORT } from "./constants.js";
import { createServer, VERSION } from "./server.js";

const MCP_PATH = "/mcp";

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

export async function startHttpServer(): Promise<() => Promise<void>> {
  const httpServer = createHttpServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    if (path !== MCP_PATH) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    handleMcpRequest(req, res).catch((err) => {
      console.error("MCP request failed:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      } else {
        res.end();
      }
    });
  });

  httpServer.listen(HTTP_PORT, "127.0.0.1");
  await once(httpServer, "listening");

  console.error(
    `Lark MCP Server v${VERSION} listening on http://127.0.0.1:${HTTP_PORT}${MCP_PATH}`,
  );

  return () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      httpServer.closeAllConnections?.();
    });
}
