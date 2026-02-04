/**
 * 待辦事項相關工具
 * 精簡版 API
 */

import { larkRequest } from "../lark-client.js";
import { success, error, simplifyTodo, simplifyTodoList, type ToolResponse } from "../utils/response.js";

/**
 * 工具定義
 */
export const todoTools = [
  {
    name: "todo_create",
    description: "建立待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "待辦事項摘要（必填）",
        },
        description: {
          type: "string",
          description: "詳細描述（可選）",
        },
        due_time: {
          type: "string",
          description: "截止時間（ISO 8601 格式，例如 2024-12-31T23:59:59+08:00）",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "todo_list",
    description: "列出待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_size: {
          type: "number",
          description: "每頁數量（預設 50，最大 100）",
        },
        page_token: {
          type: "string",
          description: "分頁標記（用於取得下一頁）",
        },
        completed: {
          type: "boolean",
          description: "是否只列出已完成的待辦（預設 false）",
        },
      },
    },
  },
  {
    name: "todo_search",
    description: "搜尋待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "搜尋關鍵字（必填）",
        },
        completed: {
          type: "boolean",
          description: "是否只搜尋已完成的待辦",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "todo_complete",
    description: "完成待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "待辦事項 ID（必填）",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "todo_update",
    description: "更新待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "待辦事項 ID（必填）",
        },
        summary: {
          type: "string",
          description: "新的摘要",
        },
        description: {
          type: "string",
          description: "新的描述",
        },
        due_time: {
          type: "string",
          description: "新的截止時間（ISO 8601 格式）",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "todo_delete",
    description: "刪除待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "待辦事項 ID（必填）",
        },
      },
      required: ["task_id"],
    },
  },
  // ========== 任務清單（容器）工具 ==========
  {
    name: "tasklist_create",
    description: "建立任務清單（容器）",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "清單名稱（必填）",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "tasklist_list",
    description: "列出所有任務清單",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_size: {
          type: "number",
          description: "每頁數量（預設 50）",
        },
      },
    },
  },
  {
    name: "tasklist_get",
    description: "取得任務清單詳情",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasklist_id: {
          type: "string",
          description: "任務清單 ID（必填）",
        },
      },
      required: ["tasklist_id"],
    },
  },
  {
    name: "tasklist_delete",
    description: "刪除任務清單",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasklist_id: {
          type: "string",
          description: "任務清單 ID（必填）",
        },
      },
      required: ["tasklist_id"],
    },
  },
  {
    name: "tasklist_add_task",
    description: "將待辦事項加入任務清單",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasklist_id: {
          type: "string",
          description: "任務清單 ID（必填）",
        },
        task_id: {
          type: "string",
          description: "待辦事項 ID（必填）",
        },
      },
      required: ["tasklist_id", "task_id"],
    },
  },
  {
    name: "tasklist_remove_task",
    description: "從任務清單移除待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasklist_id: {
          type: "string",
          description: "任務清單 ID（必填）",
        },
        task_id: {
          type: "string",
          description: "待辦事項 ID（必填）",
        },
      },
      required: ["tasklist_id", "task_id"],
    },
  },
  {
    name: "tasklist_tasks",
    description: "列出任務清單中的所有待辦事項",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasklist_id: {
          type: "string",
          description: "任務清單 ID（必填）",
        },
      },
      required: ["tasklist_id"],
    },
  },
];

/**
 * 處理待辦事項工具呼叫
 */
export async function handleTodoTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  try {
    switch (name) {
      case "todo_create":
        return await todoCreate(
          args.summary as string,
          args.description as string | undefined,
          args.due_time as string | undefined
        );

      case "todo_list":
        return await todoList(
          args.page_size as number | undefined,
          args.page_token as string | undefined,
          args.completed as boolean | undefined
        );

      case "todo_search":
        return await todoSearch(
          args.query as string,
          args.completed as boolean | undefined
        );

      case "todo_complete":
        return await todoComplete(args.task_id as string);

      case "todo_update":
        return await todoUpdate(
          args.task_id as string,
          args.summary as string | undefined,
          args.description as string | undefined,
          args.due_time as string | undefined
        );

      case "todo_delete":
        return await todoDelete(args.task_id as string);

      // ========== 任務清單工具 ==========
      case "tasklist_create":
        return await tasklistCreate(args.name as string);

      case "tasklist_list":
        return await tasklistList(args.page_size as number | undefined);

      case "tasklist_get":
        return await tasklistGet(args.tasklist_id as string);

      case "tasklist_delete":
        return await tasklistDelete(args.tasklist_id as string);

      case "tasklist_add_task":
        return await tasklistAddTask(
          args.tasklist_id as string,
          args.task_id as string
        );

      case "tasklist_remove_task":
        return await tasklistRemoveTask(
          args.tasklist_id as string,
          args.task_id as string
        );

      case "tasklist_tasks":
        return await tasklistTasks(args.tasklist_id as string);

      default:
        return error(`未知的待辦事項工具: ${name}`);
    }
  } catch (err) {
    return error("待辦事項操作失敗", err);
  }
}

