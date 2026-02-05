/**
 * Lark API 錯誤處理工具
 * 基於官方文件定義錯誤碼和處理邏輯
 */

/**
 * Lark API 錯誤碼列舉
 */
export enum LarkErrorCode {
  // 通用錯誤
  SUCCESS = 0,
  RATE_LIMIT = 99991400,
  PERMISSION_DENIED = 99991401,
  TENANT_TOKEN_INVALID = 99991663,
  USER_TOKEN_INVALID = 99991664,
  TOKEN_EXPIRED = 99991665,
  RESOURCE_ACCESS_DENIED = 99991668,

  // 文件相關錯誤
  DOC_NOT_FOUND = 1770001,
  BLOCK_NOT_FOUND = 1770002,
  DOC_NO_EDIT_PERMISSION = 1770003,
  BLOCK_TYPE_NOT_SUPPORTED = 1770004,
  CONCURRENT_EDIT_CONFLICT = 1770010,

  // 任務相關錯誤
  TASK_NOT_FOUND = 11000,
  TASK_NO_PERMISSION = 11001,
}

/**
 * 可重試的錯誤碼
 */
export const RETRYABLE_CODES = new Set<LarkErrorCode>([
  LarkErrorCode.RATE_LIMIT,
  LarkErrorCode.TENANT_TOKEN_INVALID,
  LarkErrorCode.TOKEN_EXPIRED,
  LarkErrorCode.CONCURRENT_EDIT_CONFLICT,
]);

/**
 * 錯誤資訊對照表
 */
const ERROR_INFO: Record<number, { description: string; suggestion: string }> = {
  [LarkErrorCode.RATE_LIMIT]: {
    description: "API rate limit exceeded",
    suggestion: "Wait a moment and try again. The system will automatically retry.",
  },
  [LarkErrorCode.PERMISSION_DENIED]: {
    description: "Permission denied",
    suggestion: "Check if the required scope is enabled in Lark app settings.",
  },
  [LarkErrorCode.TENANT_TOKEN_INVALID]: {
    description: "Tenant token invalid",
    suggestion: "Token will be refreshed automatically. If issue persists, re-authorize with lark_auth_url.",
  },
  [LarkErrorCode.USER_TOKEN_INVALID]: {
    description: "User token invalid",
    suggestion: "Use lark_auth_url to get a new authorization URL and re-authorize.",
  },
  [LarkErrorCode.TOKEN_EXPIRED]: {
    description: "Token expired",
    suggestion: "Token will be refreshed automatically. If issue persists, re-authorize with lark_auth_url.",
  },
  [LarkErrorCode.RESOURCE_ACCESS_DENIED]: {
    description: "Resource access denied",
    suggestion: "Ensure you have permission to access this resource. Check sharing settings.",
  },
  [LarkErrorCode.DOC_NOT_FOUND]: {
    description: "Document not found",
    suggestion: "Verify the document ID/token is correct. The document may have been deleted.",
  },
  [LarkErrorCode.BLOCK_NOT_FOUND]: {
    description: "Block not found",
    suggestion: "Verify the block ID is correct. The block may have been deleted.",
  },
  [LarkErrorCode.DOC_NO_EDIT_PERMISSION]: {
    description: "No edit permission for document",
    suggestion: "Request edit access from the document owner.",
  },
  [LarkErrorCode.BLOCK_TYPE_NOT_SUPPORTED]: {
    description: "Block type not supported",
    suggestion: "This operation is not supported for this block type.",
  },
  [LarkErrorCode.CONCURRENT_EDIT_CONFLICT]: {
    description: "Concurrent edit conflict",
    suggestion: "Another user is editing this document. The system will automatically retry.",
  },
  [LarkErrorCode.TASK_NOT_FOUND]: {
    description: "Task not found",
    suggestion: "Verify the task ID is correct. The task may have been deleted.",
  },
  [LarkErrorCode.TASK_NO_PERMISSION]: {
    description: "No permission to access task",
    suggestion: "Request access from the task owner.",
  },
};

/**
 * LarkError 類別
 */
export class LarkError extends Error {
  readonly code: LarkErrorCode;
  readonly endpoint?: string;
  readonly retryable: boolean;

  constructor(code: number, msg: string, endpoint?: string) {
    super(msg);
    this.name = "LarkError";
    this.code = code as LarkErrorCode;
    this.endpoint = endpoint;
    this.retryable = RETRYABLE_CODES.has(this.code);
  }
}

/**
 * 取得錯誤資訊
 */
export function getErrorInfo(code: number): { description: string; suggestion: string } {
  return (
    ERROR_INFO[code] || {
      description: "Unknown error",
      suggestion: "Check Lark API documentation for error code details.",
    }
  );
}

/**
 * 格式化 LarkError 為結構化訊息
 * 符合 MCP Best Practices：包含錯誤碼、描述、建議
 */
export function formatLarkError(error: LarkError): string {
  const info = getErrorInfo(error.code);
  const lines: string[] = [
    `**Error Code**: ${error.code}`,
    `**Description**: ${info.description}`,
    `**Message**: ${error.message}`,
  ];

  if (error.endpoint) {
    lines.push(`**Endpoint**: ${error.endpoint}`);
  }

  lines.push(`**Suggestion**: ${info.suggestion}`);

  if (error.retryable) {
    lines.push(`**Note**: This error is retryable and will be automatically retried.`);
  }

  return lines.join("\n");
}
