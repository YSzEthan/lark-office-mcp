/**
 * Lark MCP Server 常數定義
 */

// API 基礎設定
export const BASE_URL = "https://open.larksuite.com/open-apis";
export const REDIRECT_URI = "http://localhost:3000/callback";

// 回應限制
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// 批次處理
export const BATCH_SIZE = 10;

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
