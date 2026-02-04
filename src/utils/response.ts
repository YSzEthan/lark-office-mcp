/**
 * 回應精簡化處理工具
 * 解決 API 回應過於詳盡的問題
 */

/**
 * MCP 工具回應格式
 */
export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * 建立成功回應
 */
export function success(message: string, data?: unknown): ToolResponse {
  let text = message;

  if (data !== undefined) {
    if (typeof data === "string") {
      text += `\n\n${data}`;
    } else {
      // 精簡化 JSON 輸出
      text += `\n\n${JSON.stringify(data, null, 2)}`;
    }
  }

  return {
    content: [{ type: "text", text }],
  };
}

/**
 * 建立錯誤回應
 */
export function error(message: string, details?: unknown): ToolResponse {
  let text = `${message}`;

  if (details) {
    if (details instanceof Error) {
      text += `\n\n錯誤詳情: ${details.message}`;
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
 * 精簡化 Wiki 節點清單
 */
export function simplifyNodeList(nodes: Array<{
  node_token?: string;
  obj_token?: string;
  title?: string;
  obj_type?: string;
  has_child?: boolean;
}>): Array<{
  token: string;
  title: string;
  type: string;
  hasChildren: boolean;
}> {
  return nodes.map((node) => ({
    token: node.node_token || node.obj_token || "",
    title: node.title || "無標題",
    type: node.obj_type || "unknown",
    hasChildren: node.has_child || false,
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
  dueTime?: string;
  isCompleted: boolean;
  creator?: string;
} {
  return {
    id: todo.guid || "",
    summary: todo.summary || "",
    ...(todo.description && { description: todo.description }),
    ...(todo.due?.timestamp && { dueTime: todo.due.timestamp }),
    isCompleted: !!todo.completed_at,
    ...(todo.creator?.name && { creator: todo.creator.name }),
  };
}

/**
 * 精簡化待辦事項清單
 */
export function simplifyTodoList(todos: Array<{
  guid?: string;
  summary?: string;
  description?: string;
  due?: { timestamp?: string; is_all_day?: boolean };
  completed_at?: string;
  creator?: { id?: string; name?: string };
}>): Array<ReturnType<typeof simplifyTodo>> {
  return todos.map(simplifyTodo);
}

/**
 * 精簡化搜尋結果
 */
export function simplifySearchResults(results: Array<{
  doc_id?: string;
  title?: string;
  url?: string;
  type?: string;
  create_time?: number;
  update_time?: number;
}>): Array<{
  id: string;
  title: string;
  url?: string;
  type: string;
}> {
  return results.map((item) => ({
    id: item.doc_id || "",
    title: item.title || "無標題",
    ...(item.url && { url: item.url }),
    type: item.type || "unknown",
  }));
}

/**
 * 截斷過長的文字
 */
export function truncate(text: string, maxLength = 5000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n\n... (內容已截斷)";
}
