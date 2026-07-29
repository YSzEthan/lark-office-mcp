#!/usr/bin/env node
/**
 * Lark MCP Server
 *
 * MCP server for Lark/Feishu API integration:
 * - Wiki: Read, write, search wiki documents
 * - Documents: Create, read, update, delete documents
 * - Tasks: Manage todos and tasklists
 *
 * Uses User Access Token (OAuth 2.0) for authentication.
 *
 * Transports:
 * - stdio (default)       — one process per Claude Code session
 * - Streamable HTTP (--http) — one shared process for all sessions
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { setupLifecycle } from "./lifecycle.js";
import { createServer, VERSION } from "./server.js";

async function main() {
  if (process.argv.includes("--http")) {
    const { startHttpServer } = await import("./http.js");
    const close = await startHttpServer();
    setupLifecycle(close, { watchParent: false });
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  setupLifecycle(() => server.close());
  console.error(`Lark MCP Server v${VERSION} started`);
}

main().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