/**
 * 建立待辦事項
 */
async function todoCreate(
  summary: string,
  description?: string,
  dueTime?: string
): Promise<ToolResponse> {
  if (!summary) {
    return error("缺少 summary 參數");
  }

  const body: Record<string, unknown> = { summary };

  if (description) {
    body.description = description;
  }

  if (dueTime) {
    body.due = {
      timestamp: new Date(dueTime).getTime().toString(),
      is_all_day: false,
    };
  }

  const data = await larkRequest<{
    task: {
      guid: string;
      summary: string;
    };
  }>("/task/v2/tasks", {
    method: "POST",
    body,
  });

  return success(`✅ 待辦事項建立成功`, {
    id: data.task.guid,
    summary: data.task.summary,
  });
}

/**
 * 列出待辦事項
 */
async function todoList(
  pageSize = 50,
  pageToken?: string,
  completed?: boolean
): Promise<ToolResponse> {
  const params: Record<string, string | number> = {
    page_size: Math.min(pageSize, 100),
  };

  if (pageToken) {
    params.page_token = pageToken;
  }

  // 使用不同的 API 路徑取得已完成/未完成的待辦
  const endpoint = completed
    ? "/task/v2/tasks?completed_type=completed"
    : "/task/v2/tasks";

  const data = await larkRequest<{
    items?: Array<{
      guid?: string;
      summary?: string;
      description?: string;
      due?: { timestamp?: string; is_all_day?: boolean };
      completed_at?: string;
      creator?: { id?: string; name?: string };
    }>;
    page_token?: string;
    has_more?: boolean;
  }>(endpoint, { params });

  const todos = data.items || [];
  const simplified = simplifyTodoList(todos);

  let message = `📋 共 ${simplified.length} 個待辦事項`;
  if (data.has_more) {
    message += `（還有更多，使用 page_token: "${data.page_token}" 取得下一頁）`;
  }

  return success(message, simplified);
}

/**
 * 搜尋待辦事項
 */
async function todoSearch(
  query: string,
  completed?: boolean
): Promise<ToolResponse> {
  if (!query) {
    return error("缺少 query 參數");
  }

  // Lark Task API 不支援搜尋，所以先取得所有待辦再過濾
  const params: Record<string, string | number> = { page_size: 100 };
  const endpoint = completed
    ? "/task/v2/tasks?completed_type=completed"
    : "/task/v2/tasks";

  const data = await larkRequest<{
    items?: Array<{
      guid?: string;
      summary?: string;
      description?: string;
      due?: { timestamp?: string; is_all_day?: boolean };
      completed_at?: string;
      creator?: { id?: string; name?: string };
    }>;
  }>(endpoint, { params });

  const todos = data.items || [];
  const filtered = todos.filter((todo) =>
    todo.summary?.toLowerCase().includes(query.toLowerCase()) ||
    todo.description?.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    return success(`🔍 搜尋 "${query}" 無結果`);
  }

  const simplified = simplifyTodoList(filtered);
  return success(`🔍 搜尋 "${query}" 找到 ${simplified.length} 個待辦事項`, simplified);
}

/**
 * 完成待辦事項
 * Task v2 沒有獨立的 complete 端點，需要用 PATCH 更新 completed_at 欄位
 */
async function todoComplete(taskId: string): Promise<ToolResponse> {
  if (!taskId) {
    return error("缺少 task_id 參數");
  }

  // 設定 completed_at 為當前時間戳（毫秒轉秒的字串）
  const completedAt = Math.floor(Date.now() / 1000).toString();

  await larkRequest(`/task/v2/tasks/${taskId}`, {
    method: "PATCH",
    body: {
      task: {
        completed_at: completedAt,
      },
      update_fields: ["completed_at"],
    },
  });

  return success(`✅ 待辦事項已完成`, { taskId });
}

/**
 * 更新待辦事項
 */
async function todoUpdate(
  taskId: string,
  summary?: string,
  description?: string,
  dueTime?: string
): Promise<ToolResponse> {
  if (!taskId) {
    return error("缺少 task_id 參數");
  }

  if (!summary && !description && !dueTime) {
    return error("至少需要提供一個要更新的欄位（summary、description 或 due_time）");
  }

  const body: Record<string, unknown> = {};
  const updateFields: string[] = [];

  if (summary) {
    body.summary = summary;
    updateFields.push("summary");
  }

  if (description) {
    body.description = description;
    updateFields.push("description");
  }

  if (dueTime) {
    body.due = {
      timestamp: new Date(dueTime).getTime().toString(),
      is_all_day: false,
    };
    updateFields.push("due");
  }

  await larkRequest(`/task/v2/tasks/${taskId}`, {
    method: "PATCH",
    body: {
      task: body,
      update_fields: updateFields,
    },
  });

  return success(`✅ 待辦事項已更新`, { taskId, updated: updateFields });
}

