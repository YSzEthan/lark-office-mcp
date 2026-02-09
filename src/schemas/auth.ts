/**
 * 認證工具 Zod Schema 定義
 */

import { z } from "zod";
import { ResponseFormatSchema, ListPaginationSchema } from "./common.js";

/**
 * 授權碼認證
 */
export const LarkAuthSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe("Authorization code from OAuth redirect URL (required)"),
});

/**
 * 取得授權連結 (無參數)
 */
export const LarkAuthUrlSchema = z.object({});

/**
 * 取得當前用戶資訊 (無參數)
 */
export const UserMeSchema = z.object({});

/**
 * 查詢用戶
 */
export const UserGetSchema = z.object({
  user_id: z
    .string()
    .min(1)
    .describe("User ID (open_id or user_id)"),
});

/**
 * 列出部門成員
 */
export const UserListSchema = z.object({
  department_id: z
    .string()
    .optional()
    .describe("Department ID (optional, omit for root department '0')"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema);

// 型別匯出
export type LarkAuthInput = z.infer<typeof LarkAuthSchema>;
export type LarkAuthUrlInput = z.infer<typeof LarkAuthUrlSchema>;
export type UserMeInput = z.infer<typeof UserMeSchema>;
export type UserGetInput = z.infer<typeof UserGetSchema>;
export type UserListInput = z.infer<typeof UserListSchema>;
