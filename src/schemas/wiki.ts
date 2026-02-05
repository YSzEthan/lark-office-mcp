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
export const WikiReadSchema = WikiTokenSchema.merge(ResponseFormatSchema);

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
 * Wiki 搜尋
 */
export const WikiSearchSchema = z.object({
  space_id: z
    .string()
    .min(1)
    .describe("Wiki space ID (required)"),
  query: z
    .string()
    .min(1)
    .describe("Search keyword"),
}).merge(SearchPaginationSchema).merge(ResponseFormatSchema);

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
 * 全域搜尋
 */
export const SearchAllSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search keyword (required)"),
}).merge(SearchPaginationSchema).merge(ResponseFormatSchema);

// 型別匯出
export type WikiReadInput = z.infer<typeof WikiReadSchema>;
export type WikiContentInput = z.infer<typeof WikiContentSchema>;
export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;
export type WikiInsertBlocksInput = z.infer<typeof WikiInsertBlocksSchema>;
export type WikiDeleteBlocksInput = z.infer<typeof WikiDeleteBlocksSchema>;
export type WikiSearchInput = z.infer<typeof WikiSearchSchema>;
export type WikiListNodesInput = z.infer<typeof WikiListNodesSchema>;
export type WikiSpacesInput = z.infer<typeof WikiSpacesSchema>;
export type SearchAllInput = z.infer<typeof SearchAllSchema>;
