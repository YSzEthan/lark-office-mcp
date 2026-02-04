/**
 * 認證工具 Zod Schema 定義
 */

import { z } from "zod";

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

// 型別匯出
export type LarkAuthInput = z.infer<typeof LarkAuthSchema>;
export type LarkAuthUrlInput = z.infer<typeof LarkAuthUrlSchema>;
