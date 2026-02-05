/**
 * Lark API 客戶端
 * 使用 User Access Token (OAuth 授權流程)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { BASE_URL, REDIRECT_URI, TOKEN_FILE_NAME, setLarkBaseUrl, BATCH_SIZE } from "../constants.js";
import type { TokenData, LarkBlock } from "../types.js";
import { LarkError } from "../utils/errors.js";
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
 */
export function getAuthorizationUrl(): string {
  const scopes = [
    "wiki:wiki",
    "drive:drive",
    "offline_access",
    "task:task:read",
    "task:task:write",
    "task:tasklist:read",
    "task:tasklist:write",
  ];

  const scopeStr = scopes.join(" ");
  const redirectParam = encodeURIComponent(REDIRECT_URI);
  const scopeParam = encodeURIComponent(scopeStr);

  return `https://open.larksuite.com/open-apis/authen/v1/authorize?app_id=${LARK_APP_ID}&redirect_uri=${redirectParam}&state=lark_mcp_auth&scope=${scopeParam}`;
}

/**
 * 從檔案載入 Token
 */
function loadTokenFromFile(): (TokenData & { baseUrl?: string }) | null {
  try {
    if (existsSync(TOKEN_FILE)) {
      const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
      // 恢復 baseUrl
      if (data.baseUrl) {
        setLarkBaseUrl(data.baseUrl);
      }
      return data;
    }
  } catch {
    // 忽略錯誤
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

    // 嘗試從 Wiki 空間取得
    const wikiResponse = await fetch(`${BASE_URL}/wiki/v2/spaces?page_size=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const wikiData = await wikiResponse.json() as {
      code: number;
      data?: {
        items?: Array<{ space_id?: string }>;
      };
    };

    if (wikiData.data?.items?.[0]?.space_id) {
      const spaceId = wikiData.data.items[0].space_id;
      const nodesResponse = await fetch(`${BASE_URL}/wiki/v2/spaces/${spaceId}/nodes?page_size=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const nodesData = await nodesResponse.json() as {
        code: number;
        data?: {
          items?: Array<{ node_token?: string }>;
        };
      };

      if (nodesData.data?.items?.[0]?.node_token) {
        // 使用 node token 查詢取得 URL
        const nodeToken = nodesData.data.items[0].node_token;
        // Lark API 不直接提供 URL，需要用戶確認 domain
      }
    }

    // 預設使用 larksuite.com
    return "";
  } catch {
    return "";
  }
}

/**
 * 用授權碼換取 Token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenData & { baseUrl: string }> {
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
    throw new Error(`App Access Token failed: ${appTokenData.msg}`);
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
    throw new Error(`Token refresh failed [${data.code}]: ${data.msg}`);
  }

  const token: TokenData = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresAt: Date.now() + data.data.expires_in * 1000,
  };

  // 保留現有的 baseUrl
  const existingData = loadTokenFromFile();
  saveTokenToFile(token, existingData?.baseUrl);
  cachedToken = token;

  return token;
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
      console.error("Refresh Token failed:", err);
    }
  }

  // 沒有有效 Token，需要授權
  const authUrl = getAuthorizationUrl();
  throw new Error(
    `Authorization required!\n\n` +
    `1. Open this URL:\n${authUrl}\n\n` +
    `2. After authorization, copy the 'code' parameter from the redirect URL\n` +
    `   Example: https://example.com/callback?code=XXXXX&state=...\n\n` +
    `3. Use lark_auth tool to submit the code:\n` +
    `   lark_auth code=XXXXX`
  );
}

/**
 * Lark API 請求選項
 */
export interface LarkRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  params?: Record<string, string | number>;
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
  const data = await larkRequest<{
    items: Array<{ block_id: string }>;
  }>(`/docx/v1/documents/${documentId}/blocks`, {
    params: { page_size: 1 },
  });

  const blockId = data.items?.[0]?.block_id;
  if (!blockId) {
    throw new Error("Cannot get document root block ID");
  }

  return blockId;
}

/**
 * 批量插入 blocks (帶自動分批)
 * 使用文件級 Rate Limiter 避免同一文件的並發編輯衝突
 */
export async function insertBlocks(
  documentId: string,
  parentBlockId: string,
  blocks: Array<Record<string, unknown>>,
  index = 0,
  batchSize = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);

    // 使用文件級 Rate Limiter 控制同一文件的編輯頻率
    await documentRateLimiter.throttle(documentId, async () => {
      await larkRequest(`/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children`, {
        method: "POST",
        body: {
          children: batch,
          index: index + i,
          document_revision_id: -1,
        },
        skipRateLimit: true, // 已由 documentRateLimiter 處理
      });
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
