/**
 * Lark API Rate Limiter
 *
 * 根據官方文件：
 * - 單一應用 QPS: 3 次/秒
 * - 文件並發編輯: 3 次/秒/文件
 */

import { RATE_LIMIT_INTERVAL_MS } from "../constants.js";

/**
 * 基礎 Rate Limiter
 * 使用簡單的時間間隔控制來限制請求頻率
 */
export class RateLimiter {
  private lastRequestTime = 0;
  private minInterval: number;

  constructor(minInterval = RATE_LIMIT_INTERVAL_MS) {
    this.minInterval = minInterval;
  }

  /**
   * 在執行請求前等待必要的時間間隔
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const wait = Math.max(0, this.minInterval - elapsed);

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    this.lastRequestTime = Date.now();
    return fn();
  }
}

/**
 * 文件級別 Rate Limiter
 * 為每個文件維護獨立的 Rate Limiter，避免同一文件的並發編輯衝突
 */
export class DocumentRateLimiter {
  private limiters = new Map<string, RateLimiter>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly maxAge = 60000; // 1 分鐘後清理未使用的 limiter

  constructor() {
    // 定期清理未使用的 limiters 以避免記憶體洩漏
    this.cleanupInterval = setInterval(() => this.cleanup(), this.maxAge);
  }

  /**
   * 對特定文件的操作進行節流
   */
  async throttle<T>(documentId: string, fn: () => Promise<T>): Promise<T> {
    let limiter = this.limiters.get(documentId);
    if (!limiter) {
      limiter = new RateLimiter();
      this.limiters.set(documentId, limiter);
    }
    return limiter.throttle(fn);
  }

  /**
   * 清理長時間未使用的 limiters
   */
  private cleanup(): void {
    // 簡單的清理策略：如果 limiters 超過 100 個，清除一半
    if (this.limiters.size > 100) {
      const entries = Array.from(this.limiters.entries());
      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      for (const [key] of toDelete) {
        this.limiters.delete(key);
      }
    }
  }

  /**
   * 銷毀 limiter（用於清理資源）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limiters.clear();
  }
}

// 全域單例
export const globalRateLimiter = new RateLimiter();
export const documentRateLimiter = new DocumentRateLimiter();
