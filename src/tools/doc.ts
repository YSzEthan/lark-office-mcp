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
  DocSearchSchema,
  DriveListSchema,
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
      description: `Create a new Lark document.

Args:
  - folder_token (string): Target folder token (required)
  - title (string): Document title (required)
  - content (string): Initial content in Markdown format (optional)

Returns:
  - Document ID, title, and URL

Example:
  - doc_create folder_token=fldcnXXXXX title="Meeting Notes"
  - doc_create folder_token=fldcnXXXXX title="Report" content="# Introduction\\nContent here"`,
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
      description: `Read document content and return as Markdown.

Args:
  - document_id (string): Document ID (required)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  - Document content in Markdown format

Example:
  - doc_read document_id=doccnXXXXX`,
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
      description: `Update document content. Supports range update or full rewrite.

Args:
  - document_id (string): Document ID (required)
  - content (string): New Markdown content (required)
  - start_index (number): Start index for range update (optional)
  - end_index (number): End index for range update (exclusive, optional)

If start_index and end_index are provided, only that range is replaced.
Otherwise, the entire document is cleared and rewritten.

Returns:
  - Success message with operation details and document URL

Example:
  - Full rewrite: doc_update document_id=doccnXXXXX content="# New Content"
  - Range update: doc_update document_id=doccnXXXXX content="Replacement" start_index=2 end_index=5`,
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
      description: `Delete a document.

Args:
  - document_id (string): Document ID (required)

Returns:
  - Success message

Example:
  - doc_delete document_id=doccnXXXXX`,
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
      description: `Insert content blocks at a specific position in document.

Args:
  - document_id (string): Document ID (required)
  - content (string): Markdown content to insert (required)
  - index (number): Insert position (0-based, default: 0)

Returns:
  - Success message with position and document URL

Example:
  - doc_insert_blocks document_id=doccnXXXXX content="New content" index=5`,
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
      description: `Delete a range of blocks from document.

Args:
  - document_id (string): Document ID (required)
  - start_index (number): Start index (0-based, required)
  - end_index (number): End index (exclusive, required)

Returns:
  - Success message with deleted count and document URL

Example:
  - doc_delete_blocks document_id=doccnXXXXX start_index=2 end_index=5`,
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

  // doc_search
  server.registerTool(
    "doc_search",
    {
      title: "Search Documents",
      description: `Search for documents.

Args:
  - query (string): Search keyword (required)
  - folder_token (string): Limit search to specific folder (optional)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of documents with token, name, type, url

Example:
  - doc_search query="meeting notes"
  - doc_search query="report" folder_token=fldcnXXXXX`,
      inputSchema: DocSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { query, folder_token, limit, response_format } = params;

        const body: Record<string, unknown> = {
          search_key: query,
          count: limit,
        };

        if (folder_token) {
          body.folder_token = folder_token;
        }

        const data = await larkRequest<{
          files?: Array<{
            token?: string;
            name?: string;
            type?: string;
            url?: string;
          }>;
        }>("/drive/v1/files/search", {
          method: "POST",
          body,
        });

        const files = data.files || [];

        if (files.length === 0) {
          return success(`Search "${query}" returned no results`);
        }

        const simplified = simplifySearchResults(files);
        return success(`Search "${query}" found ${simplified.length} results`, simplified, response_format);
      } catch (err) {
        return error("Document search failed", err);
      }
    }
  );

  // drive_list
  server.registerTool(
    "drive_list",
    {
      title: "List Drive Files",
      description: `List files and folders in Lark Drive.

Args:
  - folder_token (string): Folder token (optional, omit for root directory)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of files/folders with token, name, type, parent_token, url

Example:
  - drive_list
  - drive_list folder_token=fldcnXXXXX`,
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
}
