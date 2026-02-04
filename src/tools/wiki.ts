/**
 * Wiki 相關工具
 * 精簡版 API，只接受 Markdown 輸入
 */

import {
  getWikiNode,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../lark-client.js";
import { markdownToBlocks, blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifyNodeList, truncate, type ToolResponse } from "../utils/response.js";

/**
 * 工具定義
 */
export const wikiTools = [
  {
    name: "wiki_read",
    description: "讀取 Wiki 內容，回傳 Markdown 格式",
    inputSchema: {
      type: "object" as const,
      properties: {
        wiki_token: {
          type: "string",
          description: "Wiki 節點 Token（必填）",
        },
      },
      required: ["wiki_token"],
    },
  },
  {
    name: "wiki_prepend",
    description: "在 Wiki 文件頂部插入內容",
    inputSchema: {
      type: "object" as const,
      properties: {
        wiki_token: {
          type: "string",
          description: "Wiki 節點 Token（必填）",
        },
        content: {
          type: "string",
          description: "要插入的 Markdown 內容",
        },
      },
      required: ["wiki_token", "content"],
    },
  },
  {
    name: "wiki_append",
    description: "在 Wiki 文件底部追加內容",
    inputSchema: {
      type: "object" as const,
      properties: {
        wiki_token: {
          type: "string",
          description: "Wiki 節點 Token（必填）",
        },
        content: {
          type: "string",
          description: "要追加的 Markdown 內容",
        },
      },
      required: ["wiki_token", "content"],
    },
  },
  {
    name: "wiki_insert_blocks",
    description: "批量插入內容區塊到指定位置",
    inputSchema: {
      type: "object" as const,
      properties: {
        wiki_token: {
          type: "string",
          description: "Wiki 節點 Token（必填）",
        },
        content: {
          type: "string",
          description: "要插入的 Markdown 內容",
        },
        index: {
          type: "number",
          description: "插入位置索引（從 0 開始，預設為 0）",
        },
      },
      required: ["wiki_token", "content"],
    },
  },
  {
    name: "wiki_search",
    description: "搜尋 Wiki 空間中的內容",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: {
          type: "string",
          description: "Wiki 空間 ID（必填）",
        },
        query: {
          type: "string",
          description: "搜尋關鍵字",
        },
      },
      required: ["space_id", "query"],
    },
  },
  {
    name: "wiki_list_nodes",
    description: "列出 Wiki 空間的節點",
    inputSchema: {
      type: "object" as const,
      properties: {
        space_id: {
          type: "string",
          description: "Wiki 空間 ID（必填）",
        },
        parent_node_token: {
          type: "string",
          description: "父節點 Token（可選，不填則列出根節點）",
        },
      },
      required: ["space_id"],
    },
  },
  {
    name: "wiki_spaces",
    description: "列出所有 Wiki 空間",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "search_all",
    description: "全域搜尋（搜尋所有文件、Wiki、雲端硬碟檔案）",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "搜尋關鍵字（必填）",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * 處理 Wiki 工具呼叫
 */
export async function handleWikiTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    switch (name) {
      case "wiki_read":
        return await wikiRead(args.wiki_token as string);

      case "wiki_prepend":
        return await wikiPrepend(
          args.wiki_token as string,
          args.content as string
        );

      case "wiki_append":
        return await wikiAppend(
          args.wiki_token as string,
          args.content as string
        );

      case "wiki_insert_blocks":
        return await wikiInsertBlocks(
          args.wiki_token as string,
          args.content as string,
          (args.index as number) ?? 0
        );

      case "wiki_search":
        return await wikiSearch(
          args.space_id as string,
          args.query as string
        );

      case "wiki_list_nodes":
        return await wikiListNodes(
          args.space_id as string,
          args.parent_node_token as string | undefined
        );

      case "wiki_spaces":
        return await wikiSpaces();

      case "search_all":
        return await searchAll(args.query as string);

      default:
        return error(`未知的 Wiki 工具: ${name}`);
    }
  } catch (err) {
    return error("Wiki 操作失敗", err);
  }
}

/**
 * 讀取 Wiki 內容
 */
async function wikiRead(wikiToken: string): Promise<ToolResponse> {
  if (!wikiToken) {
    return error("缺少 wiki_token 參數");
  }

  const node = await getWikiNode(wikiToken);
  const blocks = await getDocumentBlocks(node.objToken);
  const markdown = blocksToMarkdown(blocks);

  return success(
    `✅ Wiki 讀取成功`,
    truncate(markdown)
  );
}

/**
 * 在頂部插入內容
 */
async function wikiPrepend(
  wikiToken: string,
  content: string
): Promise<ToolResponse> {
  if (!wikiToken) {
    return error("缺少 wiki_token 參數");
  }
  if (!content) {
    return error("缺少 content 參數");
  }

  const node = await getWikiNode(wikiToken);
  const rootBlockId = await getDocumentRootBlockId(node.objToken);
  const blocks = markdownToBlocks(content);

  await insertBlocks(node.objToken, rootBlockId, blocks, 0);

  return success(
    `✅ 已在 Wiki 頂部插入 ${blocks.length} 個區塊`,
    `Wiki URL: https://yjpo88r1gcti.jp.larksuite.com/wiki/${wikiToken}`
  );
}

