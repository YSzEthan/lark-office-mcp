/**
 * OAuth Callback Server
 * 使用 Bun.serve() 建立臨時 HTTP server 接收 OAuth callback
 */

import { CALLBACK_PORT, CALLBACK_TIMEOUT_MS } from "../constants.js";

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
 * 啟動臨時 callback server，等待 OAuth redirect 回傳 code
 */
export function waitForOAuthCallback(
  port: number = CALLBACK_PORT,
  timeoutMs: number = CALLBACK_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;

    const server = Bun.serve({
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
          // 延遲關閉讓 response 送出
          setTimeout(() => {
            clearTimeout(timer);
            server.stop();
            reject(new Error("OAuth state mismatch"));
          }, 100);
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        if (!code) {
          const html = ERROR_HTML("未收到授權碼");
          setTimeout(() => {
            clearTimeout(timer);
            server.stop();
            reject(new Error("No authorization code received"));
          }, 100);
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        // 成功收到 code
        setTimeout(() => {
          clearTimeout(timer);
          server.stop();
          resolve(code);
        }, 100);
        return new Response(SUCCESS_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    });

    // 超時自動關閉
    timer = setTimeout(() => {
      server.stop();
      reject(new Error(`OAuth callback timeout (${timeoutMs / 1000}s)`));
    }, timeoutMs);
  });
}
