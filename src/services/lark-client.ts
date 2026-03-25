/**
 * Lark API 客戶端
 * 使用 User Access Token (OAuth 授權流程)
 */

import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { BASE_URL, CALLBACK_PORT, TOKEN_FILE_NAME, setLarkBaseUrl, getLarkBaseUrl, BATCH_SIZE } from "../constants.js";
import type { TokenData, LarkBlock } from "../types.js";
import { LarkError } from "../utils/errors.js";
import { startCallbackServer } from "../utils/oauth-callback.js";
import { globalRateLimiter, documentRateLimiter } from "../utils/rate-limiter.js";
import { withRetryAndRefresh } from "../utils/retry.js";

// 環境變數
const LARK_APP_ID = process.env.LARK_APP_ID || "";
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || "";

// Token 儲存路徑
const TOKEN_FILE = join(homedir(), TOKEN_FILE_NAME);

// Token 快取
let cachedToken: TokenData | null = null;

/**
 * 取得授權連結
 * @param port callback server 實際使用的 port
 */
export function getAuthorizationUrl(port: number = CALLBACK_PORT): string {
  const scopes = [
    "wiki:wiki",
    "drive:drive",
    "bitable:app",
    "offline_access",
    "task:task:read",
    "task:task:write",
    "task:tasklist:read",
    "task:tasklist:write",
    "task:section:write",
    "contact:contact.base:readonly",
    "contact:user.base:readonly",
    "contact:user.email:readonly",
  ];

  const redirectUri = `http://localhost:${port}/callback`;
  const scopeStr = scopes.join(" ");
  const redirectParam = encodeURIComponent(redirectUri);
  const scopeParam = encodeURIComponent(scopeStr);

  return `https://open.larksuite.com/open-apis/authen/v1/authorize?app_id=${LARK_APP_ID}&redirect_uri=${redirectParam}&state=lark_mcp_auth&scope=${scopeParam}&app_lang=zh_TW`;
}

/**
 * 從檔案載入 Token
 */
function loadTokenFromFile(): (TokenData & { baseUrl?: string }) | null {
  try {
    const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    // 恢復 baseUrl
    if (data.baseUrl) {
      setLarkBaseUrl(data.baseUrl);
    }
    return data;
  } catch {
    // 忽略錯誤（檔案不存在或 JSON parse 失敗）
  }
  return null;
}

/**
 * 儲存 Token 到檔案
 */
function saveTokenToFile(token: TokenData, baseUrl?: string): void {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify({ ...token, baseUrl }, null, 2));
  } catch (err) {
    console.error("Token save failed:", err);
  }
}

/**
 * 從使用者資訊取得 tenant domain
 */
