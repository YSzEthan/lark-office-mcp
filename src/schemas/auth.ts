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
}).strict();

/**
 * 取得授權連結 (無參數)
 */
export const LarkAuthUrlSchema = z.object({}).strict();

/**
 * 取得當前用戶資訊 (無參數)
 */
export const UserMeSchema = z.object({}).strict();

/**
 * 查詢用戶
 */
export const UserGetSchema = z.object({
  user_id: z
    .string()
    .min(1)
    .describe("User ID (open_id or user_id)"),
}).strict();

/**
 * 列出部門成員
 */
export const UserListSchema = z.object({
  department_id: z
    .string()
    .optional()
    .describe("Department ID (optional, omit for root department '0')"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema).strict();

// === Output Schemas ===

export const LarkAuthOutputSchema = z.object({
  expires_at: z.string().describe("Token expiry time (ISO 8601)"),
  base_url: z.string().describe("Lark API base URL"),
}).strict();

export const LarkAuthUrlOutputSchema = LarkAuthOutputSchema;

export const UserMeOutputSchema = z.object({
  open_id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string().optional(),
  en_name: z.string().optional(),
  email: z.string().optional(),
  mobile: z.string().optional(),
}).strict();

export const UserGetOutputSchema = z.object({
  open_id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string().optional(),
  en_name: z.string().optional(),
  email: z.string().optional(),
  mobile: z.string().optional(),
  department_ids: z.array(z.string()).optional(),
}).strict();

export const UserListOutputSchema = z.object({
  items: z.array(z.object({
    open_id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
  })),
  count: z.number(),
  offset: z.number(),
  has_more: z.boolean(),
  next_offset: z.number().optional(),
}).strict();

// 型別匯出
export type LarkAuthInput = z.infer<typeof LarkAuthSchema>;
export type LarkAuthUrlInput = z.infer<typeof LarkAuthUrlSchema>;
export type UserMeInput = z.infer<typeof UserMeSchema>;
export type UserGetInput = z.infer<typeof UserGetSchema>;
export type UserListInput = z.infer<typeof UserListSchema>;
