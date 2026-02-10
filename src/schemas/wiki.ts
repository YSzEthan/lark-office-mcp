/**
 * Wiki 工具 Zod Schema 定義
 */

import { z } from "zod";
import { ListPaginationSchema, SearchPaginationSchema, ResponseFormatSchema } from "./common.js";

/**
 * Wiki Token 參數
 */
export const WikiTokenSchema = z.object({
  wiki_token: z
    .string()
    .min(1)
    .describe("Wiki node token (required)"),
});

/**
 * Wiki 讀取
 */
export const WikiReadSchema = WikiTokenSchema;

/**
 * Wiki 內容操作 (prepend, append, update)
 */
export const WikiContentSchema = WikiTokenSchema.extend({
  content: z
    .string()
    .min(1)
    .describe("Markdown content to insert"),
});

/**
 * Wiki 更新 (支援範圍更新)
 */
export const WikiUpdateSchema = WikiContentSchema.extend({
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
 * Wiki 插入區塊
 */
export const WikiInsertBlocksSchema = WikiContentSchema.extend({
  index: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Insert position index (0-based, default: 0)"),
});

/**
 * Wiki 刪除區塊
 */
export const WikiDeleteBlocksSchema = WikiTokenSchema.extend({
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
 * Wiki 列出節點
 */
export const WikiListNodesSchema = z.object({
  space_id: z
    .string()
    .min(1)
    .describe("Wiki space ID (required)"),
  parent_node_token: z
    .string()
    .optional()
    .describe("Parent node token (optional, omit for root nodes)"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema);

/**
 * Wiki 空間列表
 */
export const WikiSpacesSchema = ListPaginationSchema.merge(ResponseFormatSchema);

/**
 * Wiki 建立節點
 */
export const WikiCreateNodeSchema = z.object({
  space_id: z
    .string()
    .min(1)
    .describe("Wiki space ID (required)"),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Node title (required)"),
  parent_node_token: z
    .string()
    .optional()
    .describe("Parent node token (optional, omit for root)"),
  obj_type: z
    .enum(["doc", "docx", "sheet", "bitable", "mindnote", "file"])
    .default("docx")
    .describe("Node type: doc/docx/sheet/bitable/mindnote/file (default: docx)"),
}).merge(ResponseFormatSchema);

/**
 * Wiki 移動節點
 */
export const WikiMoveNodeSchema = z.object({
  space_id: z
    .string()
    .min(1)
    .describe("Current Wiki space ID (required)"),
  node_token: z
    .string()
    .min(1)
    .describe("Node token to move (required)"),
  target_parent_token: z
    .string()
    .optional()
    .describe("Target parent node token (omit to move to space root)"),
  target_space_id: z
    .string()
    .optional()
    .describe("Target space ID for cross-space move (optional)"),
});

/**
 * 全域搜尋（整合 doc_search, wiki_search）
 */
export const SearchAllSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search keyword (required)"),
  doc_type: z
    .enum(["all", "doc", "docx", "sheet", "bitable", "wiki", "file"])
    .optional()
    .describe("Filter by document type (optional)"),
  folder_token: z
    .string()
    .optional()
    .describe("Limit to specific folder (optional)"),
  wiki_space_id: z
    .string()
    .optional()
    .describe("Limit to specific wiki space (optional)"),
}).merge(SearchPaginationSchema).merge(ResponseFormatSchema);

// 型別匯出
export type WikiReadInput = z.infer<typeof WikiReadSchema>;
export type WikiContentInput = z.infer<typeof WikiContentSchema>;
export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;
export type WikiInsertBlocksInput = z.infer<typeof WikiInsertBlocksSchema>;
export type WikiDeleteBlocksInput = z.infer<typeof WikiDeleteBlocksSchema>;
export type WikiListNodesInput = z.infer<typeof WikiListNodesSchema>;
export type WikiSpacesInput = z.infer<typeof WikiSpacesSchema>;
export type WikiCreateNodeInput = z.infer<typeof WikiCreateNodeSchema>;
export type WikiMoveNodeInput = z.infer<typeof WikiMoveNodeSchema>;
export type SearchAllInput = z.infer<typeof SearchAllSchema>;