async function fetchUserTenantDomain(accessToken: string): Promise<string> {
  try {
    const response = await fetch(`${BASE_URL}/authen/v1/user_info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as {
      code: number;
      data?: {
        tenant_key?: string;
        // Lark API 不直接給 domain，需要從其他地方取得
      };
    };

    // 嘗試取得任一文件來獲取實際 URL
    const driveResponse = await fetch(`${BASE_URL}/drive/v1/files?page_size=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const driveData = await driveResponse.json() as {
      code: number;
      data?: {
        files?: Array<{ url?: string }>;
      };
    };

    if (driveData.data?.files?.[0]?.url) {
      // 從文件 URL 提取 base domain
      const url = new URL(driveData.data.files[0].url);
      return `${url.protocol}//${url.host}`;
    }

    // 預設使用 larksuite.com
    return "";
  } catch {
    return "";
  }
}

/**
 * 取得 App Access Token
 */
async function getAppAccessToken(): Promise<string> {
  const appTokenRes = await fetch(`${BASE_URL}/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET,
    }),
  });

  const appTokenData = await appTokenRes.json() as {
    code: number;
    msg: string;
    app_access_token?: string;
  };

  if (appTokenData.code !== 0 || !appTokenData.app_access_token) {
    throw new Error(`App Access Token failed: ${appTokenData.msg}`);
  }

  return appTokenData.app_access_token;
}

/**
 * 用授權碼換取 Token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenData & { baseUrl: string }> {
  const appAccessToken = await getAppAccessToken();

  // 用授權碼換取 user_access_token
  const response = await fetch(`${BASE_URL}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
    }),
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Token exchange failed [${data.code}]: ${data.msg}`);
  }

  const token: TokenData = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: Date.now() + data.data.expires_in * 1000,
  };

  // 動態取得使用者的 tenant domain
  const baseUrl = await fetchUserTenantDomain(token.accessToken);
  if (baseUrl) {
    setLarkBaseUrl(baseUrl);
  }

  // 儲存並快取
  saveTokenToFile(token, baseUrl);
  cachedToken = token;

  return { ...token, baseUrl };
}

/**
 * 用 Refresh Token 更新 Access Token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const appAccessToken = await getAppAccessToken();

  const response = await fetch(`${BASE_URL}/authen/v1/oidc/refresh_access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json() as {
    code: number;
    msg: string;
    data?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };

  if (data.code !== 0 || !data.data) {
    throw new Error(`Token refresh failed [${data.code}]: ${data.msg}`);
  }

  const token: TokenData = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: Date.now() + data.data.expires_in * 1000,
  };

  // 保留現有的 baseUrl
  saveTokenToFile(token, getLarkBaseUrl() || undefined);
  cachedToken = token;

  return token;
}

/**
 * 開啟瀏覽器（跨平台）
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

/**
 * 自動重新授權：啟動 callback server → 開啟瀏覽器 → 等 callback → 交換 token
 * callback server 會自動尋找可用 port（若預設 port 被佔用）
 */
export async function autoReAuth(): Promise<TokenData> {
  // 先啟動 callback server（自動處理 port 衝突）
  const { port, codePromise } = startCallbackServer();

  // 用實際 port 產生 auth URL，再開瀏覽器
  const authUrl = getAuthorizationUrl(port);
  openBrowser(authUrl);

  const code = await codePromise;
  return exchangeCodeForToken(code);
}

/**
 * 取得 User Access Token (自動處理快取和更新)
 */
export async function getAccessToken(): Promise<string> {
  if (!LARK_APP_ID || !LARK_APP_SECRET) {
    throw new Error("Environment variables not set: LARK_APP_ID and LARK_APP_SECRET required");
  }

  if (!cachedToken) {
    cachedToken = loadTokenFromFile();
  }

  // 檢查快取是否有效 (提前 5 分鐘過期)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.accessToken;
  }

  // 嘗試用 refresh token 更新
  if (cachedToken?.refreshToken) {
    try {
      const newToken = await refreshAccessToken(cachedToken.refreshToken);
      return newToken.accessToken;
    } catch (err) {
      console.error("Refresh Token failed, starting auto re-auth...");
    }
  }

  // 沒有有效 Token，自動啟動授權流程
  const token = await autoReAuth();
  return token.accessToken;
}

/**
 * Lark API 請求選項
 */
export interface LarkRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  /** 跳過 Rate Limiting（當已由 documentRateLimiter 處理時使用） */
  skipRateLimit?: boolean;
  /** 跳過重試機制 */
  skipRetry?: boolean;
}

/**
 * Lark API 請求（內部實作）
 */
