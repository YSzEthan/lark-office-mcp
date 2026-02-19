/**
 * 認證工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LarkAuthSchema, LarkAuthUrlSchema, UserMeSchema, UserGetSchema, UserListSchema } from "../schemas/index.js";
import { exchangeCodeForToken, autoReAuth, larkRequest } from "../services/lark-client.js";
import { success, error } from "../utils/response.js";
import { getLarkBaseUrl } from "../constants.js";

/**
 * 註冊認證工具
 */
export function registerAuthTools(server: McpServer): void {
  // lark_auth: Submit authorization code
  server.registerTool(
    "lark_auth",
    {
      title: "Lark OAuth Authorization",
      description: `提交 OAuth 授權碼完成登入。

Args:
  - code (string): 從授權頁面取得的授權碼（必填）

Returns:
  {
    "expires_at": string,  // Token 過期時間（ISO 8601）
    "base_url": string     // Lark API base URL
  }

Examples:
  - 提交授權碼: lark_auth code=abc123xyz`,
      inputSchema: LarkAuthSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { code } = params;
        const token = await exchangeCodeForToken(code);

        const baseUrl = getLarkBaseUrl();
        return success("Authorization successful! Token saved.", {
          expires_at: new Date(token.expiresAt).toISOString(),
          base_url: baseUrl || "(not detected, URLs will use fallback format)",
        });
      } catch (err) {
        return error("Authorization failed", err);
      }
    }
  );

  // lark_auth_url: Auto OAuth authorization
  server.registerTool(
    "lark_auth_url",
    {
      title: "Lark Auto Authorization",
      description: `自動完成 Lark OAuth 授權。

自動開啟瀏覽器並啟動 callback server，使用者只需在瀏覽器點「同意」即可完成授權。
若預設 port 3000 被佔用，會自動嘗試下一個可用 port。
超時 120 秒未完成則自動取消。

Args:
  無參數

Returns:
  {
    "expires_at": string,  // Token 過期時間（ISO 8601）
    "base_url": string     // Lark base URL
  }

Examples:
  - 執行授權: lark_auth_url`,
      inputSchema: LarkAuthUrlSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const token = await autoReAuth();
        const baseUrl = getLarkBaseUrl();
        return success("授權成功！Token 已儲存。", {
          expires_at: new Date(token.expiresAt).toISOString(),
          base_url: baseUrl || "(not detected, URLs will use fallback format)",
        });
      } catch (err) {
        return error("Auto authorization failed. Use lark_auth as fallback.", err);
      }
    }
  );

  // user_me: Get current user info
  server.registerTool(
    "user_me",
    {
      title: "Get Current User",
      description: `取得當前登入用戶的資訊。

Args:
  無參數

Returns:
  {
    "open_id": string,   // 用戶 Open ID
    "user_id": string,   // 用戶 ID
    "name": string,      // 用戶名稱
    "en_name": string,   // 英文名稱
    "email": string,     // 電子郵件
    "mobile": string     // 手機號碼
  }

Examples:
  - 取得當前用戶: user_me`,
      inputSchema: UserMeSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const data = await larkRequest<{
          open_id?: string;
          user_id?: string;
          name?: string;
          en_name?: string;
          email?: string;
          mobile?: string;
          avatar_url?: string;
        }>("/authen/v1/user_info");

        return success("Current user info", {
          open_id: data.open_id,
          user_id: data.user_id,
          name: data.name,
          en_name: data.en_name,
          email: data.email,
          mobile: data.mobile,
        });
      } catch (err) {
        return error("Failed to get current user info", err);
      }
    }
  );

  // user_get: Get user by ID
  server.registerTool(
    "user_get",
    {
      title: "Get User by ID",
      description: `根據用戶 ID 查詢用戶資訊。

Args:
  - user_id (string): 用戶 ID，支援 open_id 或 user_id 格式（必填）

Returns:
  {
    "open_id": string,        // 用戶 Open ID
    "user_id": string,        // 用戶 ID
    "name": string,           // 用戶名稱
    "en_name": string,        // 英文名稱
    "email": string,          // 電子郵件
    "mobile": string,         // 手機號碼
    "department_ids": array   // 所屬部門 ID 列表
  }

Examples:
  - 查詢用戶: user_get user_id=ou_xxxxx

Permissions:
  - contact:user.base:readonly`,
      inputSchema: UserGetSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { user_id } = params;

        const data = await larkRequest<{
          user?: {
            open_id?: string;
            user_id?: string;
            name?: string;
            en_name?: string;
            email?: string;
            mobile?: string;
            department_ids?: string[];
          };
        }>(`/contact/v3/users/${user_id}`, {
          params: { user_id_type: "open_id" },
        });

        const user = data.user;
        return success("User info", {
          open_id: user?.open_id,
          user_id: user?.user_id,
          name: user?.name,
          en_name: user?.en_name,
          email: user?.email,
          mobile: user?.mobile,
          department_ids: user?.department_ids,
        });
      } catch (err) {
        return error("Failed to get user info", err);
      }
    }
  );

  // user_list: List users in department
  server.registerTool(
    "user_list",
    {
      title: "List Department Users",
      description: `列出指定部門的成員。

Args:
  - department_id (string, optional): 部門 ID，不填則列出根部門 "0"
  - limit (number, optional): 最大結果數，預設 20，範圍 1-100
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  [
    {
      "open_id": string,  // 用戶 Open ID
      "name": string,     // 用戶名稱
      "email": string     // 電子郵件
    }
  ]

Examples:
  - 列出根部門成員: user_list
  - 列出指定部門: user_list department_id=od_xxxxx

Permissions:
  - contact:contact.base:readonly`,
      inputSchema: UserListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { department_id, limit, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{
            open_id?: string;
            user_id?: string;
            name?: string;
            en_name?: string;
            email?: string;
            mobile?: string;
          }>;
          has_more?: boolean;
        }>(`/contact/v3/users`, {
          params: {
            department_id: department_id || "0",
            page_size: limit,
          },
        });

        const users = (data.items || []).map((u) => ({
          open_id: u.open_id,
          name: u.name,
          email: u.email,
        }));

        let message = `Found ${users.length} users`;
        if (data.has_more) {
          message += " (more available)";
        }

        return success(message, users, response_format);
      } catch (err) {
        return error("Failed to list users", err);
      }
    }
  );
}
