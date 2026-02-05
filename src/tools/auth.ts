/**
 * 認證工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LarkAuthSchema, LarkAuthUrlSchema } from "../schemas/index.js";
import { exchangeCodeForToken, getAuthorizationUrl } from "../services/lark-client.js";
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
}
