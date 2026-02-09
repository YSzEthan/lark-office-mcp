/**
 * 回應處理工具
 */

import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import type { ToolResponse, PaginatedResponse } from "../types.js";
import { LarkError, formatLarkError } from "./errors.js";

/**
 * 建立成功回應
 */
export function success(
  message: string,
  data?: unknown,
  format: ResponseFormat = ResponseFormat.MARKDOWN
): ToolResponse {
  let text = message;
  let structuredContent: unknown = undefined;

  if (data !== undefined) {
    if (typeof data === "string") {
      text += `\n\n${data}`;
    } else {
      // MCP structuredContent 必須是 object，不能是 array
      structuredContent = Array.isArray(data) ? { items: data } : data;
      if (format === ResponseFormat.MARKDOWN) {
        text += `\n\n${formatAsMarkdown(data)}`;
      } else {
        text += `\n\n${JSON.stringify(data, null, 2)}`;
      }
    }
  }

  // 截斷過長內容
  if (text.length > CHARACTER_LIMIT) {
    text = text.slice(0, CHARACTER_LIMIT) + "\n\n... (content truncated)";
  }

  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}

/**
 * 建立錯誤回應
 * 符合 MCP Best Practices：結構化錯誤訊息、包含建議
 */
export function error(message: string, details?: unknown): ToolResponse {
  let text = `Error: ${message}`;

  if (details) {
    if (details instanceof LarkError) {
      // 使用結構化格式化（符合 MCP Best Practices）
      text += `\n\n${formatLarkError(details)}`;
    } else if (details instanceof Error) {
      text += `\n\nDetails: ${details.message}`;
      // 提供具體建議
      text += getSuggestion(details.message);
    } else if (typeof details === "string") {
      text += `\n\n${details}`;
    } else {
      text += `\n\n${JSON.stringify(details, null, 2)}`;
    }
  }

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * 根據錯誤訊息提供具體建議
 */
function getSuggestion(errorMessage: string): string {
  if (errorMessage.includes("Authorization required")) {
    return "\n\nSuggestion: Use lark_auth_url to get authorization URL, then submit the code with lark_auth.";
  }
  if (errorMessage.includes("99991663") || errorMessage.includes("token invalid")) {
    return "\n\nSuggestion: Token expired. Use lark_auth_url to re-authorize.";
  }
  if (errorMessage.includes("99991668") || errorMessage.includes("permission denied")) {
    return "\n\nSuggestion: Insufficient permissions. Check if the required scope is enabled in Lark app settings.";
  }
  if (errorMessage.includes("invalid param")) {
    return "\n\nSuggestion: Check parameter format and values. Ensure required fields are provided.";
  }
  if (errorMessage.includes("not found")) {
    return "\n\nSuggestion: Resource not found. Verify the token/ID is correct.";
  }
  return "";
}

/**
 * 將資料格式化為 Markdown
 */
function formatAsMarkdown(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "(empty)";
    return data.map((item, index) => formatItemAsMarkdown(item, index + 1)).join("\n\n");
  }
  return formatItemAsMarkdown(data, 0);
}

/**
 * 格式化單一項目為 Markdown
 */
function formatItemAsMarkdown(item: unknown, index: number): string {
  if (typeof item !== "object" || item === null) {
    return String(item);
  }

  const obj = item as Record<string, unknown>;
  const lines: string[] = [];

  // 嘗試找出標題欄位
  const titleKey = findTitleKey(obj);
  if (titleKey && index > 0) {
    lines.push(`### ${index}. ${obj[titleKey]}`);
  } else if (titleKey) {
    lines.push(`### ${obj[titleKey]}`);
  }

  // 格式化其他欄位
  for (const [key, value] of Object.entries(obj)) {
    if (key === titleKey) continue;
    if (value === undefined || value === null) continue;

    const displayKey = formatKey(key);
    if (typeof value === "object") {
      lines.push(`- **${displayKey}**: ${JSON.stringify(value)}`);
    } else {
      lines.push(`- **${displayKey}**: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * 找出標題欄位
 */
function findTitleKey(obj: Record<string, unknown>): string | null {
  const titleKeys = ["title", "name", "summary", "subject"];
  for (const key of titleKeys) {
    if (obj[key] && typeof obj[key] === "string") {
      return key;
    }
  }
  return null;
}

/**
 * 格式化欄位名稱
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * 建立分頁回應
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  offset: number,
  message: string,
  format: ResponseFormat = ResponseFormat.MARKDOWN
): ToolResponse {
  const response: PaginatedResponse<T> = {
    items,
    total,
    count: items.length,
    offset,
    has_more: total > offset + items.length,
    ...(total > offset + items.length ? { next_offset: offset + items.length } : {}),
  };

  return success(message, response, format);
}

/**
 * 精簡化 Wiki 節點清單
 */
export function simplifyNodeList(
  nodes: Array<{
    node_token?: string;
    obj_token?: string;
    title?: string;
    obj_type?: string;
    has_child?: boolean;
  }>
): Array<{
  token: string;
  title: string;
  type: string;
  has_children: boolean;
}> {
  return nodes.map((node) => ({
    token: node.node_token || node.obj_token || "",
    title: node.title || "(untitled)",
    type: node.obj_type || "unknown",
    has_children: node.has_child || false,
  }));
}

/**
 * 精簡化待辦事項
 */
export function simplifyTodo(todo: {
  guid?: string;
  summary?: string;
  description?: string;
  due?: { timestamp?: string; is_all_day?: boolean };
  completed_at?: string;
  creator?: { id?: string; name?: string };
}): {
  id: string;
  summary: string;
  description?: string;
  due_time?: string;
  is_completed: boolean;
  creator?: string;
} {
  return {
    id: todo.guid || "",
    summary: todo.summary || "",
    ...(todo.description && { description: todo.description }),
    ...(todo.due?.timestamp && { due_time: todo.due.timestamp }),
    is_completed: !!todo.completed_at && todo.completed_at !== "0",
    ...(todo.creator?.name && { creator: todo.creator.name }),
  };
}

/**
 * 精簡化待辦事項清單
 */
export function simplifyTodoList(
  todos: Array<{
    guid?: string;
    summary?: string;
    description?: string;
    due?: { timestamp?: string; is_all_day?: boolean };
    completed_at?: string;
    creator?: { id?: string; name?: string };
  }>
): Array<ReturnType<typeof simplifyTodo>> {
  return todos.map(simplifyTodo);
}

/**
 * 精簡化搜尋結果
 */
export function simplifySearchResults(
  results: Array<{
    token?: string;
    name?: string;
    type?: string;
    url?: string;
  }>
): Array<{
  token: string;
  name: string;
  type: string;
  url?: string;
}> {
  return results.map((item) => ({
    token: item.token || "",
    name: item.name || "(untitled)",
    type: item.type || "unknown",
    ...(item.url && { url: item.url }),
  }));
}

/**
 * 截斷過長的文字
 */
export function truncate(text: string, maxLength = CHARACTER_LIMIT): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n\n... (content truncated)";
}
