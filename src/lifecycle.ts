/**
 * Lifecycle watchdog for stdio MCP server.
 *
 * Claude Code spawns this server over stdio. When the parent dies, the server
 * must exit — otherwise it lingers as an orphan, holding Lark API tokens and
 * racing with new sessions for rate limit quota.
 *
 * Four-layer defense:
 *   1. POSIX signals (SIGTERM/SIGINT/SIGHUP)
 *   2. stdin EOF / close — most reliable signal that the parent's pipe broke
 *   3. PPID poll — fallback for when stdin EOF is missed (rare on macOS)
 *   4. uncaughtException — exit instead of staying in a half-broken state
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const PARENT_POLL_INTERVAL_MS = 30_000;

export function setupLifecycle(server: McpServer): void {
  let exiting = false;

  const shutdown = (reason: string, code = 0): void => {
    if (exiting) return;
    exiting = true;
    console.error(`Lark MCP shutting down: ${reason}`);
    server
      .close()
      .catch(() => {})
      .finally(() => process.exit(code));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  process.stdin.on("end", () => shutdown("stdin EOF"));
  process.stdin.on("close", () => shutdown("stdin closed"));

  setInterval(() => {
    if (process.ppid === 1) shutdown("parent died (PPID=1)");
  }, PARENT_POLL_INTERVAL_MS).unref();

  process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", err);
    shutdown("uncaughtException", 1);
  });
}
