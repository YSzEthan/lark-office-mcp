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
  WikiSearchSchema,
  WikiListNodesSchema,
  WikiSpacesSchema,
  SearchAllSchema,
} from "../schemas/index.js";
import {
  getWikiNode,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../services/lark-client.js";
import { markdownToBlocks, blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifyNodeList, simplifySearchResults, truncate } from "../utils/response.js";
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
      description: `讀取 Wiki 內容，回傳 Markdown 格式。

Example: wiki_read wiki_token=wikcnXXXXX`,
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
        const { wiki_token, response_format } = params;
        const node = await getWikiNode(wiki_token);
        const blocks = await getDocumentBlocks(node.objToken);
        const markdown = blocksToMarkdown(blocks);

        return success("Wiki read successful", truncate(markdown), response_format);
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
      description: `在 Wiki 頂部插入內容。回傳區塊數量與 URL。

Example: wiki_prepend wiki_token=wikcnXXXXX content="# Title"`,
      inputSchema: WikiContentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, content } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const blocks = markdownToBlocks(content);

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
      description: `在 Wiki 底部追加內容。回傳區塊數量與 URL。

Example: wiki_append wiki_token=wikcnXXXXX content="## Footer"`,
      inputSchema: WikiContentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, content } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const existingBlocks = await getDocumentBlocks(node.objToken);
        const insertIndex = Math.max(0, existingBlocks.length - 1);
        const blocks = markdownToBlocks(content);

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
      description: `更新 Wiki 內容。支援範圍更新（需 start_index + end_index）或全文重寫。

Example: wiki_update wiki_token=wikcnXXXXX content="# New Content"`,
      inputSchema: WikiUpdateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, content, start_index, end_index } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const isRangeUpdate = start_index !== undefined && end_index !== undefined;

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

          const blocks = markdownToBlocks(content);
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
          }

          const blocks = markdownToBlocks(content);
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
      description: `在 Wiki 指定位置插入內容。回傳位置與 URL。

Example: wiki_insert_blocks wiki_token=wikcnXXXXX content="New" index=5`,
      inputSchema: WikiInsertBlocksSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { wiki_token, content, index } = params;
        const node = await getWikiNode(wiki_token);
        const rootBlockId = await getDocumentRootBlockId(node.objToken);
        const blocks = markdownToBlocks(content);

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
      description: `刪除 Wiki 指定範圍的區塊。回傳刪除數量與 URL。

Example: wiki_delete_blocks wiki_token=wikcnXXXXX start_index=2 end_index=5`,
      inputSchema: WikiDeleteBlocksSchema,
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

  // wiki_search
  server.registerTool(
    "wiki_search",
    {
      title: "Search Wiki",
      description: `搜尋 Wiki 空間內容。回傳 token、title、type。

Example: wiki_search space_id=7XXXXXX query="meeting"`,
      inputSchema: WikiSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { space_id, query, limit, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{
            node_token?: string;
            title?: string;
            obj_type?: string;
          }>;
        }>(`/wiki/v2/spaces/${space_id}/nodes`, {
          params: { page_size: limit },
        });

        const filtered = (data.items || []).filter((item) =>
          item.title?.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length === 0) {
          return success(`Search "${query}" returned no results`);
        }

        const simplified = simplifyNodeList(filtered);
        return success(`Search "${query}" found ${simplified.length} results`, simplified, response_format);
      } catch (err) {
        return error("Wiki search failed", err);
      }
    }
  );

  // wiki_list_nodes
  server.registerTool(
    "wiki_list_nodes",
    {
      title: "List Wiki Nodes",
      description: `列出 Wiki 空間節點。回傳 token、title、type、has_children。

Example: wiki_list_nodes space_id=7XXXXXX`,
      inputSchema: WikiListNodesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { space_id, parent_node_token, limit, response_format } = params;

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
        }>(`/wiki/v2/spaces/${space_id}/nodes`, { params: reqParams });

        const simplified = simplifyNodeList(data.items || []);
        return success(`Found ${simplified.length} nodes`, simplified, response_format);
      } catch (err) {
        return error("Wiki list nodes failed", err);
      }
    }
  );

  // wiki_spaces
  server.registerTool(
    "wiki_spaces",
    {
      title: "List Wiki Spaces",
      description: `列出所有 Wiki 空間。回傳 space_id、name、description。

Example: wiki_spaces`,
      inputSchema: WikiSpacesSchema,
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

        const data = await larkRequest<{
          items?: Array<{
            space_id?: string;
            name?: string;
            description?: string;
          }>;
        }>("/wiki/v2/spaces", {
          params: { page_size: limit },
        });

        const spaces = (data.items || []).map((s) => ({
          space_id: s.space_id,
          name: s.name,
          description: s.description,
        }));

        return success(`Found ${spaces.length} Wiki spaces`, spaces, response_format);
      } catch (err) {
        return error("Wiki spaces list failed", err);
      }
    }
  );

  // search_all
  server.registerTool(
    "lark_search",
    {
      title: "Global Search",
      description: `全域搜尋 Lark 文件、Wiki、Drive。回傳 token、name、type、url。

Example: lark_search query="report"`,
      inputSchema: SearchAllSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { query, limit, response_format } = params;

        const data = await larkRequest<{
          files?: Array<{
            token?: string;
            name?: string;
            type?: string;
            url?: string;
          }>;
          has_more?: boolean;
        }>("/drive/v1/files/search", {
          method: "POST",
          body: {
            search_key: query,
            count: limit,
          },
        });

        const files = data.files || [];

        if (files.length === 0) {
          return success(`Search "${query}" returned no results`);
        }

        const simplified = simplifySearchResults(files);
        return success(`Search "${query}" found ${simplified.length} results`, simplified, response_format);
      } catch (err) {
        return error("Search failed", err);
      }
    }
  );
}
