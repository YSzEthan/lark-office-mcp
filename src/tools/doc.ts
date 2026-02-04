/**
 * 文件相關工具
 * 精簡版 API，只接受 Markdown 輸入
 */

import {
  createDocument,
  getDocumentBlocks,
  getDocumentRootBlockId,
  insertBlocks,
  larkRequest,
} from "../lark-client.js";
import { markdownToBlocks, blocksToMarkdown } from "../utils/markdown.js";
import { success, error, simplifySearchResults, truncate, type ToolResponse } from "../utils/response.js";

/**
 * 工具定義
 */
export const docTools = [
  {
    name: "doc_create",
    description: "建立新文件",
    inputSchema: {
      type: "object" as const,
      properties: {
        folder_token: {
          type: "string",
          description: "目標資料夾 Token（必填）",
        },
        title: {
          type: "string",
          description: "文件標題",
        },
        content: {
          type: "string",
          description: "初始內容（Markdown 格式，可選）",
        },
      },
      required: ["folder_token", "title"],
    },
  },
  {
    name: "doc_read",
    description: "讀取文件內容，回傳 Markdown 格式",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "文件 ID（必填）",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "doc_update",
    description: "更新文件內容（清空後重寫）",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "文件 ID（必填）",
        },
        content: {
          type: "string",
          description: "新的 Markdown 內容",
        },
      },
      required: ["document_id", "content"],
    },
  },
  {
    name: "doc_delete",
    description: "刪除文件",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "文件 ID（必填）",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "doc_insert_blocks",
    description: "在文件指定位置插入內容區塊",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "文件 ID（必填）",
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
      required: ["document_id", "content"],
    },
  },
  {
    name: "doc_search",
    description: "搜尋文件",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "搜尋關鍵字（必填）",
        },
        folder_token: {
          type: "string",
          description: "限定搜尋的資料夾 Token（可選）",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "drive_list",
    description: "列出雲端硬碟檔案和資料夾",
    inputSchema: {
      type: "object" as const,
      properties: {
        folder_token: {
          type: "string",
          description: "資料夾 Token（可選，不填則列出根目錄）",
        },
      },
    },
  },
];

/**
 * 處理文件工具呼叫
 */
export async function handleDocTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    switch (name) {
      case "doc_create":
        return await docCreate(
          args.folder_token as string,
          args.title as string,
          args.content as string | undefined
        );

      case "doc_read":
        return await docRead(args.document_id as string);

      case "doc_update":
        return await docUpdate(
          args.document_id as string,
          args.content as string
        );

      case "doc_delete":
        return await docDelete(args.document_id as string);

      case "doc_insert_blocks":
        return await docInsertBlocks(
          args.document_id as string,
          args.content as string,
          (args.index as number) ?? 0
        );

      case "doc_search":
        return await docSearch(
          args.query as string,
          args.folder_token as string | undefined
        );

      case "drive_list":
        return await driveList(args.folder_token as string | undefined);

      default:
        return error(`未知的文件工具: ${name}`);
    }
  } catch (err) {
    return error("文件操作失敗", err);
  }
}

/**
 * 建立新文件
 */
async function docCreate(
  folderToken: string,
  title: string,
  content?: string
): Promise<ToolResponse> {
  if (!folderToken) {
    return error("缺少 folder_token 參數");
  }
  if (!title) {
    return error("缺少 title 參數");
  }

  const { documentId } = await createDocument(folderToken, title);

  // 如果有初始內容，插入到文件中
  if (content) {
    const rootBlockId = await getDocumentRootBlockId(documentId);
    const blocks = markdownToBlocks(content);
    await insertBlocks(documentId, rootBlockId, blocks, 0);
  }

  return success(`✅ 文件建立成功`, {
    documentId,
    title,
    url: `https://yjpo88r1gcti.jp.larksuite.com/docx/${documentId}`,
  });
}

/**
 * 讀取文件
 */
async function docRead(documentId: string): Promise<ToolResponse> {
  if (!documentId) {
    return error("缺少 document_id 參數");
  }

  const blocks = await getDocumentBlocks(documentId);
  const markdown = blocksToMarkdown(blocks);

  return success(`✅ 文件讀取成功`, truncate(markdown));
}

