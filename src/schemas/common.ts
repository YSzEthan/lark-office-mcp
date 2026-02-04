/**
 * 通用 Zod Schema 定義
 */

import { z } from "zod";
import { ResponseFormat, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

/**
 * 分頁參數 Schema
 */
export const PaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe("Maximum results to return (1-100, default: 50)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
});

/**
 * 回應格式參數 Schema
 */
export const ResponseFormatSchema = z.object({
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for structured data"),
});

/**
 * 結合分頁與回應格式
 */
export const ListOptionsSchema = PaginationSchema.merge(ResponseFormatSchema);

export type PaginationInput = z.infer<typeof PaginationSchema>;
export type ResponseFormatInput = z.infer<typeof ResponseFormatSchema>;
export type ListOptionsInput = z.infer<typeof ListOptionsSchema>;
