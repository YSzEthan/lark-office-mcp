/**
 * Lifecycle watchdog for the MCP server.
 *
 * In stdio mode Claude Code spawns this server as a child process. When the
 * parent dies, the server must exit — otherwise it lingers as an orphan,
 * holding Lark API tokens and racing with new sessions for rate limit quota.
 *
 * Four-layer defense (stdio):
 *   1. POSIX signals (SIGTERM/SIGINT/SIGHUP)
 *   2. stdin EOF / close — most reliable signal that the parent's pipe broke
 *   3. PPID poll — fallback for when stdin EOF is missed (rare on macOS)
 *   4. uncaughtException — exit instead of staying in a half-broken state
 *
 * In HTTP mode the process is intentionally long-lived and detached (nohup),
 * so layers 2 and 3 must be off: stdin is closed and PPID becomes 1 by design,
 * and either would make the watchdog kill a perfectly healthy server.
 */

const PARENT_POLL_INTERVAL_MS = 30_000;

export interface LifecycleOptions {
  /** Watch stdin EOF and PPID for a dead parent. Off for detached HTTP mode. */
  watchParent?: boolean;
}

export function setupLifecycle(
  close: () => Promise<void> | void,
  options: LifecycleOptions = {},
): void {
  const { watchParent = true } = options;
  let exiting = false;

  const shutdown = (reason: string, code = 0): void => {
    if (exiting) return;
    exiting = true;
    console.error(`Lark MCP shutting down: ${reason}`);
    Promise.resolve()
      .then(close)
      .catch(() => {})
      .finally(() => process.exit(code));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  if (watchParent) {
    // Under nohup SIGHUP is SIG_IGN; installing a handler would undo that and
    // let a closing terminal kill the detached HTTP server.
    process.on("SIGHUP", () => shutdown("SIGHUP"));

    process.stdin.on("end", () => shutdown("stdin EOF"));
    process.stdin.on("close", () => shutdown("stdin closed"));

    setInterval(() => {
      if (process.ppid === 1) shutdown("parent died (PPID=1)");
    }, PARENT_POLL_INTERVAL_MS).unref();
  }

  process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", err);
    shutdown("uncaughtException", 1);
  });
}
