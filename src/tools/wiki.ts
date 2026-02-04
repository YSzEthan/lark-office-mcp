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
      description: `Read Wiki document content and return as Markdown.

Args:
  - wiki_token (string): Wiki node token (required)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  - Document content in Markdown format

Example:
  - wiki_read wiki_token=wikcnXXXXX`,
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
      description: `Insert content at the top of a Wiki document.

Args:
  - wiki_token (string): Wiki node token (required)
  - content (string): Markdown content to insert (required)

Returns:
  - Success message with block count and Wiki URL

Example:
  - wiki_prepend wiki_token=wikcnXXXXX content="# New Section\\nContent here"`,
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
      description: `Append content at the bottom of a Wiki document.

Args:
  - wiki_token (string): Wiki node token (required)
  - content (string): Markdown content to append (required)

Returns:
  - Success message with block count and Wiki URL

Example:
  - wiki_append wiki_token=wikcnXXXXX content="## Footer\\nAdditional content"`,
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
      description: `Update Wiki document content. Supports range update or full rewrite.

Args:
  - wiki_token (string): Wiki node token (required)
  - content (string): New Markdown content (required)
  - start_index (number): Start index for range update (optional)
  - end_index (number): End index for range update (exclusive, optional)

If start_index and end_index are provided, only that range is replaced.
Otherwise, the entire document is cleared and rewritten.

Returns:
  - Success message with operation details and Wiki URL

Example:
  - Full rewrite: wiki_update wiki_token=wikcnXXXXX content="# New Content"
  - Range update: wiki_update wiki_token=wikcnXXXXX content="Replacement" start_index=2 end_index=5`,
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
      description: `Insert content blocks at a specific position in Wiki document.

Args:
  - wiki_token (string): Wiki node token (required)
  - content (string): Markdown content to insert (required)
  - index (number): Insert position (0-based, default: 0)

Returns:
  - Success message with position and Wiki URL

Example:
  - wiki_insert_blocks wiki_token=wikcnXXXXX content="New content" index=5`,
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
      description: `Delete a range of blocks from Wiki document.

Args:
  - wiki_token (string): Wiki node token (required)
  - start_index (number): Start index (0-based, required)
  - end_index (number): End index (exclusive, required)

Returns:
  - Success message with deleted count and Wiki URL

Example:
  - wiki_delete_blocks wiki_token=wikcnXXXXX start_index=2 end_index=5`,
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
      description: `Search for content within a Wiki space.

Args:
  - space_id (string): Wiki space ID (required)
  - query (string): Search keyword (required)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of matching Wiki nodes with token, title, type

Example:
  - wiki_search space_id=7XXXXXX query="meeting notes"`,
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
      description: `List nodes in a Wiki space.

Args:
  - space_id (string): Wiki space ID (required)
  - parent_node_token (string): Parent node token (optional, omit for root)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of Wiki nodes with token, title, type, has_children

Example:
  - wiki_list_nodes space_id=7XXXXXX
  - wiki_list_nodes space_id=7XXXXXX parent_node_token=wikcnXXXXX`,
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
      description: `List all Wiki spaces accessible to the user.

Args:
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of Wiki spaces with space_id, name, description

Example:
  - wiki_spaces`,
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
      description: `Search across all Lark documents, Wiki, and Drive files.

Args:
  - query (string): Search keyword (required)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of files with token, name, type, url

Example:
  - lark_search query="quarterly report"`,
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