/**
 * 更新文件內容
 */
async function docUpdate(
  documentId: string,
  content: string
): Promise<ToolResponse> {
  if (!documentId) {
    return error("缺少 document_id 參數");
  }
  if (!content) {
    return error("缺少 content 參數");
  }

  // 取得目前所有區塊
  const existingBlocks = await getDocumentBlocks(documentId);
  const rootBlockId = await getDocumentRootBlockId(documentId);

  // 刪除所有子區塊（保留根區塊）
  const childBlockIds = existingBlocks
    .filter((b) => b.parent_id === rootBlockId && b.block_id !== rootBlockId)
    .map((b) => b.block_id);

  if (childBlockIds.length > 0) {
    await larkRequest(`/docx/v1/documents/${documentId}/blocks/${rootBlockId}/children/batch_delete`, {
      method: "DELETE",
      body: {
        document_revision_id: -1,
        start_index: 0,
        end_index: childBlockIds.length,
      },
    });
  }

  // 插入新內容
  const blocks = markdownToBlocks(content);
  await insertBlocks(documentId, rootBlockId, blocks, 0);

  return success(`✅ 文件更新成功，插入 ${blocks.length} 個區塊`, {
    documentId,
    url: `https://yjpo88r1gcti.jp.larksuite.com/docx/${documentId}`,
  });
}

/**
 * 刪除文件
 */
async function docDelete(documentId: string): Promise<ToolResponse> {
  if (!documentId) {
    return error("缺少 document_id 參數");
  }

  // Lark API 不支援直接刪除文件，需要透過雲端硬碟 API
  await larkRequest(`/drive/v1/files/${documentId}`, {
    method: "DELETE",
    params: { type: "docx" },
  });

  return success(`✅ 文件已刪除`, { documentId });
}

/**
 * 在指定位置插入區塊
 */
async function docInsertBlocks(
  documentId: string,
  content: string,
  index: number
): Promise<ToolResponse> {
  if (!documentId) {
    return error("缺少 document_id 參數");
  }
  if (!content) {
    return error("缺少 content 參數");
  }

  const rootBlockId = await getDocumentRootBlockId(documentId);
  const blocks = markdownToBlocks(content);

  await insertBlocks(documentId, rootBlockId, blocks, index);

  return success(`✅ 已在位置 ${index} 插入 ${blocks.length} 個區塊`, {
    documentId,
    url: `https://yjpo88r1gcti.jp.larksuite.com/docx/${documentId}`,
  });
}

/**
 * 搜尋文件（使用 drive:drive 權限）
 */
async function docSearch(
  query: string,
  folderToken?: string
): Promise<ToolResponse> {
  if (!query) {
    return error("缺少 query 參數");
  }

  const body: Record<string, unknown> = {
    search_key: query,
    count: 50,
  };

  if (folderToken) {
    body.folder_token = folderToken;
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
    return success(`🔍 搜尋 "${query}" 無結果`);
  }

  const simplified = files.map((f) => ({
    token: f.token,
    name: f.name,
    type: f.type,
    url: f.url,
  }));

  return success(`🔍 搜尋 "${query}" 找到 ${simplified.length} 個結果`, simplified);
}

/**
 * 列出雲端硬碟檔案和資料夾
 */
async function driveList(folderToken?: string): Promise<ToolResponse> {
  const params: Record<string, string | number> = {
    page_size: 50,
  };

  if (folderToken) {
    params.folder_token = folderToken;
  }

  const data = await larkRequest<{
    files?: Array<{
      token?: string;
      name?: string;
      type?: string;
      parent_token?: string;
      url?: string;
      created_time?: string;
      modified_time?: string;
    }>;
    has_more?: boolean;
  }>("/drive/v1/files", { params });

  const files = data.files || [];

  if (files.length === 0) {
    return success(`📂 資料夾為空`);
  }

  const simplified = files.map((f) => ({
    token: f.token,
    name: f.name,
    type: f.type,
    parent_token: f.parent_token,
    url: f.url,
  }));

  return success(`📂 共 ${simplified.length} 個檔案/資料夾`, simplified);
}
