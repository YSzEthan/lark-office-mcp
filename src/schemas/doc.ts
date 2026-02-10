/**
 * 文件工具 Zod Schema 定義
 */

import { z } from "zod";
import { ListPaginationSchema, SearchPaginationSchema, ResponseFormatSchema } from "./common.js";

/**
 * Document ID 參數
 */
export const DocumentIdSchema = z.object({
  document_id: z
    .string()
    .min(1)
    .describe("Document ID (required)"),
});

/**
 * 建立文件
 */
export const DocCreateSchema = z.object({
  folder_token: z
    .string()
    .min(1)
    .describe("Target folder token (required)"),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Document title"),
  blocks: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Initial content as Lark Block JSON array (optional)"),
}).merge(ResponseFormatSchema);

/**
 * 讀取文件
 */
export const DocReadSchema = DocumentIdSchema;

/**
 * Blocks 轉 Markdown
 */
export const BlocksToMarkdownSchema = z.object({
  blocks: z
    .array(z.record(z.unknown()))
    .describe("Lark blocks array from wiki_read or doc_read"),
});

/**
 * 更新文件 (支援範圍更新)
 */
export const DocUpdateSchema = DocumentIdSchema.extend({
  blocks: z
    .array(z.record(z.unknown()))
    .min(1)
    .describe("Lark Block JSON array"),
  start_index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Start index for range update (optional, must use with end_index)"),
  end_index: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("End index for range update (exclusive, optional)"),
});

/**
 * 刪除文件
 */
export const DocDeleteSchema = DocumentIdSchema;

/**
 * 文件內容操作 (prepend, append)
 */
export const DocContentSchema = DocumentIdSchema.extend({
  blocks: z
    .array(z.record(z.unknown()))
    .min(1)
    .describe("Lark Block JSON array"),
});

/**
 * 移動文件
 */
export const DocMoveSchema = z.object({
  file_token: z
    .string()
    .min(1)
    .describe("File token to move (required)"),
  folder_token: z
    .string()
    .min(1)
    .describe("Target folder token (required)"),
  type: z
    .enum(["doc", "docx", "sheet", "bitable", "file", "folder"])
    .default("docx")
    .describe("File type: doc/docx/sheet/bitable/file/folder (default: docx)"),
}).merge(ResponseFormatSchema);

/**
 * 插入區塊
 */
export const DocInsertBlocksSchema = DocumentIdSchema.extend({
  blocks: z
    .array(z.record(z.unknown()))
    .min(1)
    .describe("Lark Block JSON array"),
  index: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Insert position index (0-based, default: 0)"),
});

/**
 * 刪除區塊
 */
export const DocDeleteBlocksSchema = DocumentIdSchema.extend({
  start_index: z
    .number()
    .int()
    .min(0)
    .describe("Start index (0-based, required)"),
  end_index: z
    .number()
    .int()
    .min(1)
    .describe("End index (exclusive, required)"),
});

/**
 * 移動區塊
 */
export const DocMoveBlocksSchema = DocumentIdSchema.extend({
  start_index: z
    .number()
    .int()
    .min(0)
    .describe("Start index of blocks to move (0-based, required)"),
  end_index: z
    .number()
    .int()
    .min(1)
    .describe("End index of blocks to move (exclusive, required)"),
  target_index: z
    .number()
    .int()
    .min(0)
    .describe("Target position to move blocks to (0-based, required)"),
});

/**
 * 列出雲端硬碟檔案
 */
export const DriveListSchema = z.object({
  folder_token: z
    .string()
    .optional()
    .describe("Folder token (optional, omit for root directory)"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema);

/**
 * 最近存取的檔案
 */
export const DriveRecentSchema = ListPaginationSchema.merge(ResponseFormatSchema);

// 型別匯出
export type DocCreateInput = z.infer<typeof DocCreateSchema>;
export type DocReadInput = z.infer<typeof DocReadSchema>;
export type DocUpdateInput = z.infer<typeof DocUpdateSchema>;
export type DocDeleteInput = z.infer<typeof DocDeleteSchema>;
export type DocContentInput = z.infer<typeof DocContentSchema>;
export type DocMoveInput = z.infer<typeof DocMoveSchema>;
export type DocInsertBlocksInput = z.infer<typeof DocInsertBlocksSchema>;
export type DocDeleteBlocksInput = z.infer<typeof DocDeleteBlocksSchema>;
export type DocMoveBlocksInput = z.infer<typeof DocMoveBlocksSchema>;
export type DriveListInput = z.infer<typeof DriveListSchema>;
export type DriveRecentInput = z.infer<typeof DriveRecentSchema>;
