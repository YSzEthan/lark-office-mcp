/**
 * Lark MCP Server 型別定義
 */

/**
 * Token 資料結構
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * MCP 工具回應格式
 */
export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

/**
 * 分頁回應資料
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
}

/**
 * Lark Block 類型定義
 */
export interface LarkBlock {
  block_id: string;
  block_type: number;
  parent_id?: string;
  children?: string[];
  text?: LarkTextContent;
  heading1?: LarkTextContent;
  heading2?: LarkTextContent;
  heading3?: LarkTextContent;
  heading4?: LarkTextContent;
  heading5?: LarkTextContent;
  heading6?: LarkTextContent;
  heading7?: LarkTextContent;
  heading8?: LarkTextContent;
  heading9?: LarkTextContent;
  bullet?: LarkTextContent;
  ordered?: LarkTextContent;
  code?: LarkTextContent & { language?: number };
  quote?: LarkTextContent;
  todo?: LarkTextContent & { done?: boolean };
  divider?: Record<string, never>;
  image?: { token?: string };
  table?: { rows?: number; columns?: number };
  callout?: LarkTextContent & { background_color?: number; emoji_id?: string };
}

export interface LarkTextContent {
  elements?: Array<{
    text_run?: {
      content: string;
      text_element_style?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        inline_code?: boolean;
        link?: { url?: string };
      };
    };
    equation?: { content: string };
    mention_user?: { user_id: string };
    mention_doc?: { obj_type: number; token: string };
  }>;
  style?: {
    align?: number;
    folded?: boolean;
  };
}

/**
 * Wiki 節點資訊
 */
export interface WikiNode {
  node_token?: string;
  obj_token?: string;
  title?: string;
  obj_type?: string;
  has_child?: boolean;
  space_id?: string;
}

/**
 * Wiki 空間資訊
 */
export interface WikiSpace {
  space_id?: string;
  name?: string;
  description?: string;
}

/**
 * 文件搜尋結果
 */
export interface FileSearchResult {
  token?: string;
  name?: string;
  type?: string;
  url?: string;
  parent_token?: string;
  created_time?: string;
  modified_time?: string;
}

/**
 * 待辦事項
 */
export interface Task {
  guid?: string;
  summary?: string;
  description?: string;
  due?: {
    timestamp?: string;
    is_all_day?: boolean;
  };
  completed_at?: string;
  creator?: {
    id?: string;
    name?: string;
  };
}

/**
 * 任務清單
 */
export interface TaskList {
  guid?: string;
  name?: string;
  creator?: {
    id?: string;
    name?: string;
  };
  members?: Array<{
    id?: string;
    name?: string;
    role?: string;
  }>;
}

/**
 * API 錯誤回應
 */
export interface LarkApiError {
  code: number;
  msg: string;
}
