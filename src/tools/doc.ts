/**
 * 文件工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DocCreateSchema,
  DocReadSchema,
  DocUpdateSchema,
  DocDeleteSchema,
  DocInsertBlocksSchema,
  DocDeleteBlocksSchema,
  DriveListSchema,
  DriveRecentSchema,
} from "../schemas/index.js";
import {
  createDocument,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../services/lark-client.js";
import { markdownToBlocks, blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifySearchResults, truncate } from "../utils/response.js";
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
      description: `建立新文件。回傳 document_id、title、url。

Example: doc_create folder_token=fldcnXXXXX title="Meeting Notes"`,
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
        const { folder_token, title, content, response_format } = params;
        const { documentId } = await createDocument(folder_token, title);

        if (content) {
          const rootBlockId = await getDocumentRootBlockId(documentId);
          const blocks = markdownToBlocks(content);
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
      description: `讀取文件內容，回傳 Markdown 格式。

Example: doc_read document_id=doccnXXXXX`,
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
        const { document_id, response_format } = params;
        const blocks = await getDocumentBlocks(document_id);
        const markdown = blocksToMarkdown(blocks);

        return success("Document read successful", truncate(markdown), response_format);
      } catch (err) {
        return error("Document read failed", err);
      }
    }
  );

  // doc_update
  server.registerTool(
    "doc_update",
    {
      title: "Update Document",
      description: `更新文件內容。支援範圍更新（需 start_index + end_index）或全文重寫。

Example: doc_update document_id=doccnXXXXX content="# New Content"`,
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
        const { document_id, content, start_index, end_index } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);
        const isRangeUpdate = start_index !== undefined && end_index !== undefined;

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

          const blocks = markdownToBlocks(content);
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
          }

          const blocks = markdownToBlocks(content);
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
      description: `刪除文件。

Example: doc_delete document_id=doccnXXXXX`,
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

  // doc_insert_blocks
  server.registerTool(
    "doc_insert_blocks",
    {
      title: "Insert Blocks to Document",
      description: `在文件指定位置插入內容。回傳位置與 URL。

Example: doc_insert_blocks document_id=doccnXXXXX content="New" index=5`,
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
        const { document_id, content, index } = params;
        const rootBlockId = await getDocumentRootBlockId(document_id);
        const blocks = markdownToBlocks(content);

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
      description: `刪除文件指定範圍的區塊。回傳刪除數量與 URL。

Example: doc_delete_blocks document_id=doccnXXXXX start_index=2 end_index=5`,
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

  // drive_list
  server.registerTool(
    "drive_list",
    {
      title: "List Drive Files",
      description: `列出雲端硬碟檔案。回傳 token、name、type、parent_token、url。

Example: drive_list folder_token=fldcnXXXXX`,
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
      description: `列出最近存取的檔案。回傳 token、name、type、url。

Example: drive_recent`,
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
}