async function executeRequest<T>(
  endpoint: string,
  options: LarkRequestOptions
): Promise<T> {
  const token = await getAccessToken();
  const { method = "GET", body, params } = options;

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.append(key, String(value));
    }
    url += `?${searchParams.toString()}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  if (!text || text.trim() === "") {
    return {} as T;
  }

  let data: { code: number; msg: string; data?: T };
  try {
    data = JSON.parse(text) as { code: number; msg: string; data?: T };
  } catch {
    throw new Error(`JSON parse failed: ${text.substring(0, 200)}`);
  }

  if (data.code !== 0) {
    // 使用 LarkError 提供結構化錯誤資訊
    throw new LarkError(data.code, data.msg, endpoint);
  }

  return data.data as T;
}

/**
 * Lark API 請求
 * 整合 Rate Limiting 和重試機制
 */
export async function larkRequest<T = unknown>(
  endpoint: string,
  options: LarkRequestOptions = {}
): Promise<T> {
  // 建立執行函數
  const execute = () => executeRequest<T>(endpoint, options);

  // 套用 Rate Limiting
  const rateLimitedRequest = options.skipRateLimit
    ? execute
    : () => globalRateLimiter.throttle(execute);

  // 跳過重試機制
  if (options.skipRetry) {
    return rateLimitedRequest();
  }

  // 套用重試機制（包含 Token 自動刷新）
  return withRetryAndRefresh(
    rateLimitedRequest,
    async () => {
      // 嘗試刷新 Token
      if (cachedToken?.refreshToken) {
        await refreshAccessToken(cachedToken.refreshToken);
      }
    },
    {
      onRetry: (attempt, error, delay) => {
        console.error(`[Lark API] Retry ${attempt} for ${endpoint} after ${delay}ms: ${error.message}`);
      },
    }
  );
}

/**
 * 取得 Wiki 節點資訊
 */
export async function getWikiNode(wikiToken: string): Promise<{
  objToken: string;
  objType: string;
  spaceId: string;
}> {
  const data = await larkRequest<{
    node: {
      obj_token: string;
      obj_type: string;
      space_id: string;
    };
  }>("/wiki/v2/spaces/get_node", {
    params: { token: wikiToken },
  });

  return {
    objToken: data.node.obj_token,
    objType: data.node.obj_type,
    spaceId: data.node.space_id,
  };
}

/**
 * 取得文件的所有 blocks
 */
export async function getDocumentBlocks(
  documentId: string,
  pageSize = 500
): Promise<LarkBlock[]> {
  const allBlocks: LarkBlock[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string | number> = { page_size: pageSize };
    if (pageToken) {
      params.page_token = pageToken;
    }

    const data = await larkRequest<{
      items: LarkBlock[];
      page_token?: string;
      has_more?: boolean;
    }>(`/docx/v1/documents/${documentId}/blocks`, { params });

    allBlocks.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);

  return allBlocks;
}

/**
 * 取得文件根 block ID
 */
export async function getDocumentRootBlockId(documentId: string): Promise<string> {
  // Lark docx API 的 root block ID 等於 document ID
  return documentId;
}

/**
 * 刪除文件中指定範圍的子 blocks
 */
export async function deleteBlockRange(
  documentId: string,
  parentBlockId: string,
  startIndex: number,
  endIndex: number
): Promise<void> {
  await larkRequest(`/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children/batch_delete`, {
    method: "DELETE",
    body: {
      document_revision_id: -1,
      start_index: startIndex,
      end_index: endIndex,
    },
  });
}

/**
 * 插入表格 block（三步驟流程）
 * 1. 建立空表格 → 取得 cell IDs
 * 2. 逐一填入每個 cell 的內容
 */
async function insertTableBlock(
  documentId: string,
  parentBlockId: string,
  block: Record<string, unknown>,
  index: number
): Promise<void> {
  // 提取 cell 內容並移除 metadata
  const cellContents = block._cellContents as Array<Record<string, unknown>> | undefined;
  const tableBlock = { ...block };
  delete tableBlock._cellContents;

  // Step 1: 建立空表格
  const response = await documentRateLimiter.throttle(documentId, () =>
    larkRequest<{
      children?: Array<{
        block_id?: string;
        table?: { cells?: string[] };
      }>;
    }>(`/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`, {
      method: "POST",
      body: {
        children: [tableBlock],
        index,
        document_revision_id: -1,
      },
      skipRateLimit: true,
    })
  );

  // Step 2: 取得 cell IDs
  const cellIds = response?.children?.[0]?.table?.cells || [];

  if (!cellContents || cellIds.length === 0) {
    return; // 沒有內容或建立失敗
  }

  // Step 3: 填入每個 cell 的內容
  for (let i = 0; i < cellContents.length && i < cellIds.length; i++) {
    await documentRateLimiter.throttle(documentId, () =>
      larkRequest(`/docx/v1/documents/${documentId}/blocks/${cellIds[i]}/children`, {
        method: "POST",
        body: {
          children: [{ block_type: 2, text: cellContents[i] }],
          index: 0,
          document_revision_id: -1,
        },
        skipRateLimit: true,
      })
    );
  }
}

/**
 * 插入單一 block 並回傳新的 block_id
 */
export async function insertSingleBlock(
  documentId: string,
  parentBlockId: string,
  block: Record<string, unknown>,
  index: number
): Promise<string> {
  const data = await documentRateLimiter.throttle(documentId, () =>
    larkRequest<{ children?: Array<{ block_id?: string }> }>(
      `/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`,
      {
        method: "POST",
        body: {
          children: [block],
          index,
          document_revision_id: -1,
        },
        skipRateLimit: true,
      }
    )
  );
  const newId = data.children?.[0]?.block_id;
  if (!newId) throw new Error("Failed to get new block ID after insert");
  return newId;
}

/**
 * 批量插入 blocks (帶自動分批)
 * 使用文件級 Rate Limiter 避免同一文件的並發編輯衝突
 * 支援表格 block 的三步驟插入流程
 */
export async function insertBlocks(
  documentId: string,
  parentBlockId: string,
  blocks: Array<Record<string, unknown>>,
  index = 0,
  batchSize = BATCH_SIZE
): Promise<void> {
  let currentIndex = index;
  let normalBatch: Array<Record<string, unknown>> = [];

  // 輔助函數：flush 一般 blocks 批次
  const flushNormalBatch = async () => {
    if (normalBatch.length === 0) return;

    for (let i = 0; i < normalBatch.length; i += batchSize) {
      const batch = normalBatch.slice(i, i + batchSize);
      await documentRateLimiter.throttle(documentId, async () => {
        await larkRequest(`/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`, {
          method: "POST",
          body: {
            children: batch,
            index: currentIndex,
            document_revision_id: -1,
          },
          skipRateLimit: true,
        });
      });
      currentIndex += batch.length;
    }
    normalBatch = [];
  };

  // 遍歷所有 blocks
  for (const block of blocks) {
    if (block._cellContents) {
      // 表格 block：先 flush 一般批次，再處理表格
      await flushNormalBatch();
      await insertTableBlock(documentId, parentBlockId, block, currentIndex);
      currentIndex += 1;
    } else if (block._children) {
      // 容器 block（Callout、Quote 等）：先 flush，建立父 block，再遞迴插入 children
      await flushNormalBatch();
      const children = block._children as Array<Record<string, unknown>>;
      const { _children, ...cleanBlock } = block;
      const newBlockId = await insertSingleBlock(documentId, parentBlockId, cleanBlock, currentIndex);
      currentIndex += 1;
      await insertBlocks(documentId, newBlockId, children, 0, batchSize);
    } else {
      // 一般 block：累積到批次
      normalBatch.push(block);
    }
  }

  // 處理剩餘的一般 blocks
  await flushNormalBatch();
}

/**
 * 批次更新多個 blocks 的內容
 * 使用文件級 Rate Limiter 避免同一文件的並發編輯衝突
 */
export async function batchUpdateBlocks(
  documentId: string,
  requests: Array<{
    block_id: string;
    update_text_elements: { elements: Array<Record<string, unknown>> };
  }>
): Promise<void> {
  await documentRateLimiter.throttle(documentId, () =>
    larkRequest(`/docx/v1/documents/${documentId}/blocks/batch_update`, {
      method: "PATCH",
      body: {
        requests,
        document_revision_id: -1,
      },
      skipRateLimit: true,
    })
  );
}

/**
 * 建立新文件
 */
export async function createDocument(
  folderToken: string,
  title: string
): Promise<{ documentId: string; revisionId: number }> {
  const data = await larkRequest<{
    document: {
      document_id: string;
      revision_id: number;
    };
  }>("/docx/v1/documents", {
    method: "POST",
    body: {
      folder_token: folderToken,
      title,
    },
  });

  return {
    documentId: data.document.document_id,
    revisionId: data.document.revision_id,
  };
}

/**
 * 解析 Sheet token (格式: app_token_table_id)
 */
export function parseSheetToken(sheetToken: string): { appToken: string; tableId: string } | null {
  // Sheet token 格式: {app_token}_{table_id}
  // app_token 通常是固定長度，table_id 在最後一個 _ 之後
  const lastUnderscoreIndex = sheetToken.lastIndexOf("_");
  if (lastUnderscoreIndex === -1) {
    return null;
  }

  return {
    appToken: sheetToken.substring(0, lastUnderscoreIndex),
    tableId: sheetToken.substring(lastUnderscoreIndex + 1),
  };
}

/**
 * 獲取 Bitable 欄位定義
 */
export async function getBitableFields(
  appToken: string,
  tableId: string
): Promise<Array<{ field_id: string; field_name: string; type: number }>> {
  const data = await larkRequest<{
    items?: Array<{
      field_id?: string;
      field_name?: string;
      type?: number;
    }>;
  }>(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
    params: { page_size: 100 },
  });

  return (data.items || []).map((field) => ({
    field_id: field.field_id || "",
    field_name: field.field_name || "",
    type: field.type || 0,
  }));
}

/**
 * 獲取 Bitable 記錄
 */
export async function getBitableRecords(
  appToken: string,
  tableId: string,
  pageSize = 100
): Promise<Array<{ record_id: string; fields: Record<string, unknown> }>> {
  const data = await larkRequest<{
    items?: Array<{
      record_id?: string;
      fields?: Record<string, unknown>;
    }>;
  }>(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    params: { page_size: pageSize },
  });

  return (data.items || []).map((record) => ({
    record_id: record.record_id || "",
    fields: record.fields || {},
  }));
}

/**
 * 獲取 Sheet 內容並轉換為 Markdown 表格
 */
export async function getSheetAsMarkdown(sheetToken: string): Promise<string | null> {
  const parsed = parseSheetToken(sheetToken);
  if (!parsed) {
    return null;
  }

  try {
    const [fields, records] = await Promise.all([
      getBitableFields(parsed.appToken, parsed.tableId),
      getBitableRecords(parsed.appToken, parsed.tableId),
    ]);

    if (fields.length === 0) {
      return "[Empty table]";
    }

    // 建立表頭
    const headers = fields.map((f) => f.field_name);
    const lines: string[] = [];

    // 表頭行
    lines.push(`| ${headers.join(" | ")} |`);
    // 分隔行
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

    // 資料行
    for (const record of records) {
      const cells = fields.map((field) => {
        const value = record.fields[field.field_name];
        return formatBitableValue(value);
      });
      lines.push(`| ${cells.join(" | ")} |`);
    }

    return lines.join("\n");
  } catch (err) {
    // 如果無法讀取，返回連結
    return `📊 [sheet](lark://sheet/${sheetToken})`;
  }
}

/**
 * 格式化 Bitable 欄位值
 */
function formatBitableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  // 處理陣列（多選、人員等）
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === "object" && v !== null) {
        // 人員欄位
        if ("name" in v) return (v as { name: string }).name;
        // 連結欄位
        if ("text" in v) return (v as { text: string }).text;
        // 其他物件
        return JSON.stringify(v);
      }
      return String(v);
    }).join(", ");
  }

  // 處理物件
  if (typeof value === "object") {
    // 人員欄位（單選）
    if ("name" in value) return (value as { name: string }).name;
    // 連結欄位
    if ("text" in value) return (value as { text: string }).text;
    // 其他物件
    return JSON.stringify(value);
  }

  // 清理字串（移除換行和管道符）
  return String(value).replace(/[\n\r|]/g, " ").trim();
}
