/**
 * Lark MCP Server 常數定義
 */

// API 基礎設定
export const BASE_URL = "https://open.larksuite.com/open-apis";

// OAuth Callback Server
export const CALLBACK_PORT = Number(process.env.LARK_CALLBACK_PORT) || 9876;
export const CALLBACK_TIMEOUT_MS = 120_000;

// Streamable HTTP 常駐模式監聽埠（不可與 CALLBACK_PORT 相同，
// oauth-callback 會主動 kill 佔用 CALLBACK_PORT 的 process）
export const HTTP_PORT = Number(process.env.LARK_MCP_PORT) || 3940;

// 回應限制
export const CHARACTER_LIMIT = 25000;
export const MAX_PAGE_SIZE = 200;

// 批次處理
export const BATCH_SIZE = 10;

// Rate Limiting（基於官方文件：單一應用 QPS 3 次/秒）
export const RATE_LIMIT_QPS = 3;
export const RATE_LIMIT_INTERVAL_MS = 340; // 略高於 1000/3 (333ms) 以確保安全

// Retry Configuration
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 10000;

// 單次 fetch 逾時（避免無回應時卡死 documentRateLimiter 的 promise chain，
// 在 --http 常駐模式下這個佇列跨 session 共用，卡住會擋住所有人）
export const REQUEST_TIMEOUT_MS = 30_000;

// Token 檔案路徑
export const TOKEN_FILE_NAME = ".lark-token.json";

// Lark 文件 URL（登入時動態取得）
let larkBaseUrl = "";

export function setLarkBaseUrl(url: string): void {
  larkBaseUrl = url;
}

export function getLarkBaseUrl(): string {
  return larkBaseUrl;
}

export const WIKI_URL = (token: string) => larkBaseUrl ? `${larkBaseUrl}/wiki/${token}` : `wiki://${token}`;
export const DOC_URL = (id: string) => larkBaseUrl ? `${larkBaseUrl}/docx/${id}` : `docx://${id}`;

// 回應格式
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
