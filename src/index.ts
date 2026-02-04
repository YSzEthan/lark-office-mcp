#!/usr/bin/env node
/**
 * Lark MCP Server - 精簡版
 *
 * 解決的問題：
 * 1. 工具定義過大（30,000+ tokens → 精簡 schema）
 * 2. API 回應過於詳盡（88,946 字符 → Markdown 純文字）
 * 3. 批量插入失敗（自動分批 + 重試）
 *
 * 工具分類：
 * - 認證工具：lark_auth
 * - Wiki 工具：wiki_read, wiki_prepend, wiki_append, wiki_insert_blocks, wiki_search, wiki_list_nodes
 * - 文件工具：doc_create, doc_read, doc_update, doc_delete, doc_insert_blocks, doc_search
 * - 待辦事項工具：todo_create, todo_list, todo_search, todo_complete, todo_update, todo_delete
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { wikiTools, handleWikiTool } from "./tools/wiki.js";
import { docTools, handleDocTool } from "./tools/doc.js";
import { todoTools, handleTodoTool } from "./tools/todo.js";
import { success, error } from "./utils/response.js";
import { exchangeCodeForToken, getAuthorizationUrl } from "./lark-client.js";

// =============================================================================
// MCP Server 設定
// =============================================================================

const server = new Server(
  {
    name: "lark-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// 認證工具
// =============================================================================

const authTools = [
  {
    name: "lark_auth",
    description: "Lark 授權認證 - 提交授權碼完成 OAuth 登入",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "從授權頁面取得的授權碼（code 參數）",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "lark_auth_url",
    description: "取得 Lark 授權連結",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

/**
 * 處理認證工具呼叫
 */
async function handleAuthTool(
  name: string,
  args: Record<string, unknown>
) {
  try {
    if (name === "lark_auth") {
      const code = args.code as string;
      if (!code) {
        return error("缺少 code 參數");
      }

      const token = await exchangeCodeForToken(code);
      return success("✅ 授權成功！Token 已儲存到 ~/.lark-token.json", {
        expiresAt: new Date(token.expiresAt).toISOString(),
      });
    }

    if (name === "lark_auth_url") {
      const url = getAuthorizationUrl();
      return success(
        "🔗 請開啟以下連結進行授權：\n\n" +
        `${url}\n\n` +
        "授權後複製網址中的 code 參數，使用 lark_auth 工具提交"
      );
    }

    return error(`未知的認證工具: ${name}`);
  } catch (err) {
    return error("認證操作失敗", err);
  }
}

// =============================================================================
// 工具清單
// =============================================================================

const allTools = [...authTools, ...wikiTools, ...docTools, ...todoTools];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

// =============================================================================
// 工具呼叫處理
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args || {}) as Record<string, unknown>;

  // 認證工具
  if (name.startsWith("lark_auth")) {
    return handleAuthTool(name, toolArgs);
  }

  // Wiki 工具（含 search_all）
  if (name.startsWith("wiki_") || name === "search_all") {
    return handleWikiTool(name, toolArgs);
  }

  // 文件工具（含雲端硬碟）
  if (name.startsWith("doc_") || name.startsWith("drive_")) {
    return handleDocTool(name, toolArgs);
  }

  // 待辦事項工具（含任務清單）
  if (name.startsWith("todo_") || name.startsWith("tasklist_")) {
    return handleTodoTool(name, toolArgs);
  }

  return error(`未知的工具: ${name}`);
});

// =============================================================================
// 啟動伺服器
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lark MCP Server v2.0.0 已啟動");
  console.error(`已載入 ${allTools.length} 個工具`);
}

main().catch((err) => {
  console.error("伺服器啟動失敗:", err);
  process.exit(1);
});
