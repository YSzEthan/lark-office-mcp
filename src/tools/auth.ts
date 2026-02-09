/**
 * 認證工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LarkAuthSchema, LarkAuthUrlSchema, UserMeSchema, UserGetSchema, UserListSchema } from "../schemas/index.js";
import { exchangeCodeForToken, getAuthorizationUrl, larkRequest } from "../services/lark-client.js";
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
      description: `提交 OAuth 授權碼完成登入。回傳 token 過期時間與 base URL。

Example: lark_auth code=abc123xyz`,
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

  // lark_auth_url: Get authorization URL
  server.registerTool(
    "lark_auth_url",
    {
      title: "Get Lark Authorization URL",
      description: `取得 Lark OAuth 授權連結。回傳授權 URL。

Example: lark_auth_url`,
      inputSchema: LarkAuthUrlSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const url = getAuthorizationUrl();
        return success(
          "Open the following URL to authorize:",
          `${url}\n\nAfter authorization, copy the 'code' parameter from the redirect URL and use lark_auth to submit it.`
        );
      } catch (err) {
        return error("Failed to generate authorization URL", err);
      }
    }
  );

  // user_me: Get current user info
  server.registerTool(
    "user_me",
    {
      title: "Get Current User",
      description: `取得當前用戶資訊。回傳 open_id、name、email。

Example: user_me`,
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
      description: `查詢用戶資訊。回傳 name、email、mobile、department。

Example: user_get user_id=ou_xxxxx`,
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
      description: `列出部門成員。回傳 open_id、name、email。

Example: user_list department_id=0`,
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
