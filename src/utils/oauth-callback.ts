/**
 * OAuth Callback Server
 * 使用 Bun.serve() 建立臨時 HTTP server 接收 OAuth callback
 * 固定使用 CALLBACK_PORT，若被佔用則先殺掉佔用的 process
 */

import { execSync } from "child_process";
import { CALLBACK_PORT, CALLBACK_TIMEOUT_MS } from "../constants.js";

// 追蹤上一個 callback server，確保啟動新的之前先關閉舊的
let previousServer: ReturnType<typeof Bun.serve> | null = null;
let previousTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 殺掉佔用指定 port 的 process
 */
function killProcessOnPort(port: number): void {
  try {
    const pid = execSync(`lsof -ti tcp:${port}`, { encoding: "utf-8" }).trim();
    if (pid) {
      execSync(`kill -9 ${pid}`);
      console.error(`[OAuth] Killed process ${pid} occupying port ${port}`);
    }
  } catch {
    // 沒有 process 佔用，忽略
  }
}

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
 * 固定使用 CALLBACK_PORT，若被佔用則先殺掉再綁定
 */
export function startCallbackServer(
  port: number = CALLBACK_PORT,
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

  let server: ReturnType<typeof Bun.serve> | null = null;
  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  // 嘗試綁定，失敗則殺掉佔用 process 後重試一次
  for (let attempt = 0; attempt < 2; attempt++) {
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
      break; // 綁定成功
    } catch (err: unknown) {
      if (attempt === 0) {
        // 第一次失敗，殺掉佔用 process 後重試
        killProcessOnPort(port);
      } else {
        rejectCode!(err instanceof Error ? err : new Error(String(err)));
        return { port, codePromise };
      }
    }
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

  return { port, codePromise };
}
