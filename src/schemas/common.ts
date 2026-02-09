/**
 * 通用 Zod Schema 定義
 */

import { z } from "zod";
import { ResponseFormat, MAX_PAGE_SIZE } from "../constants.js";

/**
 * List 工具分頁參數 Schema（預設 20）
 */
export const ListPaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(20)
    .describe("Max results (default: 20)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset"),
});

/**
 * Search 工具分頁參數 Schema（預設 10）
 */
export const SearchPaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(10)
    .describe("Max results (default: 10)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset"),
});

/**
 * 分頁參數 Schema（舊版相容，預設 20）
 */
export const PaginationSchema = ListPaginationSchema;

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

export type ListPaginationInput = z.infer<typeof ListPaginationSchema>;
export type SearchPaginationInput = z.infer<typeof SearchPaginationSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type ResponseFormatInput = z.infer<typeof ResponseFormatSchema>;
export type ListOptionsInput = z.infer<typeof ListOptionsSchema>;
export type SearchOptionsInput = z.infer<typeof SearchOptionsSchema>;