/**
 * 刪除待辦事項
 */
async function todoDelete(taskId: string): Promise<ToolResponse> {
  if (!taskId) {
    return error("缺少 task_id 參數");
  }

  await larkRequest(`/task/v2/tasks/${taskId}`, {
    method: "DELETE",
  });

  return success(`✅ 待辦事項已刪除`, { taskId });
}

// =============================================================================
// 任務清單（容器）功能
// =============================================================================

/**
 * 建立任務清單
 */
async function tasklistCreate(name: string): Promise<ToolResponse> {
  if (!name) {
    return error("缺少 name 參數");
  }

  const data = await larkRequest<{
    tasklist: {
      guid: string;
      name: string;
    };
  }>("/task/v2/tasklists", {
    method: "POST",
    body: { name },
  });

  return success(`✅ 任務清單建立成功`, {
    id: data.tasklist.guid,
    name: data.tasklist.name,
  });
}

/**
 * 列出所有任務清單
 */
async function tasklistList(pageSize = 50): Promise<ToolResponse> {
  const data = await larkRequest<{
    items?: Array<{
      guid?: string;
      name?: string;
      creator?: { id?: string; name?: string };
      members?: Array<{ id?: string; name?: string; role?: string }>;
    }>;
    page_token?: string;
    has_more?: boolean;
  }>("/task/v2/tasklists", {
    params: { page_size: Math.min(pageSize, 100) },
  });

  const lists = data.items || [];
  const simplified = lists.map((list) => ({
    id: list.guid,
    name: list.name,
  }));

  return success(`📂 共 ${simplified.length} 個任務清單`, simplified);
}

/**
 * 取得任務清單詳情
 */
async function tasklistGet(tasklistId: string): Promise<ToolResponse> {
  if (!tasklistId) {
    return error("缺少 tasklist_id 參數");
  }

  const data = await larkRequest<{
    tasklist: {
      guid?: string;
      name?: string;
      creator?: { id?: string; name?: string };
      members?: Array<{ id?: string; name?: string; role?: string }>;
    };
  }>(`/task/v2/tasklists/${tasklistId}`);

  return success(`📂 任務清單詳情`, {
    id: data.tasklist.guid,
    name: data.tasklist.name,
    creator: data.tasklist.creator?.name,
    members: data.tasklist.members?.map((m) => m.name),
  });
}

/**
 * 刪除任務清單
 */
async function tasklistDelete(tasklistId: string): Promise<ToolResponse> {
  if (!tasklistId) {
    return error("缺少 tasklist_id 參數");
  }

  await larkRequest(`/task/v2/tasklists/${tasklistId}`, {
    method: "DELETE",
  });

  return success(`✅ 任務清單已刪除`, { tasklistId });
}

/**
 * 將待辦事項加入任務清單
 */
async function tasklistAddTask(
  tasklistId: string,
  taskId: string
): Promise<ToolResponse> {
  if (!tasklistId) {
    return error("缺少 tasklist_id 參數");
  }
  if (!taskId) {
    return error("缺少 task_id 參數");
  }

  await larkRequest(`/task/v2/tasks/${taskId}/add_tasklist`, {
    method: "POST",
    body: { tasklist_guid: tasklistId },
  });

  return success(`✅ 待辦事項已加入任務清單`, { tasklistId, taskId });
}

/**
 * 從任務清單移除待辦事項
 */
async function tasklistRemoveTask(
  tasklistId: string,
  taskId: string
): Promise<ToolResponse> {
  if (!tasklistId) {
    return error("缺少 tasklist_id 參數");
  }
  if (!taskId) {
    return error("缺少 task_id 參數");
  }

  await larkRequest(`/task/v2/tasks/${taskId}/remove_tasklist`, {
    method: "POST",
    body: { tasklist_guid: tasklistId },
  });

  return success(`✅ 待辦事項已從任務清單移除`, { tasklistId, taskId });
}

/**
 * 列出任務清單中的所有待辦事項
 */
async function tasklistTasks(tasklistId: string): Promise<ToolResponse> {
  if (!tasklistId) {
    return error("缺少 tasklist_id 參數");
  }

  const data = await larkRequest<{
    items?: Array<{
      guid?: string;
      summary?: string;
      completed_at?: string;
    }>;
  }>(`/task/v2/tasklists/${tasklistId}/tasks`);

  const tasks = data.items || [];
  const simplified = tasks.map((task) => ({
    id: task.guid,
    summary: task.summary,
    completed: !!task.completed_at,
  }));

  return success(`📋 清單中有 ${simplified.length} 個待辦事項`, simplified);
}