/**
 * 在底部追加內容
 */
async function wikiAppend(
  wikiToken: string,
  content: string
): Promise<ToolResponse> {
  if (!wikiToken) {
    return error("缺少 wiki_token 參數");
  }
  if (!content) {
    return error("缺少 content 參數");
  }

  const node = await getWikiNode(wikiToken);
  const rootBlockId = await getDocumentRootBlockId(node.objToken);

  // 取得目前區塊數量以決定插入位置
  const existingBlocks = await getDocumentBlocks(node.objToken);
  const insertIndex = existingBlocks.length - 1; // 最後位置

  const blocks = markdownToBlocks(content);

  await insertBlocks(node.objToken, rootBlockId, blocks, Math.max(0, insertIndex));

  return success(
    `✅ 已在 Wiki 底部追加 ${blocks.length} 個區塊`,
    `Wiki URL: https://yjpo88r1gcti.jp.larksuite.com/wiki/${wikiToken}`
  );
}

/**
 * 在指定位置插入區塊
 */
async function wikiInsertBlocks(
  wikiToken: string,
  content: string,
  index: number
): Promise<ToolResponse> {
  if (!wikiToken) {
    return error("缺少 wiki_token 參數");
  }
  if (!content) {
    return error("缺少 content 參數");
  }

  const node = await getWikiNode(wikiToken);
  const rootBlockId = await getDocumentRootBlockId(node.objToken);
  const blocks = markdownToBlocks(content);

  await insertBlocks(node.objToken, rootBlockId, blocks, index);

  return success(
    `✅ 已在位置 ${index} 插入 ${blocks.length} 個區塊`,
    `Wiki URL: https://yjpo88r1gcti.jp.larksuite.com/wiki/${wikiToken}`
  );
}

/**
 * 搜尋 Wiki
 */
async function wikiSearch(
  spaceId: string,
  query: string
): Promise<ToolResponse> {
  if (!spaceId) {
    return error("缺少 space_id 參數");
  }
  if (!query) {
    return error("缺少 query 參數");
  }

  const data = await larkRequest<{
    items?: Array<{
      node_token?: string;
      title?: string;
      obj_type?: string;
    }>;
  }>(`/wiki/v2/spaces/${spaceId}/nodes`, {
    params: { page_size: 50 },
  });

  // 客戶端過濾（Lark Wiki API 不支援搜尋）
  const filtered = (data.items || []).filter((item) =>
    item.title?.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    return success(`🔍 搜尋 "${query}" 無結果`);
  }

  const simplified = simplifyNodeList(filtered);
  return success(`🔍 搜尋 "${query}" 找到 ${simplified.length} 個結果`, simplified);
}

/**
 * 列出 Wiki 節點
 */
async function wikiListNodes(
  spaceId: string,
  parentNodeToken?: string
): Promise<ToolResponse> {
  if (!spaceId) {
    return error("缺少 space_id 參數");
  }

  const params: Record<string, string | number> = { page_size: 50 };
  if (parentNodeToken) {
    params.parent_node_token = parentNodeToken;
  }

  const data = await larkRequest<{
    items?: Array<{
      node_token?: string;
      obj_token?: string;
      title?: string;
      obj_type?: string;
      has_child?: boolean;
    }>;
  }>(`/wiki/v2/spaces/${spaceId}/nodes`, { params });

  const simplified = simplifyNodeList(data.items || []);
  return success(`📂 共 ${simplified.length} 個節點`, simplified);
}

/**
 * 列出所有 Wiki 空間
 */
async function wikiSpaces(): Promise<ToolResponse> {
  const data = await larkRequest<{
    items?: Array<{
      space_id?: string;
      name?: string;
      description?: string;
    }>;
  }>("/wiki/v2/spaces", {
    params: { page_size: 50 },
  });

  const spaces = data.items || [];
  const simplified = spaces.map((s) => ({
    space_id: s.space_id,
    name: s.name,
    description: s.description,
  }));

  return success(`📚 共 ${simplified.length} 個 Wiki 空間`, simplified);
}

/**
 * 全域搜尋（使用 drive:drive 權限）
 */
async function searchAll(query: string): Promise<ToolResponse> {
  if (!query) {
    return error("缺少 query 參數");
  }

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
      count: 50,
    },
  });

  const files = data.files || [];

  if (files.length === 0) {
    return success(`🔍 搜尋 "${query}" 無結果`);
  }

  const simplified = files.map((f) => ({
    token: f.token,
    type: f.type,
    name: f.name,
    url: f.url,
  }));

  return success(`🔍 搜尋 "${query}" 找到 ${simplified.length} 個結果`, simplified);
}
