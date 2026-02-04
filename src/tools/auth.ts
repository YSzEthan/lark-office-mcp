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
      description: `Submit OAuth authorization code to complete Lark login.

After opening the authorization URL (from lark_auth_url), copy the 'code' parameter from the redirect URL and submit it here.

Args:
  - code (string): Authorization code from OAuth redirect URL

Returns:
  - Success message with token expiration time
  - Base URL of your Lark tenant (automatically detected)

Example:
  - Use when: You have the authorization code from redirect URL
  - lark_auth code=abc123xyz`,
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
      description: `Get the Lark OAuth authorization URL.

Use this to start the OAuth flow. Open the returned URL in a browser to authorize.

Returns:
  - Authorization URL to open in browser
  - Instructions for completing authorization

Example:
  - Use when: You need to authorize or re-authorize the Lark connection`,
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
