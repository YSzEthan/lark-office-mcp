/**
 * 通用 Zod Schema 定義
 */

import { z } from "zod";
import { ResponseFormat, MAX_PAGE_SIZE } from "../constants.js";

// ─── MCP string coercion helpers ────────────────────────────
// Claude Code 透過 MCP protocol 傳參時，所有值可能是 JSON 字串。
// 以下 helpers 讓 Zod schema 能自動 parse string → 正確型別。

/** string → number coercion（用於 index / limit / offset 等） */
export const coerceNumber = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }
  return v;
}, z.number());

/** string → boolean coercion */
export const coerceBoolean = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}, z.boolean());

/** string → array coercion（用於 blocks / members 等） */
export function coerceArray<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : v; }
      catch { return v; }
    }
    return v;
  }, z.array(itemSchema));
}

/**
 * List 工具分頁參數 Schema（預設 20）
 */
export const ListPaginationSchema = z.object({
  limit: coerceNumber
    .pipe(z.number().int().min(1).max(MAX_PAGE_SIZE))
    .default(20)
    .describe("Max results (default: 20)"),
  offset: coerceNumber
    .pipe(z.number().int().min(0))
    .default(0)
    .describe("Pagination offset"),
});

/**
 * Search 工具分頁參數 Schema（預設 10）
 */
export const SearchPaginationSchema = z.object({
  limit: coerceNumber
    .pipe(z.number().int().min(1).max(MAX_PAGE_SIZE))
    .default(10)
    .describe("Max results (default: 10)"),
  offset: coerceNumber
    .pipe(z.number().int().min(0))
    .default(0)
    .describe("Pagination offset"),
});

/**
 * 回應格式參數 Schema
 */
export const ResponseFormatSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.JSON)
    .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
});

/**
 * 結合 List 分頁與回應格式
 */
export const ListOptionsSchema = ListPaginationSchema.merge(ResponseFormatSchema);

/**
 * 結合 Search 分頁與回應格式
 */
export const SearchOptionsSchema = SearchPaginationSchema.merge(ResponseFormatSchema);

/**
 * 分頁 Output 共用欄位
 */
export const PaginationOutputFields = {
  count: z.number().describe("Number of items returned"),
  offset: z.number().describe("Current pagination offset"),
  has_more: z.boolean().describe("Whether more items are available"),
  next_offset: z.number().optional().describe("Offset for next page (only present when has_more is true)"),
};

export type ListPaginationInput = z.infer<typeof ListPaginationSchema>;
export type SearchPaginationInput = z.infer<typeof SearchPaginationSchema>;
export type ResponseFormatInput = z.infer<typeof ResponseFormatSchema>;
export type ListOptionsInput = z.infer<typeof ListOptionsSchema>;
export type SearchOptionsInput = z.infer<typeof SearchOptionsSchema>;
