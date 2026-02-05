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
  content: z
    .string()
    .optional()
    .describe("Initial content in Markdown format (optional)"),
}).merge(ResponseFormatSchema);

/**
 * 讀取文件
 */
export const DocReadSchema = DocumentIdSchema.merge(ResponseFormatSchema);

/**
 * 更新文件 (支援範圍更新)
 */
export const DocUpdateSchema = DocumentIdSchema.extend({
  content: z
    .string()
    .min(1)
    .describe("New Markdown content"),
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
 * 插入區塊
 */
export const DocInsertBlocksSchema = DocumentIdSchema.extend({
  content: z
    .string()
    .min(1)
    .describe("Markdown content to insert"),
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
 * 搜尋文件
 */
export const DocSearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search keyword (required)"),
  folder_token: z
    .string()
    .optional()
    .describe("Limit search to specific folder (optional)"),
}).merge(SearchPaginationSchema).merge(ResponseFormatSchema);

/**
 * 列出雲端硬碟檔案
 */
export const DriveListSchema = z.object({
  folder_token: z
    .string()
    .optional()
    .describe("Folder token (optional, omit for root directory)"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema);

// 型別匯出
export type DocCreateInput = z.infer<typeof DocCreateSchema>;
export type DocReadInput = z.infer<typeof DocReadSchema>;
export type DocUpdateInput = z.infer<typeof DocUpdateSchema>;
export type DocDeleteInput = z.infer<typeof DocDeleteSchema>;
export type DocInsertBlocksInput = z.infer<typeof DocInsertBlocksSchema>;
export type DocDeleteBlocksInput = z.infer<typeof DocDeleteBlocksSchema>;
export type DocSearchInput = z.infer<typeof DocSearchSchema>;
export type DriveListInput = z.infer<typeof DriveListSchema>;
