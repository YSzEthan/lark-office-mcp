/**
 * 文件工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DocCreateSchema,
  DocReadSchema,
  DocUpdateSchema,
  DocDeleteSchema,
  DocContentSchema,
  DocMoveSchema,
  DocInsertBlocksSchema,
  DocDeleteBlocksSchema,
  DocMoveBlocksSchema,
  DocSearchBlocksSchema,
  DriveListSchema,
  DriveRecentSchema,
  BlocksToMarkdownSchema,
} from "../schemas/index.js";
import {
  createDocument,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../services/lark-client.js";
import { blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifySearchResults, truncate } from "../utils/response.js";
import type { LarkBlock } from "../types.js";
import { DOC_URL } from "../constants.js";

/**
 * 註冊文件工具
 */
export function registerDocTools(server: McpServer): void {
  // doc_create
  server.registerTool(
    "doc_create",
    {
      title: "Create Document",
      description: `在指定資料夾建立新文件。

Args:
  - folder_token (string): 目標資料夾 Token（必填）
  - title (string): 文件標題（必填）
  - blocks (array, optional): 初始 Lark Block JSON 陣列

Returns:
  {
    "document_id": string,  // 文件 ID
    "title": string,        // 文件標題
    "url": string           // 文件 URL
  }

Examples:
  - 建立空文件: doc_create folder_token=fldcnXXXXX title="Meeting Notes"
  - 建立有內容的文件: doc_create folder_token=fldcnXXXXX title="Report" blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"Summary"}}]}}]

Permissions:
  - drive:drive`,
      inputSchema: DocCreateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { folder_token, title, blocks, response_format } = params;
        const { documentId } = await createDocument(folder_token, title);

        if (blocks && blocks.length > 0) {
          const rootBlockId = await getDocumentRootBlockId(documentId);
          await insertBlocks(documentId, rootBlockId, blocks, 0);
        }

        return success("Document created", {
          document_id: documentId,
          title,
          url: DOC_URL(documentId),
        }, response_format);
      } catch (err) {
        return error("Document creation failed", err);
      }
    }
  );

  // doc_read
  server.registerTool(
    "doc_read",
    {
      title: "Read Document",
      description: `讀取文件內容，回傳原始 Lark blocks。

Args:
  - document_id (string): 文件 ID（必填）

Returns:
  Lark Block 陣列（原始格式）。需要顯示給用戶時，使用 blocks_to_markdown 轉換為 Markdown。

Examples:
  - 讀取文件: doc_read document_id=doccnXXXXX

Permissions:
  - drive:drive`,
      inputSchema: DocReadSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id } = params;
        const blocks = await getDocumentBlocks(document_id);

        return success("Document read successful", blocks);
      } catch (err) {
        return error("Document read failed", err);
      }
    }
  );

  // doc_prepend
  server.registerTool(
    "doc_prepend",
    {
      title: "Prepend to Document",
      description: `在文件頂部插入內容。

Args:
  - document_id (string): 文件 ID（必填）
  - blocks (array): Lark Block JSON 陣列（必填）

Returns:
  {
    "doc_url": string  // 文件 URL
  }

Examples:
  - 插入標題: doc_prepend document_id=doccnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"Title"}}]}}]
  - 插入段落: doc_prepend document_id=doccnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"Hello"}}]}}]

Permissions:
  - drive:drive`,
      inputSchema: DocContentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, blocks } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);

        await insertBlocks(document_id, rootBlockId, blocks, 0);

        return success(`Inserted ${blocks.length} blocks at top of document`, {
          doc_url: DOC_URL(document_id),
        });
      } catch (err) {
        return error("Document prepend failed", err);
      }
    }
  );

  // doc_append
  server.registerTool(
    "doc_append",
    {
      title: "Append to Document",
      description: `在文件底部追加內容。

Args:
  - document_id (string): 文件 ID（必填）
  - blocks (array): Lark Block JSON 陣列（必填）

Returns:
  {
    "document_id": string,  // 文件 ID
    "url": string           // 文件 URL
  }

Examples:
  - 追加頁尾: doc_append document_id=doccnXXXXX blocks=[{"block_type":4,"heading2":{"elements":[{"text_run":{"content":"Footer"}}]}}]

Permissions:
  - drive:drive`,
      inputSchema: DocContentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, blocks } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);
        const existingBlocks = await getDocumentBlocks(document_id);
        const insertIndex = Math.max(0, existingBlocks.length - 1);

        await insertBlocks(document_id, rootBlockId, blocks, insertIndex);

        return success(`Appended ${blocks.length} blocks to document`, {
          document_id,
          url: DOC_URL(document_id),
        });
      } catch (err) {
        return error("Document append failed", err);
      }
    }
  );

  // doc_update
  server.registerTool(
    "doc_update",
    {
      title: "Update Document",
      description: `更新文件內容。支援範圍更新或全文重寫。

Args:
  - document_id (string): 文件 ID（必填）
  - blocks (array): Lark Block JSON 陣列（必填）
  - start_index (number, optional): 範圍更新起始位置（需配合 end_index）
  - end_index (number, optional): 範圍更新結束位置（不包含）

Returns:
  {
    "document_id": string,  // 文件 ID
    "url": string           // 文件 URL
  }

Examples:
  - 全文重寫: doc_update document_id=doccnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"New Content"}}]}}]
  - 範圍更新: doc_update document_id=doccnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"New"}}]}}] start_index=0 end_index=3

Permissions:
  - drive:drive`,
      inputSchema: DocUpdateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, blocks, start_index, end_index } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);
        const isRangeUpdate = start_index !== undefined && end_index !== undefined;

        const hasTable = blocks.some((b: Record<string, unknown>) => b._cellContents);

        if (isRangeUpdate) {
          if (start_index < 0 || end_index <= start_index) {
            return error("Invalid range (end_index must be greater than start_index)");
          }

          await larkRequest(`/docx/v1/documents/${document_id}/blocks/${rootBlockId}/children/batch_delete`, {
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

          await insertBlocks(document_id, rootBlockId, blocks, start_index);

          return success(
            `Document range update: deleted ${end_index - start_index} blocks, inserted ${blocks.length} blocks`,
            { document_id, url: DOC_URL(document_id) }
          );
        } else {
          const existingBlocks = await getDocumentBlocks(document_id);
          const childBlockIds = existingBlocks
            .filter((b) => b.parent_id === rootBlockId && b.block_id !== rootBlockId)
            .map((b) => b.block_id);

          if (childBlockIds.length > 0) {
            await larkRequest(`/docx/v1/documents/${document_id}/blocks/${rootBlockId}/children/batch_delete`, {
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

          await insertBlocks(document_id, rootBlockId, blocks, 0);

          return success(`Document update: inserted ${blocks.length} blocks`, {
            document_id,
            url: DOC_URL(document_id),
          });
        }
      } catch (err) {
        return error("Document update failed", err);
      }
    }
  );

  // doc_delete
  server.registerTool(
    "doc_delete",
    {
      title: "Delete Document",
      description: `刪除指定文件。此操作不可逆。

Args:
  - document_id (string): 文件 ID（必填）

Returns:
  {
    "document_id": string  // 已刪除的文件 ID
  }

Examples:
  - 刪除文件: doc_delete document_id=doccnXXXXX

Permissions:
  - drive:drive`,
      inputSchema: DocDeleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id } = params;

        await larkRequest(`/drive/v1/files/${document_id}`, {
          method: "DELETE",
          params: { type: "docx" },
        });

        return success("Document deleted", { document_id });
      } catch (err) {
        return error("Document deletion failed", err);
      }
    }
  );

  // doc_move
  server.registerTool(
    "doc_move",
    {
      title: "Move File",
      description: `移動檔案到指定資料夾。支援文件、試算表、多維表格等類型。

Args:
  - file_token (string): 檔案 Token（必填）
  - folder_token (string): 目標資料夾 Token（必填）
  - type (string, optional): 檔案類型 doc/docx/sheet/bitable/file/folder，預設 docx
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  {
    "file_token": string,    // 檔案 Token
    "folder_token": string   // 目標資料夾 Token
  }

Examples:
  - 移動文件: doc_move file_token=doccnXXXXX folder_token=fldcnYYYYY
  - 移動試算表: doc_move file_token=shtcnXXXXX folder_token=fldcnYYYYY type="sheet"

Permissions:
  - drive:drive`,
      inputSchema: DocMoveSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { file_token, folder_token, type, response_format } = params;

        const data = await larkRequest<{
          task_id?: string;
        }>(`/drive/v1/files/${file_token}/move`, {
          method: "POST",
          body: {
            type: type || "docx",
            folder_token,
          },
        });

        return success("File moved", {
          file_token,
          folder_token,
          task_id: data.task_id,
        }, response_format);
      } catch (err) {
        return error("File move failed", err);
      }
    }
  );

  // doc_insert_blocks
  server.registerTool(
    "doc_insert_blocks",
    {
      title: "Insert Blocks to Document",
      description: `在文件指定位置插入內容。

Args:
  - document_id (string): 文件 ID（必填）
  - blocks (array): Lark Block JSON 陣列（必填）
  - index (number, optional): 插入位置，從 0 開始，預設 0

Returns:
  {
    "document_id": string,  // 文件 ID
    "url": string           // 文件 URL
  }

Examples:
  - 在開頭插入: doc_insert_blocks document_id=doccnXXXXX blocks=[{"block_type":3,"heading1":{"elements":[{"text_run":{"content":"Title"}}]}}]
  - 在指定位置插入: doc_insert_blocks document_id=doccnXXXXX blocks=[{"block_type":2,"text":{"elements":[{"text_run":{"content":"New"}}]}}] index=5

Permissions:
  - drive:drive`,
      inputSchema: DocInsertBlocksSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, blocks, index } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);

        await insertBlocks(document_id, rootBlockId, blocks, index);

        return success(`Inserted ${blocks.length} blocks at position ${index}`, {
          document_id,
          url: DOC_URL(document_id),
        });
      } catch (err) {
        return error("Document insert blocks failed", err);
      }
    }
  );

  // doc_delete_blocks
  server.registerTool(
    "doc_delete_blocks",
    {
      title: "Delete Document Blocks",
      description: `刪除文件指定範圍的區塊。

Args:
  - document_id (string): 文件 ID（必填）
  - start_index (number): 起始位置，從 0 開始（必填）
  - end_index (number): 結束位置，不包含（必填）

Returns:
  {
    "document_id": string,  // 文件 ID
    "url": string           // 文件 URL
  }

Examples:
  - 刪除第 2-4 個區塊: doc_delete_blocks document_id=doccnXXXXX start_index=2 end_index=5

Permissions:
  - drive:drive`,
      inputSchema: DocDeleteBlocksSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, start_index, end_index } = params;

        if (start_index < 0 || end_index <= start_index) {
          return error("Invalid range (end_index must be greater than start_index)");
        }

        const rootBlockId = await getDocumentRootBlockId(document_id);

        await larkRequest(`/docx/v1/documents/${document_id}/blocks/${rootBlockId}/children/batch_delete`, {
          method: "DELETE",
          body: {
            document_revision_id: -1,
            start_index,
            end_index,
          },
        });

        return success(`Deleted ${end_index - start_index} blocks (index ${start_index} to ${end_index})`, {
          document_id,
          url: DOC_URL(document_id),
        });
      } catch (err) {
        return error("Document delete blocks failed", err);
      }
    }
  );

  // doc_move_blocks
  server.registerTool(
    "doc_move_blocks",
    {
      title: "Move Document Blocks",
      description: `移動文件內的區塊到指定位置。

Args:
  - document_id (string): 文件 ID（必填）
  - start_index (number): 要移動的起始位置，從 0 開始（必填）
  - end_index (number): 要移動的結束位置，不包含（必填）
  - target_index (number): 目標位置，從 0 開始（必填）

Returns:
  {
    "document_id": string,  // 文件 ID
    "url": string           // 文件 URL
  }

Examples:
  - 將第 0-2 個區塊移到位置 5: doc_move_blocks document_id=doccnXXXXX start_index=0 end_index=2 target_index=5
  - 將第 5-7 個區塊移到開頭: doc_move_blocks document_id=doccnXXXXX start_index=5 end_index=7 target_index=0

Permissions:
  - drive:drive`,
      inputSchema: DocMoveBlocksSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, start_index, end_index, target_index } = params;

        if (start_index < 0 || end_index <= start_index) {
          return error("Invalid range (end_index must be greater than start_index)");
        }

        if (target_index >= start_index && target_index < end_index) {
          return error("Target index cannot be within the source range");
        }

        const rootBlockId = await getDocumentRootBlockId(document_id);
        const allBlocks = await getDocumentBlocks(document_id);

        // 取得要移動的 blocks（過濾掉 root block，只取直接子節點）
        const childBlocks = allBlocks.filter(
          (b) => b.parent_id === rootBlockId && b.block_id !== rootBlockId
        );

        if (end_index > childBlocks.length) {
          return error(`Invalid range: document has ${childBlocks.length} blocks, but end_index is ${end_index}`);
        }

        // 提取要移動的 blocks 內容
        const blocksToMove = childBlocks.slice(start_index, end_index);
        const blockCount = blocksToMove.length;

        // 將 blocks 轉換為可插入的格式
        const blocksData = blocksToMove.map((b) => {
          const { block_id, parent_id, children, ...rest } = b;
          return rest;
        });

        // 1. 刪除原位置的 blocks
        await larkRequest(`/docx/v1/documents/${document_id}/blocks/${rootBlockId}/children/batch_delete`, {
          method: "DELETE",
          body: {
            document_revision_id: -1,
            start_index,
            end_index,
          },
        });

        // 2. 計算新的目標位置（因為刪除後索引會變化）
        let adjustedTargetIndex = target_index;
        if (target_index > start_index) {
          adjustedTargetIndex = target_index - blockCount;
        }

        // 3. 在目標位置插入 blocks
        await insertBlocks(document_id, rootBlockId, blocksData, adjustedTargetIndex);

        return success(`Moved ${blockCount} blocks from index ${start_index}-${end_index} to index ${target_index}`, {
          document_id,
          url: DOC_URL(document_id),
        });
      } catch (err) {
        return error("Document move blocks failed", err);
      }
    }
  );

  // doc_search_blocks
  server.registerTool(
    "doc_search_blocks",
    {
      title: "Search Document Blocks",
      description: `在文件內搜尋包含關鍵字的區塊。

Args:
  - document_id (string): 文件 ID（必填）
  - keyword (string): 搜尋關鍵字（必填）
  - case_sensitive (boolean, optional): 區分大小寫，預設 false

Returns:
  [
    {
      "index": number,       // 區塊位置（0-based）
      "block_type": number,  // 區塊類型
      "text": string         // 區塊文字內容
    }
  ]

Examples:
  - 搜尋關鍵字: doc_search_blocks document_id=doccnXXXXX keyword="TODO"
  - 區分大小寫: doc_search_blocks document_id=doccnXXXXX keyword="API" case_sensitive=true

Permissions:
  - drive:drive`,
      inputSchema: DocSearchBlocksSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { document_id, keyword, case_sensitive } = params;

        const rootBlockId = await getDocumentRootBlockId(document_id);
        const allBlocks = await getDocumentBlocks(document_id);

        // 只取直接子節點
        const childBlocks = allBlocks.filter(
          (b) => b.parent_id === rootBlockId && b.block_id !== rootBlockId
        );

        // 提取文字內容的輔助函數
        const extractText = (block: Record<string, unknown>): string => {
          const content = block.text || block.heading1 || block.heading2 || block.heading3 ||
            block.heading4 || block.heading5 || block.heading6 || block.heading7 ||
            block.heading8 || block.heading9 || block.bullet || block.ordered ||
            block.quote || block.todo || block.code || block.callout;

          if (!content || typeof content !== "object") return "";

          const elements = (content as Record<string, unknown>).elements;
          if (!Array.isArray(elements)) return "";

          return elements
            .map((el: Record<string, unknown>) => {
              const textRun = el.text_run as Record<string, unknown> | undefined;
              return textRun?.content || "";
            })
            .join("");
        };

        // 搜尋
        const searchKeyword = case_sensitive ? keyword : keyword.toLowerCase();
        const results: Array<{ index: number; block_type: number; text: string }> = [];

        childBlocks.forEach((block, index) => {
          const text = extractText(block);
          const searchText = case_sensitive ? text : text.toLowerCase();

          if (searchText.includes(searchKeyword)) {
            results.push({
              index,
              block_type: block.block_type as number,
              text: text.length > 100 ? text.slice(0, 100) + "..." : text,
            });
          }
        });

        if (results.length === 0) {
          return success(`No blocks found containing "${keyword}"`);
        }

        return success(`Found ${results.length} blocks containing "${keyword}"`, results);
      } catch (err) {
        return error("Document search blocks failed", err);
      }
    }
  );

  // drive_list
  server.registerTool(
    "drive_list",
    {
      title: "List Drive Files",
      description: `列出雲端硬碟資料夾中的檔案。

Args:
  - folder_token (string, optional): 資料夾 Token，不填則列出根目錄
  - limit (number, optional): 最大結果數，預設 20，範圍 1-100
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  [
    {
      "token": string,         // 檔案 Token
      "name": string,          // 檔案名稱
      "type": string,          // 類型（folder/doc/docx/sheet/bitable）
      "parent_token": string,  // 父資料夾 Token
      "url": string            // 檔案 URL
    }
  ]

Examples:
  - 列出根目錄: drive_list
  - 列出指定資料夾: drive_list folder_token=fldcnXXXXX

Permissions:
  - drive:drive`,
      inputSchema: DriveListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { folder_token, limit, response_format } = params;

        const reqParams: Record<string, string | number> = { page_size: limit };
        if (folder_token) {
          reqParams.folder_token = folder_token;
        }

        const data = await larkRequest<{
          files?: Array<{
            token?: string;
            name?: string;
            type?: string;
            parent_token?: string;
            url?: string;
          }>;
          has_more?: boolean;
        }>("/drive/v1/files", { params: reqParams });

        const files = data.files || [];

        if (files.length === 0) {
          return success("Folder is empty");
        }

        const simplified = files.map((f) => ({
          token: f.token || "",
          name: f.name || "(untitled)",
          type: f.type || "unknown",
          parent_token: f.parent_token,
          url: f.url,
        }));

        return success(`Found ${simplified.length} files/folders`, simplified, response_format);
      } catch (err) {
        return error("Drive list failed", err);
      }
    }
  );

  // drive_recent - 最近存取的檔案
  server.registerTool(
    "drive_recent",
    {
      title: "Recent Files",
      description: `列出最近存取的檔案。

Args:
  - limit (number, optional): 最大結果數，預設 20，範圍 1-100
  - response_format (string, optional): 輸出格式 "json" 或 "markdown"

Returns:
  [
    {
      "token": string,  // 檔案 Token
      "name": string,   // 檔案名稱
      "type": string,   // 類型
      "url": string     // 檔案 URL
    }
  ]

Examples:
  - 列出最近檔案: drive_recent
  - 限制數量: drive_recent limit=5

Permissions:
  - drive:drive`,
      inputSchema: DriveRecentSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { limit, response_format } = params;

        // 嘗試多個可能的 API 端點
        const endpoints = [
          "/drive/v1/files/recent",
          "/drive/explorer/v2/recent",
          "/suite/docs-api/recent",
        ];

        for (const endpoint of endpoints) {
          try {
            const data = await larkRequest<{
              files?: Array<{
                token?: string;
                name?: string;
                type?: string;
                url?: string;
              }>;
              entities?: Array<{
                token?: string;
                title?: string;
                type?: string;
                url?: string;
              }>;
            }>(endpoint, {
              params: { page_size: limit },
              skipRetry: true,
            });

            const files = data.files || data.entities || [];

            if (files.length > 0) {
              const simplified = files.map((f) => ({
                token: f.token || "",
                name: f.name || f.title || "(untitled)",
                type: f.type || "unknown",
                url: f.url,
              }));

              return success(`Found ${simplified.length} recent files`, simplified, response_format);
            }
          } catch {
            // 嘗試下一個端點
            continue;
          }
        }

        return success("No recent files found or API not available");
      } catch (err) {
        return error("Drive recent failed", err);
      }
    }
  );

  // blocks_to_markdown
  server.registerTool(
    "blocks_to_markdown",
    {
      title: "Convert Blocks to Markdown",
      description: `將 Lark blocks 轉換為 Markdown 格式。用於顯示 wiki_read/doc_read 的原始內容給用戶閱讀。

Args:
  - blocks (array): Lark blocks 陣列，來自 wiki_read 或 doc_read（必填）

Returns:
  Markdown 格式的文字內容（會自動截斷過長內容）

Examples:
  - 轉換文件內容: blocks_to_markdown blocks=[...]
  - 搭配 doc_read 使用: 先執行 doc_read，再將回傳的 blocks 傳入此工具`,
      inputSchema: BlocksToMarkdownSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { blocks } = params;
        const markdown = await blocksToMarkdown(blocks as LarkBlock[]);
        return success("Conversion successful", truncate(markdown));
      } catch (err) {
        return error("Conversion failed", err);
      }
    }
  );
}
