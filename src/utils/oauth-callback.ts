/**
 * OAuth Callback Server
 * 使用 Bun.serve() 建立臨時 HTTP server 接收 OAuth callback
 * 支援 port 自動切換：若預設 port 被佔用，自動嘗試下一個
 */

import { CALLBACK_PORT, CALLBACK_TIMEOUT_MS } from "../constants.js";

const MAX_PORT_ATTEMPTS = 10;

// 追蹤上一個 callback server，確保啟動新的之前先關閉舊的
let previousServer: ReturnType<typeof Bun.serve> | null = null;
let previousTimer: ReturnType<typeof setTimeout> | null = null;

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>授權成功</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0fdf4}
.card{text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#16a34a;margin:0 0 0.5rem}p{color:#666;margin:0}</style></head>
<body><div class="card"><h1>授權成功</h1><p>可以關閉此頁面了</p></div></body></html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>授權失敗</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2}
.card{text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{color:#dc2626;margin:0 0 0.5rem}p{color:#666;margin:0}</style></head>
<body><div class="card"><h1>授權失敗</h1><p>${msg}</p></div></body></html>`;

/**
 * 啟動 callback server 的結果
 */
export interface CallbackServer {
  /** 實際監聽的 port */
  port: number;
  /** 等待 OAuth code 的 Promise */
  codePromise: Promise<string>;
}

/**
 * 啟動臨時 callback server
 * 若指定的 port 被佔用，自動嘗試 port+1, port+2... 直到成功
 * @returns 包含實際 port 和 code Promise 的物件
 */
export function startCallbackServer(
  startPort: number = CALLBACK_PORT,
  timeoutMs: number = CALLBACK_TIMEOUT_MS
): CallbackServer {
  // 先停掉上一個 callback server，釋放 port
  if (previousTimer) {
    clearTimeout(previousTimer);
    previousTimer = null;
  }
  if (previousServer) {
    previousServer.stop(true);
    previousServer = null;
  }

  let actualPort = startPort;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  // 嘗試綁定 port
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = startPort + attempt;
    try {
      server = Bun.serve({
        port,
        fetch(req) {
          const url = new URL(req.url);

          if (url.pathname !== "/callback") {
            return new Response("Not Found", { status: 404 });
          }

          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");

          if (state !== "lark_mcp_auth") {
            const html = ERROR_HTML("state 驗證失敗");
            setTimeout(() => {
              clearTimeout(timer);
              server!.stop(true);
              previousServer = null;
              previousTimer = null;
              rejectCode(new Error("OAuth state mismatch"));
            }, 100);
            return new Response(html, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          if (!code) {
            const html = ERROR_HTML("未收到授權碼");
            setTimeout(() => {
              clearTimeout(timer);
              server!.stop(true);
              previousServer = null;
              previousTimer = null;
              rejectCode(new Error("No authorization code received"));
            }, 100);
            return new Response(html, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          }

          // 成功收到 code
          setTimeout(() => {
            clearTimeout(timer);
            server!.stop(true);
            previousServer = null;
            previousTimer = null;
            resolveCode(code);
          }, 100);
          return new Response(SUCCESS_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        },
      });
      actualPort = port;
      break;
    } catch (err: unknown) {
      const isAddrInUse =
        err instanceof Error &&
        ("code" in err && (err as NodeJS.ErrnoException).code === "EADDRINUSE" ||
         err.message.includes("address already in use") ||
         err.message.includes("EADDRINUSE"));
      if (!isAddrInUse || attempt === MAX_PORT_ATTEMPTS - 1) {
        rejectCode!(err instanceof Error ? err : new Error(String(err)));
        return { port: startPort, codePromise };
      }
      // port 被佔用，嘗試下一個
    }
  }

  if (actualPort !== startPort) {
    console.error(`[OAuth] Port ${startPort} 被佔用，改用 port ${actualPort}`);
  }

  // 記錄當前 server，供下次清理
  previousServer = server;

  // 超時自動關閉
  const timer = setTimeout(() => {
    server?.stop(true);
    previousServer = null;
    previousTimer = null;
    rejectCode(new Error(`OAuth callback timeout (${timeoutMs / 1000}s)`));
  }, timeoutMs);
  previousTimer = timer;

  return { port: actualPort, codePromise };
}
