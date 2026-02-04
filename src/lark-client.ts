/**
 * Lark API 客戶端
 * 使用 User Access Token（OAuth 授權流程）
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// 環境變數
const LARK_APP_ID = process.env.LARK_APP_ID || "";
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || "";
const BASE_URL = "https://open.larksuite.com/open-apis";
const REDIRECT_URI = "http://localhost:3000/callback"; // OAuth 回調

// Token 儲存路徑
const TOKEN_FILE = join(homedir(), ".lark-token.json");

// Token 快取
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
let cachedToken: TokenData | null = null;

/**
 * 取得授權連結
 */
export function getAuthorizationUrl(): string {
  // 所有需要的權限
  // 需與 Lark 應用後台已開通的權限一致
  const scopes = [
    "wiki:wiki",
    "drive:drive",         // 雲端硬碟（含文件操作、搜尋）
    "offline_access",
    "task:task:read",
    "task:task:write",
    "task:tasklist:read",
    "task:tasklist:write",
  ];

  // 手動編碼避免 + 號問題
  const scopeStr = scopes.join(" ");
  const redirectParam = encodeURIComponent(REDIRECT_URI);
  const scopeParam = encodeURIComponent(scopeStr);

  return `https://open.larksuite.com/open-apis/authen/v1/authorize?app_id=${LARK_APP_ID}&redirect_uri=${redirectParam}&state=lark_mcp_auth&scope=${scopeParam}`;
}

/**
 * 從檔案載入 Token
 */
function loadTokenFromFile(): TokenData | null {
  try {
    if (existsSync(TOKEN_FILE)) {
      const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
      return data as TokenData;
    }
  } catch {
    // 忽略錯誤
  }
  return null;
}

/**
 * 儲存 Token 到檔案
 */
function saveTokenToFile(token: TokenData): void {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
  } catch (err) {
    console.error("儲存 Token 失敗:", err);
  }
}

/**
 * 用授權碼換取 Token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenData> {
  // 先取得 app_access_token
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
    throw new Error(`取得 App Access Token 失敗: ${appTokenData.msg}`);
  }

  // 用授權碼換取 user_access_token
  const response = await fetch(`${BASE_URL}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appTokenData.app_access_token}`,
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
    throw new Error(`換取 Token 失敗 [${data.code}]: ${data.msg}`);
  }

  const token: TokenData = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: Date.now() + data.data.expires_in * 1000,
  };

  // 儲存並快取
  saveTokenToFile(token);
  cachedToken = token;

  return token;
}

/**
 * 用 Refresh Token 更新 Access Token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  // 先取得 app_access_token
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
    throw new Error(`取得 App Access Token 失敗: ${appTokenData.msg}`);
  }

  // 用 refresh_token 更新
  const response = await fetch(`${BASE_URL}/authen/v1/oidc/refresh_access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appTokenData.app_access_token}`,
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
    throw new Error(`更新 Token 失敗 [${data.code}]: ${data.msg}`);
  }

  const token: TokenData = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: Date.now() + data.data.expires_in * 1000,
  };

  // 儲存並快取
  saveTokenToFile(token);
  cachedToken = token;

  return token;
}

/**
 * 取得 User Access Token（自動處理快取和更新）
 */
export async function getAccessToken(): Promise<string> {
  // 檢查環境變數
  if (!LARK_APP_ID || !LARK_APP_SECRET) {
    throw new Error("環境變數未設定: 需要 LARK_APP_ID 和 LARK_APP_SECRET");
  }

  // 嘗試從快取或檔案載入
  if (!cachedToken) {
    cachedToken = loadTokenFromFile();
  }

  // 檢查快取是否有效（提前 5 分鐘過期）
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.accessToken;
  }

  // 嘗試用 refresh token 更新
  if (cachedToken?.refreshToken) {
    try {
      const newToken = await refreshAccessToken(cachedToken.refreshToken);
      return newToken.accessToken;
    } catch (err) {
      // Refresh 失敗，需要重新授權
      console.error("Refresh Token 失敗:", err);
    }
  }

  // 沒有有效 Token，需要授權
  const authUrl = getAuthorizationUrl();
  throw new Error(
    `需要授權！請完成以下步驟：\n\n` +
    `1. 開啟此連結登入授權：\n${authUrl}\n\n` +
    `2. 授權後會跳轉到一個頁面，複製網址中的 code 參數\n` +
    `   例如: https://example.com/callback?code=XXXXX&state=...\n\n` +
    `3. 使用 lark_auth 工具提交授權碼：\n` +
    `   lark_auth code=XXXXX`
  );
}

/**
 * Lark API 請求
 */
export async function larkRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
    params?: Record<string, string | number>;
  } = {}
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

  // 處理空響應體（某些 API 如 complete、delete 可能返回空響應）
  const text = await response.text();
  if (!text || text.trim() === "") {
    // 空響應視為成功
    return {} as T;
  }

  let data: { code: number; msg: string; data?: T };
  try {
    data = JSON.parse(text) as { code: number; msg: string; data?: T };
  } catch {
    throw new Error(`JSON 解析失敗，響應內容: ${text.substring(0, 200)}`);
  }

  if (data.code !== 0) {
    throw new Error(`Lark API 錯誤 [${data.code}]: ${data.msg}`);
  }

  return data.data as T;
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
): Promise<Array<LarkBlock>> {
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
  const data = await larkRequest<{
    items: Array<{ block_id: string }>;
  }>(`/docx/v1/documents/${documentId}/blocks`, {
    params: { page_size: 1 },
  });

  const blockId = data.items?.[0]?.block_id;
  if (!blockId) {
    throw new Error("無法取得文件根 block ID");
  }

  return blockId;
}

/**
 * 批量插入 blocks（帶自動分批和重試）
 */
export async function insertBlocks(
  documentId: string,
  parentBlockId: string,
  blocks: Array<Record<string, unknown>>,
  index = 0,
  batchSize = 10
): Promise<void> {
  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);

    await larkRequest(`/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`, {
      method: "POST",
      body: {
        children: batch,
        index: index + i,
        document_revision_id: -1,
      },
    });
  }
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
 * Lark Block 類型定義
 */
export interface LarkBlock {
  block_id: string;
  block_type: number;
  parent_id?: string;
  children?: string[];
  text?: LarkTextContent;
  heading1?: LarkTextContent;
  heading2?: LarkTextContent;
  heading3?: LarkTextContent;
  heading4?: LarkTextContent;
  heading5?: LarkTextContent;
  heading6?: LarkTextContent;
  heading7?: LarkTextContent;
  heading8?: LarkTextContent;
  heading9?: LarkTextContent;
  bullet?: LarkTextContent;
  ordered?: LarkTextContent;
  code?: LarkTextContent & { language?: number };
  quote?: LarkTextContent;
  todo?: LarkTextContent & { done?: boolean };
  divider?: Record<string, never>;
  image?: { token?: string };
  table?: { rows?: number; columns?: number };
  callout?: LarkTextContent & { background_color?: number; emoji_id?: string };
}

export interface LarkTextContent {
  elements?: Array<{
    text_run?: {
      content: string;
      text_element_style?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        inline_code?: boolean;
        link?: { url?: string };
      };
    };
    equation?: { content: string };
    mention_user?: { user_id: string };
    mention_doc?: { obj_type: number; token: string };
  }>;
  style?: {
    align?: number;
    folded?: boolean;
  };
}
