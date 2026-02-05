/**
 * 重試機制
 * 實作指數退避（Exponential Backoff）策略
 */

import { LarkError, LarkErrorCode } from "./errors.js";
import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from "../constants.js";

/**
 * 重試選項
 */
export interface RetryOptions {
  /** 最大重試次數 */
  maxRetries: number;
  /** 基礎延遲時間（毫秒） */
  baseDelay: number;
  /** 最大延遲時間（毫秒） */
  maxDelay: number;
  /** 重試時的回調函數 */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: RETRY_MAX_ATTEMPTS,
  baseDelay: RETRY_BASE_DELAY_MS,
  maxDelay: RETRY_MAX_DELAY_MS,
};

/**
 * 計算指數退避延遲時間
 * 加入隨機抖動以避免雷群效應（thundering herd）
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // 指數退避: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // 加入 0-25% 的隨機抖動
  const jitter = exponentialDelay * Math.random() * 0.25;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * 檢查錯誤是否可重試
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof LarkError) {
    return error.retryable;
  }
  // 網路錯誤通常可重試
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused")
    );
  }
  return false;
}

/**
 * 帶重試的非同步函數執行
 *
 * @param fn 要執行的非同步函數
 * @param options 重試選項
 * @returns 函數執行結果
 * @throws 最後一次失敗的錯誤
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果不可重試或已達最大重試次數，直接拋出
      if (!isRetryable(error) || attempt === opts.maxRetries) {
        throw lastError;
      }

      // 計算延遲時間
      let delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay);

      // Rate limit 錯誤使用更長的延遲
      if (error instanceof LarkError && error.code === LarkErrorCode.RATE_LIMIT) {
        delay = Math.max(delay, 2000); // 至少等待 2 秒
      }

      // 觸發重試回調
      opts.onRetry?.(attempt + 1, lastError, delay);

      // 等待後重試
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 這行不應該被執行到，但 TypeScript 需要它
  throw lastError || new Error("Retry failed");
}

/**
 * 帶重試和 Token 自動刷新的非同步函數執行
 *
 * @param fn 要執行的非同步函數
 * @param refreshToken Token 刷新函數
 * @param options 重試選項
 * @returns 函數執行結果
 */
export async function withRetryAndRefresh<T>(
  fn: () => Promise<T>,
  refreshToken: () => Promise<void>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let tokenRefreshed = false;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Token 相關錯誤，嘗試刷新 Token
      if (
        error instanceof LarkError &&
        (error.code === LarkErrorCode.TENANT_TOKEN_INVALID ||
          error.code === LarkErrorCode.USER_TOKEN_INVALID ||
          error.code === LarkErrorCode.TOKEN_EXPIRED) &&
        !tokenRefreshed
      ) {
        try {
          await refreshToken();
          tokenRefreshed = true;
          // 刷新後立即重試，不計入重試次數
          continue;
        } catch (refreshError) {
          // Token 刷新失敗，拋出原始錯誤
          throw lastError;
        }
      }

      // 如果不可重試或已達最大重試次數，直接拋出
      if (!isRetryable(error) || attempt === opts.maxRetries) {
        throw lastError;
      }

      // 計算延遲時間
      let delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay);

      // Rate limit 錯誤使用更長的延遲
      if (error instanceof LarkError && error.code === LarkErrorCode.RATE_LIMIT) {
        delay = Math.max(delay, 2000);
      }

      // 觸發重試回調
      opts.onRetry?.(attempt + 1, lastError, delay);

      // 等待後重試
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Retry failed");
}
