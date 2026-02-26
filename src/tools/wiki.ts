/**
 * Wiki 工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  WikiReadSchema,
  WikiContentSchema,
  WikiUpdateSchema,
  WikiInsertBlocksSchema,
  WikiDeleteBlocksSchema,
  WikiListNodesSchema,
  WikiSpacesSchema,
  WikiCreateNodeSchema,
  WikiMoveNodeSchema,
  SearchAllSchema,
  WikiUrlOutputSchema,
  WikiCreateNodeOutputSchema,
  WikiMoveNodeOutputSchema,
  WikiListNodesOutputSchema,
  WikiSpacesOutputSchema,
  SearchAllOutputSchema,
} from "../schemas/index.js";
import {
  getWikiNode,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../services/lark-client.js";
import { blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifyNodeList, simplifySearchResults, truncate, paginatedResponse } from "../utils/response.js";
import { WIKI_URL, ResponseFormat } from "../constants.js";

/**
 * 註冊 Wiki 工具
 */
export function registerWikiTools(server: McpServer): void {
  // wiki_read
  server.registerTool(
    "wiki_read",
    {
      title: "Read Wiki Document",
      description: `讀取 Wiki 頁面內容，回傳原始 Lark blocks 陣列。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）

Returns:
  Lark Block 陣列（原始格式）。需要顯示給用戶時，使用 blocks_to_markdown 轉換為 Markdown。

Examples:
  - 讀取 Wiki 頁面: wiki_read wiki_token=wikcnXXXXX

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need Markdown format (use wiki_read then blocks_to_markdown)
  - You need to read a standalone document (use doc_read instead)`,
      inputSchema: WikiReadSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token } = params;
        const node = await getWikiNode(wiki_token);
        const blocks = await getDocumentBlocks(node.objToken);

        return success("Wiki read successful", blocks);
      } catch (err) {
        return error("Wiki read failed", err);
      }
    }
  );

  // wiki_prepend
  server.registerTool(
    "wiki_prepend",
    {
      title: "Prepend to Wiki",
      description: `在 Wiki 頁面頂部插入內容。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）
  - blocks (array): Lark Block JSON 陣列（必填）

Returns:
  {
    "wiki_url": string  // Wiki 頁面 URL
  }

Examples:
  - 插入標題: wiki_prepend wiki_token=wikcnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"Title"}}]}}]
  - 插入段落: wiki_prepend wiki_token=wikcnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"Hello"}}]}}]

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to insert at a specific position (use wiki_insert_blocks instead)
  - You need to replace content (use wiki_update instead)`,
      inputSchema: WikiContentSchema,
      outputSchema: WikiUrlOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, blocks } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);

        await insertBlocks(node.objToken, rootBlockId, blocks, 0);

        return success(`Inserted ${blocks.length} blocks at top of Wiki`, {
          wiki_url: WIKI_URL(wiki_token),
        });
      } catch (err) {
        return error("Wiki prepend failed", err);
      }
    }
  );

  // wiki_append
  server.registerTool(
    "wiki_append",
    {
      title: "Append to Wiki",
      description: `在 Wiki 頁面底部追加內容。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）
  - blocks (array): Lark Block JSON 陣列（必填）

Returns:
  {
    "wiki_url": string  // Wiki 頁面 URL
  }

Examples:
  - 追加頁尾: wiki_append wiki_token=wikcnXXXXX blocks=[{"block_type":4,"heading2":{"elements":[{"text_run":{"content":"Footer"}}]}}]

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to insert at a specific position (use wiki_insert_blocks instead)
  - You need to replace content (use wiki_update instead)`,
      inputSchema: WikiContentSchema,
      outputSchema: WikiUrlOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, blocks } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const existingBlocks = await getDocumentBlocks(node.objToken);
        const insertIndex = Math.max(0, existingBlocks.length - 1);

        await insertBlocks(node.objToken, rootBlockId, blocks, insertIndex);

        return success(`Appended ${blocks.length} blocks to Wiki`, {
          wiki_url: WIKI_URL(wiki_token),
        });
      } catch (err) {
        return error("Wiki append failed", err);
      }
    }
  );

  // wiki_update
  server.registerTool(
    "wiki_update",
    {
      title: "Update Wiki Content",
      description: `更新 Wiki 頁面內容。支援範圍更新或全文重寫。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）
  - blocks (array): Lark Block JSON 陣列（必填）
  - start_index (number, optional): 範圍更新起始位置
  - end_index (number, optional): 範圍更新結束位置（不包含）

Returns:
  {
    "wiki_url": string  // Wiki 頁面 URL
  }

Examples:
  - 全文重寫: wiki_update wiki_token=wikcnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"New Content"}}]}}]
  - 範圍更新: wiki_update wiki_token=wikcnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"Replaced"}}]}}] start_index=0 end_index=3

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You only need to append content (use wiki_append instead)
  - You only need to prepend content (use wiki_prepend instead)`,
      inputSchema: WikiUpdateSchema,
      outputSchema: WikiUrlOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, blocks, start_index, end_index } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const isRangeUpdate = start_index !== undefined && end_index !== undefined;

        const hasTable = blocks.some((b: Record<string, unknown>) => b._cellContents);

        if (isRangeUpdate) {
          if (start_index < 0 || end_index <= start_index) {
            return error("Invalid range (end_index must be greater than start_index)");
          }

          await larkRequest(`/docx/v1/documents/${node.objToken}/blocks/${rootBlockId}/children/batch_delete`, {
            method: "DELETE",
            body: {
              document_revision_id: -1,
              start_index,
              end_index,
            },
          });

          // 表格需要等待文件狀態同步
          if (hasTable) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          await insertBlocks(node.objToken, rootBlockId, blocks, start_index);

          return success(
            `Wiki range update: deleted ${end_index - start_index} blocks, inserted ${blocks.length} blocks`,
            { wiki_url: WIKI_URL(wiki_token) }
          );
        } else {
          const existingBlocks = await getDocumentBlocks(node.objToken);
          const childBlockIds = existingBlocks
            .filter((b) => b.parent_id === rootBlockId && b.block_id !== rootBlockId)
            .map((b) => b.block_id);

          if (childBlockIds.length > 0) {
            await larkRequest(`/docx/v1/documents/${node.objToken}/blocks/${rootBlockId}/children/batch_delete`, {
              method: "DELETE",
              body: {
                document_revision_id: -1,
                start_index: 0,
                end_index: childBlockIds.length,
              },
            });

            // 表格需要等待文件狀態同步
            if (hasTable) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          await insertBlocks(node.objToken, rootBlockId, blocks, 0);

          return success(`Wiki update: inserted ${blocks.length} blocks`, {
            wiki_url: WIKI_URL(wiki_token),
          });
        }
      } catch (err) {
        return error("Wiki update failed", err);
      }
    }
  );

  // wiki_insert_blocks
  server.registerTool(
    "wiki_insert_blocks",
    {
      title: "Insert Blocks to Wiki",
      description: `在 Wiki 頁面指定位置插入內容。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）
  - blocks (array): Lark Block JSON 陣列（必填）
  - index (number, optional): 插入位置，從 0 開始，預設 0

Returns:
  {
    "wiki_url": string  // Wiki 頁面 URL
  }

Examples:
  - 在開頭插入: wiki_insert_blocks wiki_token=wikcnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"Title"}}]}}]
  - 在指定位置: wiki_insert_blocks wiki_token=wikcnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"New"}}]}}] index=5

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You want to append at the end (use wiki_append instead)
  - You want to prepend at the top (use wiki_prepend instead)`,
      inputSchema: WikiInsertBlocksSchema,
      outputSchema: WikiUrlOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, blocks, index } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);

        await insertBlocks(node.objToken, rootBlockId, blocks, index);

        return success(`Inserted ${blocks.length} blocks at position ${index}`, {
          wiki_url: WIKI_URL(wiki_token),
        });
      } catch (err) {
        return error("Wiki insert blocks failed", err);
      }
    }
  );

  // wiki_delete_blocks
  server.registerTool(
    "wiki_delete_blocks",
    {
      title: "Delete Wiki Blocks",
      description: `刪除 Wiki 頁面指定範圍的區塊。此操作不可逆。

Args:
  - wiki_token (string): Wiki 節點 Token（必填）
  - start_index (number): 起始位置，從 0 開始（必填）
  - end_index (number): 結束位置，不包含（必填）

Returns:
  {
    "wiki_url": string  // Wiki 頁面 URL
  }

Examples:
  - 刪除區塊: wiki_delete_blocks wiki_token=wikcnXXXXX start_index=2 end_index=5

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to replace content (use wiki_update with range instead)`,
      inputSchema: WikiDeleteBlocksSchema,
      outputSchema: WikiUrlOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, start_index, end_index } = params;

        if (start_index < 0 || end_index <= start_index) {
          return error("Invalid range (end_index must be greater than start_index)");
        }

        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);

        await larkRequest(`/docx/v1/documents/${node.objToken}/blocks/${rootBlockId}/children/batch_delete`, {
          method: "DELETE",
          body: {
            document_revision_id: -1,
            start_index,
            end_index,
          },
        });

        return success(`Deleted ${end_index - start_index} blocks (index ${start_index} to ${end_index})`, {
          wiki_url: WIKI_URL(wiki_token),
        });
      } catch (err) {
        return error("Wiki delete blocks failed", err);
      }
    }
  );

  // wiki_list_nodes
  server.registerTool(
    "wiki_list_nodes",
    {
      title: "List Wiki Nodes",
      description: `列出 Wiki 空間中的節點（頁面）。

Args:
  - space_id (string): Wiki 空間 ID（必填）
  - parent_node_token (string, optional): 父節點 Token，不填則列出根節點
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  [
    {
      "token": string,        // 節點 Token
      "title": string,        // 節點標題
      "type": string,         // 類型
      "has_children": boolean // 是否有子節點
    }
  ]

Examples:
  - 列出根節點: wiki_list_nodes space_id=7XXXXXX
  - 列出子節點: wiki_list_nodes space_id=7XXXXXX parent_node_token=wikcnXXX

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to search across spaces (use lark_search instead)`,
      inputSchema: WikiListNodesSchema,
      outputSchema: WikiListNodesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { space_id, parent_node_token, limit, offset, response_format } = params;

        const reqParams: Record<string, string | number> = { page_size: limit };
        if (parent_node_token) {
          reqParams.parent_node_token = parent_node_token;
        }

        const data = await larkRequest<{
          items?: Array<{
            node_token?: string;
            obj_token?: string;
            title?: string;
            obj_type?: string;
            has_child?: boolean;
          }>;
          has_more?: boolean;
        }>(`/wiki/v2/spaces/${space_id}/nodes`, { params: reqParams });

        const simplified = simplifyNodeList(data.items || []);
        return paginatedResponse(simplified, !!data.has_more, offset || 0, `Found ${simplified.length} nodes`, response_format);
      } catch (err) {
        return error("Wiki list nodes failed", err);
      }
    }
  );

  // wiki_create_node
  server.registerTool(
    "wiki_create_node",
    {
      title: "Create Wiki Node",
      description: `在 Wiki 空間中建立新節點（頁面）。

Args:
  - space_id (string): Wiki 空間 ID（必填）
  - title (string): 節點標題（必填，最多 200 字元）
  - parent_node_token (string, optional): 父節點 Token，不填則建立在根目錄
  - obj_type (string, optional): 節點類型 doc/docx/sheet/bitable/mindnote/file，預設 docx
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  {
    "node_token": string,  // 新節點 Token
    "obj_token": string,   // 文件 Token
    "title": string,       // 節點標題
    "wiki_url": string     // Wiki 頁面 URL
  }

Examples:
  - 建立根目錄節點: wiki_create_node space_id=7XXXXXX title="New Page"
  - 建立子節點: wiki_create_node space_id=7XXXXXX title="Sub Page" parent_node_token=wikcnXXX
  - 建立試算表: wiki_create_node space_id=7XXXXXX title="Data" obj_type="sheet"

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a standalone document (use doc_create instead)`,
      inputSchema: WikiCreateNodeSchema,
      outputSchema: WikiCreateNodeOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { space_id, title, parent_node_token, obj_type, response_format } = params;

        const body: Record<string, unknown> = {
          obj_type: obj_type || "docx",
          title,
        };

        if (parent_node_token) {
          body.parent_node_token = parent_node_token;
        }

        const data = await larkRequest<{
          node?: {
            node_token?: string;
            obj_token?: string;
            title?: string;
          };
        }>(`/wiki/v2/spaces/${space_id}/nodes`, {
          method: "POST",
          body,
        });

        const node = data.node || {};
        return success("Wiki node created", {
          node_token: node.node_token,
          obj_token: node.obj_token,
          title: node.title || title,
          wiki_url: WIKI_URL(node.node_token || ""),
        }, response_format);
      } catch (err) {
        return error("Wiki create node failed", err);
      }
    }
  );

  // wiki_move_node
  server.registerTool(
    "wiki_move_node",
    {
      title: "Move Wiki Node",
      description: `移動 Wiki 節點到指定位置。支援同空間或跨空間移動，子節點會一併移動。

Args:
  - space_id (string): 節點當前所在的 Wiki 空間 ID
  - node_token (string): 要移動的節點 Token
  - target_parent_token (string, optional): 目標父節點 Token（不填則移到空間根目錄）
  - target_space_id (string, optional): 目標空間 ID（跨空間移動時使用）

Returns:
  {
    "node_token": string,        // 移動後的節點 Token
    "space_id": string,          // 節點所在空間 ID
    "parent_node_token": string  // 父節點 Token 或 "(root)"
  }

Examples:
  - 同空間移動: wiki_move_node space_id=7XXX node_token=wikcnXXX target_parent_token=wikcnYYY
  - 移到根目錄: wiki_move_node space_id=7XXX node_token=wikcnXXX
  - 跨空間移動: wiki_move_node space_id=7XXX node_token=wikcnXXX target_space_id=7YYY

Permissions:
  - 需要節點、原父節點、目標父節點的編輯權限
  - 需要 wiki:node:move 權限

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to move a standalone file (use doc_move instead)`,
      inputSchema: WikiMoveNodeSchema,
      outputSchema: WikiMoveNodeOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { space_id, node_token, target_parent_token, target_space_id } = params;

        const body: Record<string, string> = {};
        if (target_parent_token) {
          body.target_parent_token = target_parent_token;
        }
        if (target_space_id) {
          body.target_space_id = target_space_id;
        }

        const data = await larkRequest<{
          node?: {
            node_token?: string;
            space_id?: string;
            parent_node_token?: string;
          };
        }>(`/wiki/v2/spaces/${space_id}/nodes/${node_token}/move`, {
          method: "POST",
          body,
        });

        const result = {
          node_token: data.node?.node_token || node_token,
          space_id: data.node?.space_id || target_space_id || space_id,
          parent_node_token: data.node?.parent_node_token || target_parent_token || "(root)",
        };

        return success("Wiki node moved", result);
      } catch (err) {
        return error("Wiki move node failed", err);
      }
    }
  );

  // wiki_spaces
  server.registerTool(
    "wiki_spaces",
    {
      title: "List Wiki Spaces",
      description: `列出用戶可存取的所有 Wiki 空間。

Args:
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  [
    {
      "space_id": string,     // 空間 ID
      "name": string,         // 空間名稱
      "description": string   // 空間描述
    }
  ]

Examples:
  - 列出所有空間: wiki_spaces

Permissions:
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You already know the space_id`,
      inputSchema: WikiSpacesSchema,
      outputSchema: WikiSpacesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { limit, offset, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{
            space_id?: string;
            name?: string;
            description?: string;
          }>;
          has_more?: boolean;
        }>("/wiki/v2/spaces", {
          params: { page_size: limit },
        });

        const spaces = (data.items || []).map((s) => ({
          space_id: s.space_id,
          name: s.name,
          description: s.description,
        }));

        return paginatedResponse(spaces, !!data.has_more, offset || 0, `Found ${spaces.length} Wiki spaces`, response_format);
      } catch (err) {
        return error("Wiki spaces list failed", err);
      }
    }
  );

  // lark_search (整合 doc_search, wiki_search)
  server.registerTool(
    "lark_search",
    {
      title: "Global Search",
      description: `全域搜尋 Lark 文件、Wiki、Drive。支援類型與範圍過濾。

Args:
  - query (string): 搜尋關鍵字（必填）
  - doc_type (string, optional): 文件類型過濾（all/doc/docx/sheet/bitable/wiki/file）
  - folder_token (string, optional): 限定特定資料夾
  - wiki_space_id (string, optional): 限定特定 Wiki 空間
  - limit (number, optional): 最大結果數，預設 10
  - offset (number, optional): 分頁偏移量
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "token": string,  // 文件 Token
      "name": string,   // 文件名稱
      "type": string,   // 文件類型
      "url": string     // 文件 URL
    }
  ]

Examples:
  - 基本搜尋: lark_search query="report"
  - 搜尋 Wiki: lark_search query="meeting" doc_type="wiki"
  - 限定資料夾: lark_search query="notes" folder_token="fldcnXXX"

Permissions:
  - drive:drive
  - wiki:wiki

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to browse a specific folder (use drive_list instead)
  - You need to list wiki nodes (use wiki_list_nodes instead)`,
      inputSchema: SearchAllSchema,
      outputSchema: SearchAllOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { query, doc_type, folder_token, wiki_space_id, limit, offset, response_format } = params;

        type FileItem = {
          token?: string;
          name?: string;
          type?: string;
          url?: string;
          wiki_info?: { space_id?: string };
        };

        type DocsEntity = {
          docs_token?: string;
          title?: string;
          docs_type?: string;
          url?: string;
        };

        // 遞迴搜尋函數（fallback 用）
        const maxDepth = 3;
        const maxFiles = 200;

        async function searchFolderRecursive(folderToken?: string, depth = 0): Promise<FileItem[]> {
          if (depth > maxDepth) return [];

          const results: FileItem[] = [];
          const reqParams: Record<string, string | number> = { page_size: 50 };
          if (folderToken) {
            reqParams.folder_token = folderToken;
          }

          try {
            const data = await larkRequest<{ files?: FileItem[] }>("/drive/v1/files", { params: reqParams });
            const files = data.files || [];

            for (const file of files) {
              if (results.length >= maxFiles) break;

              if (file.type === "folder") {
                const subFiles = await searchFolderRecursive(file.token, depth + 1);
                results.push(...subFiles);
              } else {
                results.push(file);
              }
            }
          } catch {
            // 忽略無權限的資料夾
          }

          return results;
        }

        // 方案 A：使用 /suite/docs-api/search/object（支援所有可存取文件）
        try {
          const body: Record<string, unknown> = {
            search_key: query,
            count: Math.min(limit * 2, 50), // 多取一些以應對過濾
            offset: offset,
          };

          if (doc_type && doc_type !== "all") {
            body.docs_types = [doc_type];
          }

          if (wiki_space_id) {
            body.wiki_space_ids = [wiki_space_id];
          }

          const data = await larkRequest<{ docs_entities?: DocsEntity[] }>("/suite/docs-api/search/object", {
            method: "POST",
            body,
            skipRetry: true,
          });

          const entities = data.docs_entities || [];

          if (entities.length > 0) {
            // 轉換為統一格式
            const files: FileItem[] = entities.map((e) => ({
              token: e.docs_token,
              name: e.title,
              type: e.docs_type,
              url: e.url,
            }));

            const limited = files.slice(0, limit);
            const simplified = simplifySearchResults(limited);
            return paginatedResponse(simplified, entities.length > limit, offset || 0, `Search "${query}" found ${simplified.length} results`, response_format);
          }
        } catch {
          // 搜尋 API 失敗，fallback 到方案 B
        }

        // 方案 B：遞迴搜尋 Drive 資料夾
        const allFiles = await searchFolderRecursive(folder_token);

        // 本地過濾
        const queryLower = query.toLowerCase();
        let files = allFiles.filter((f) =>
          f.name?.toLowerCase().includes(queryLower)
        );

        // 類型過濾
        if (doc_type && doc_type !== "all") {
          files = files.filter((f) => f.type === doc_type);
        }

        // Wiki space 過濾
        if (wiki_space_id) {
          files = files.filter((f) => f.wiki_info?.space_id === wiki_space_id);
        }

        // 分頁
        files = files.slice(offset, offset + limit);

        if (files.length === 0) {
          return success(`Search "${query}" returned no results`);
        }

        const simplified = simplifySearchResults(files);
        return paginatedResponse(simplified, false, offset || 0, `Search "${query}" found ${simplified.length} results`, response_format);
      } catch (err) {
        return error("Search failed", err);
      }
    }
  );
}
