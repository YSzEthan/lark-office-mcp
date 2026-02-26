/**
 * 待辦事項工具
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  TodoCreateSchema,
  TodoListSchema,
  TodoSearchSchema,
  TodoCompleteSchema,
  TodoUpdateSchema,
  TodoDeleteSchema,
  TodoAddMembersSchema,
  TodoRemoveMembersSchema,
  TasklistCreateSchema,
  TasklistListSchema,
  TasklistGetSchema,
  TasklistUpdateSchema,
  TasklistDeleteSchema,
  TasklistAddTaskSchema,
  TasklistRemoveTaskSchema,
  TasklistTasksSchema,
  SubtaskCreateSchema,
  SubtaskListSchema,
  SubtaskUpdateSchema,
  SectionListSchema,
  SectionTasksSchema,
  SectionCreateSchema,
  SectionDeleteSchema,
  TodoCreateOutputSchema,
  TodoListOutputSchema,
  TodoSearchOutputSchema,
  TaskIdOutputSchema,
  TodoUpdateOutputSchema,
  TodoAddMembersOutputSchema,
  TodoRemoveMembersOutputSchema,
  TasklistCreateOutputSchema,
  TasklistListOutputSchema,
  TasklistGetOutputSchema,
  TasklistUpdateOutputSchema,
  TasklistIdOutputSchema,
  TasklistAddTaskOutputSchema,
  TasklistRemoveTaskOutputSchema,
  TasklistTasksOutputSchema,
  SubtaskCreateOutputSchema,
  SubtaskListOutputSchema,
  SubtaskUpdateOutputSchema,
  SectionListOutputSchema,
  SectionTasksOutputSchema,
  SectionCreateOutputSchema,
  SectionDeleteOutputSchema,
} from "../schemas/index.js";
import { larkRequest } from "../services/lark-client.js";
import { success, error, simplifyTodo, simplifyTodoList, paginatedResponse } from "../utils/response.js";

/**
 * 註冊待辦事項工具
 */
export function registerTodoTools(server: McpServer): void {
  // todo_create
  server.registerTool(
    "todo_create",
    {
      title: "Create Task",
      description: `建立待辦事項。

Args:
  - summary (string): 任務摘要（必填）
  - description (string, optional): 詳細描述
  - due_time (string, optional): 截止時間（ISO 8601 格式）
  - response_format (string, optional): 輸出格式

Returns:
  {
    "id": string,      // 任務 ID
    "summary": string  // 任務摘要
  }

Examples:
  - 建立任務: todo_create summary="Review PR"
  - 含截止日: todo_create summary="Submit report" due_time="2024-12-31T23:59:59+08:00"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a subtask (use subtask_create instead)`,
      inputSchema: TodoCreateSchema,
      outputSchema: TodoCreateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { summary, description, due_time, response_format } = params;

        const body: Record<string, unknown> = { summary };
        if (description) body.description = description;
        if (due_time) {
          body.due = {
            timestamp: new Date(due_time).getTime().toString(),
            is_all_day: false,
          };
        }

        const data = await larkRequest<{
          task: { guid: string; summary: string };
        }>("/task/v2/tasks", {
          method: "POST",
          body,
        });

        return success("Task created", {
          id: data.task.guid,
          summary: data.task.summary,
        }, response_format);
      } catch (err) {
        return error("Task creation failed", err);
      }
    }
  );

  // todo_list
  server.registerTool(
    "todo_list",
    {
      title: "List Tasks",
      description: `列出待辦事項。

Args:
  - completed (boolean, optional): 過濾已完成/未完成任務
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,           // 任務 ID
      "summary": string,      // 任務摘要
      "due_time": string,     // 截止時間
      "is_completed": boolean // 是否已完成
    }
  ]

Examples:
  - 列出所有任務: todo_list
  - 只看已完成: todo_list completed=true

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to search by keyword (use todo_search instead)
  - You need tasks in a specific tasklist (use tasklist_tasks instead)`,
      inputSchema: TodoListSchema,
      outputSchema: TodoListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { completed, limit, offset, response_format } = params;

        // 根據官方文件：completed 為 boolean，true=已完成，false=未完成
        // 不傳遞 completed 參數則不過濾
        const reqParams: Record<string, string | number | boolean> = { page_size: limit };
        if (completed !== undefined) {
          reqParams.completed = completed;
        }

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
        }>("/task/v2/tasks", { params: reqParams });

        const todos = data.items || [];
        const simplified = simplifyTodoList(todos);

        return paginatedResponse(simplified, !!data.has_more, offset || 0, `Found ${simplified.length} tasks`, response_format);
      } catch (err) {
        return error("Task list failed", err);
      }
    }
  );

  // todo_search
  server.registerTool(
    "todo_search",
    {
      title: "Search Tasks",
      description: `搜尋待辦事項。在 summary 和 description 中搜尋關鍵字。

Args:
  - query (string): 搜尋關鍵字（必填）
  - completed (boolean, optional): 過濾已完成/未完成任務
  - limit (number, optional): 最大結果數，預設 10
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,           // 任務 ID
      "summary": string,      // 任務摘要
      "due_time": string,     // 截止時間
      "is_completed": boolean // 是否已完成
    }
  ]

Examples:
  - 搜尋任務: todo_search query="meeting"
  - 搜尋未完成: todo_search query="report" completed=false

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need all tasks without filtering (use todo_list instead)`,
      inputSchema: TodoSearchSchema,
      outputSchema: TodoSearchOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { query, completed, limit, offset, response_format } = params;

        // 根據官方文件：completed 為 boolean，true=已完成，false=未完成
        const searchParams: Record<string, string | number | boolean> = { page_size: limit };
        if (completed !== undefined) {
          searchParams.completed = completed;
        }

        const data = await larkRequest<{
          items?: Array<{
            guid?: string;
            summary?: string;
            description?: string;
            due?: { timestamp?: string; is_all_day?: boolean };
            completed_at?: string;
            creator?: { id?: string; name?: string };
          }>;
        }>("/task/v2/tasks", { params: searchParams });

        const todos = data.items || [];
        const filtered = todos.filter((todo) =>
          todo.summary?.toLowerCase().includes(query.toLowerCase()) ||
          todo.description?.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length === 0) {
          return success(`Search "${query}" returned no results`);
        }

        const simplified = simplifyTodoList(filtered);
        return paginatedResponse(simplified, false, offset || 0, `Search "${query}" found ${simplified.length} tasks`, response_format);
      } catch (err) {
        return error("Task search failed", err);
      }
    }
  );

  // task_complete（可處理任務和子任務）
  server.registerTool(
    "task_complete",
    {
      title: "Complete Task",
      description: `將任務或子任務標記為已完成。適用於 todo 和 subtask。

Args:
  - task_id (string): 任務 ID（必填）

Returns:
  {
    "task_id": string  // 已完成的任務 ID
  }

Examples:
  - 完成任務: task_complete task_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to uncomplete a task (use todo_update to clear completed_at)`,
      inputSchema: TodoCompleteSchema,
      outputSchema: TaskIdOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id } = params;
        const completedAt = Math.floor(Date.now() / 1000).toString();

        await larkRequest(`/task/v2/tasks/${task_id}`, {
          method: "PATCH",
          body: {
            task: { completed_at: completedAt },
            update_fields: ["completed_at"],
          },
        });

        return success("Task completed", { task_id });
      } catch (err) {
        return error("Task completion failed", err);
      }
    }
  );

  // todo_update
  server.registerTool(
    "todo_update",
    {
      title: "Update Task",
      description: `更新待辦事項。至少需提供一個更新欄位。

Args:
  - task_id (string): 任務 ID（必填）
  - summary (string, optional): 新摘要
  - description (string, optional): 新描述
  - start_time (string, optional): 開始時間（ISO 8601）
  - due_time (string, optional): 截止時間（ISO 8601）

Returns:
  {
    "task_id": string,          // 任務 ID
    "updated_fields": string[]  // 已更新的欄位
  }

Examples:
  - 更新摘要: todo_update task_id=7XXXXXX summary="Updated"
  - 更新截止日: todo_update task_id=7XXXXXX due_time="2024-12-31T23:59:59+08:00"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to complete a task (use task_complete instead)
  - You need to add/remove members (use todo_add_members/todo_remove_members)`,
      inputSchema: TodoUpdateSchema,
      outputSchema: TodoUpdateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id, summary, description, start_time, due_time } = params;

        if (!summary && !description && !start_time && !due_time) {
          return error("At least one field (summary, description, start_time, or due_time) must be provided");
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
        if (start_time) {
          body.start = {
            timestamp: Math.floor(new Date(start_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
          updateFields.push("start");
        }
        if (due_time) {
          body.due = {
            timestamp: Math.floor(new Date(due_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
          updateFields.push("due");
        }

        await larkRequest(`/task/v2/tasks/${task_id}`, {
          method: "PATCH",
          body: {
            task: body,
            update_fields: updateFields,
          },
        });

        return success("Task updated", { task_id, updated_fields: updateFields });
      } catch (err) {
        return error("Task update failed", err);
      }
    }
  );

  // task_delete（可處理任務和子任務）
  server.registerTool(
    "task_delete",
    {
      title: "Delete Task",
      description: `刪除任務或子任務。此操作不可逆。適用於 todo 和 subtask。

Args:
  - task_id (string): 任務 ID（必填）

Returns:
  {
    "task_id": string  // 已刪除的任務 ID
  }

Examples:
  - 刪除任務: task_delete task_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You only need to complete the task (use task_complete instead)`,
      inputSchema: TodoDeleteSchema,
      outputSchema: TaskIdOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id } = params;

        await larkRequest(`/task/v2/tasks/${task_id}`, {
          method: "DELETE",
        });

        return success("Task deleted", { task_id });
      } catch (err) {
        return error("Task deletion failed", err);
      }
    }
  );

  // todo_add_members
  server.registerTool(
    "todo_add_members",
    {
      title: "Add Task Members",
      description: `新增任務負責人。

Args:
  - task_id (string): 任務 ID（必填）
  - members (string[]): 用戶 ID 陣列（open_id 或 user_id）（必填）

Returns:
  {
    "task_id": string,   // 任務 ID
    "added": string[]    // 已新增的成員 ID
  }

Examples:
  - 新增負責人: todo_add_members task_id=7XXXXXX members=["ou_xxxxx"]

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to replace all members (remove first, then add)`,
      inputSchema: TodoAddMembersSchema,
      outputSchema: TodoAddMembersOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id, members } = params;

        await larkRequest(`/task/v2/tasks/${task_id}/add_members`, {
          method: "POST",
          body: {
            members: members.map((id) => ({ id, role: "assignee" })),
          },
          params: { user_id_type: "open_id" },
        });

        return success("Members added", { task_id, added: members });
      } catch (err) {
        return error("Add members failed", err);
      }
    }
  );

  // todo_remove_members
  server.registerTool(
    "todo_remove_members",
    {
      title: "Remove Task Members",
      description: `移除任務負責人。

Args:
  - task_id (string): 任務 ID（必填）
  - members (string[]): 用戶 ID 陣列（open_id 或 user_id）（必填）

Returns:
  {
    "task_id": string,    // 任務 ID
    "removed": string[]   // 已移除的成員 ID
  }

Examples:
  - 移除負責人: todo_remove_members task_id=7XXXXXX members=["ou_xxxxx"]

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to replace all members (remove first, then add)`,
      inputSchema: TodoRemoveMembersSchema,
      outputSchema: TodoRemoveMembersOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id, members } = params;

        await larkRequest(`/task/v2/tasks/${task_id}/remove_members`, {
          method: "POST",
          body: {
            members: members.map((id) => ({ id, role: "assignee" })),
          },
          params: { user_id_type: "open_id" },
        });

        return success("Members removed", { task_id, removed: members });
      } catch (err) {
        return error("Remove members failed", err);
      }
    }
  );

  // tasklist_create
  server.registerTool(
    "tasklist_create",
    {
      title: "Create Tasklist",
      description: `建立任務清單（任務容器）。

Args:
  - name (string): 清單名稱（必填）
  - response_format (string, optional): 輸出格式

Returns:
  {
    "id": string,    // 清單 ID
    "name": string   // 清單名稱
  }

Examples:
  - 建立清單: tasklist_create name="Project Tasks"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a task (use todo_create instead)`,
      inputSchema: TasklistCreateSchema,
      outputSchema: TasklistCreateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { name, response_format } = params;

        const data = await larkRequest<{
          tasklist: { guid: string; name: string };
        }>("/task/v2/tasklists", {
          method: "POST",
          body: { name },
        });

        return success("Tasklist created", {
          id: data.tasklist.guid,
          name: data.tasklist.name,
        }, response_format);
      } catch (err) {
        return error("Tasklist creation failed", err);
      }
    }
  );

  // tasklist_list
  server.registerTool(
    "tasklist_list",
    {
      title: "List Tasklists",
      description: `列出所有任務清單。

Args:
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,    // 清單 ID
      "name": string   // 清單名稱
    }
  ]

Examples:
  - 列出清單: tasklist_list

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need tasks within a tasklist (use tasklist_tasks instead)`,
      inputSchema: TasklistListSchema,
      outputSchema: TasklistListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { limit, offset, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{ guid?: string; name?: string }>;
          has_more?: boolean;
        }>("/task/v2/tasklists", {
          params: { page_size: limit },
        });

        const lists = (data.items || []).map((list) => ({
          id: list.guid,
          name: list.name,
        }));

        return paginatedResponse(lists, !!data.has_more, offset || 0, `Found ${lists.length} tasklists`, response_format);
      } catch (err) {
        return error("Tasklist list failed", err);
      }
    }
  );

  // tasklist_get
  server.registerTool(
    "tasklist_get",
    {
      title: "Get Tasklist Details",
      description: `取得任務清單詳情。

Args:
  - tasklist_id (string): 清單 ID（必填）
  - response_format (string, optional): 輸出格式

Returns:
  {
    "id": string,        // 清單 ID
    "name": string,      // 清單名稱
    "creator": string,   // 建立者名稱
    "members": string[]  // 成員名稱列表
  }

Examples:
  - 取得詳情: tasklist_get tasklist_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to list all tasklists (use tasklist_list instead)`,
      inputSchema: TasklistGetSchema,
      outputSchema: TasklistGetOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, response_format } = params;

        const data = await larkRequest<{
          tasklist: {
            guid?: string;
            name?: string;
            creator?: { id?: string; name?: string };
            members?: Array<{ id?: string; name?: string; role?: string }>;
          };
        }>(`/task/v2/tasklists/${tasklist_id}`);

        return success("Tasklist details", {
          id: data.tasklist.guid,
          name: data.tasklist.name,
          creator: data.tasklist.creator?.name,
          members: data.tasklist.members?.map((m) => m.name),
        }, response_format);
      } catch (err) {
        return error("Tasklist get failed", err);
      }
    }
  );

  // tasklist_update
  server.registerTool(
    "tasklist_update",
    {
      title: "Update Tasklist",
      description: `更新任務清單名稱。

Args:
  - tasklist_id (string): 清單 ID（必填）
  - name (string, optional): 新名稱

Returns:
  {
    "id": string,    // 清單 ID
    "name": string   // 更新後的名稱
  }

Examples:
  - 更新名稱: tasklist_update tasklist_id=7XXXXXX name="New Name"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to add/remove tasks (use tasklist_add_task/tasklist_remove_task)`,
      inputSchema: TasklistUpdateSchema,
      outputSchema: TasklistUpdateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, name } = params;

        if (!name) {
          return error("Name is required for update");
        }

        const data = await larkRequest<{
          tasklist: { guid: string; name: string };
        }>(`/task/v2/tasklists/${tasklist_id}`, {
          method: "PATCH",
          body: {
            tasklist: { name },
            update_fields: ["name"],
          },
        });

        return success("Tasklist updated", {
          id: data.tasklist.guid,
          name: data.tasklist.name,
        });
      } catch (err) {
        return error("Tasklist update failed", err);
      }
    }
  );

  // tasklist_delete
  server.registerTool(
    "tasklist_delete",
    {
      title: "Delete Tasklist",
      description: `刪除任務清單。此操作不可逆。

Args:
  - tasklist_id (string): 清單 ID（必填）

Returns:
  {
    "tasklist_id": string  // 已刪除的清單 ID
  }

Examples:
  - 刪除清單: tasklist_delete tasklist_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You only need to remove tasks from it (use tasklist_remove_task instead)`,
      inputSchema: TasklistDeleteSchema,
      outputSchema: TasklistIdOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id } = params;

        await larkRequest(`/task/v2/tasklists/${tasklist_id}`, {
          method: "DELETE",
        });

        return success("Tasklist deleted", { tasklist_id });
      } catch (err) {
        return error("Tasklist deletion failed", err);
      }
    }
  );

  // tasklist_add_task
  server.registerTool(
    "tasklist_add_task",
    {
      title: "Add Task to Tasklist",
      description: `將任務加入任務清單。

Args:
  - tasklist_id (string): 清單 ID（必填）
  - task_id (string): 任務 ID（必填）
  - section_guid (string, optional): 分組 GUID

Returns:
  {
    "tasklist_id": string,   // 清單 ID
    "task_id": string,       // 任務 ID
    "section_guid": string   // 分組 GUID
  }

Examples:
  - 加入清單: tasklist_add_task tasklist_id=7XXXXXX task_id=7YYYYYY
  - 加入分組: tasklist_add_task tasklist_id=7XXXXXX task_id=7YYYYYY section_guid=zzz

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a new task (use todo_create first, then add)`,
      inputSchema: TasklistAddTaskSchema,
      outputSchema: TasklistAddTaskOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, task_id, section_guid } = params;

        const body: Record<string, unknown> = { tasklist_guid: tasklist_id };
        if (section_guid) {
          body.section_guid = section_guid;
        }

        await larkRequest(`/task/v2/tasks/${task_id}/add_tasklist`, {
          method: "POST",
          body,
        });

        return success("Task added to tasklist", { tasklist_id, task_id, section_guid });
      } catch (err) {
        return error("Add task to tasklist failed", err);
      }
    }
  );

  // tasklist_remove_task
  server.registerTool(
    "tasklist_remove_task",
    {
      title: "Remove Task from Tasklist",
      description: `從任務清單移除任務。

Args:
  - tasklist_id (string): 清單 ID（必填）
  - task_id (string): 任務 ID（必填）

Returns:
  {
    "tasklist_id": string,  // 清單 ID
    "task_id": string       // 已移除的任務 ID
  }

Examples:
  - 移除任務: tasklist_remove_task tasklist_id=7XXXXXX task_id=7YYYYYY

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to delete the task entirely (use task_delete instead)`,
      inputSchema: TasklistRemoveTaskSchema,
      outputSchema: TasklistRemoveTaskOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, task_id } = params;

        await larkRequest(`/task/v2/tasks/${task_id}/remove_tasklist`, {
          method: "POST",
          body: { tasklist_guid: tasklist_id },
        });

        return success("Task removed from tasklist", { tasklist_id, task_id });
      } catch (err) {
        return error("Remove task from tasklist failed", err);
      }
    }
  );

  // tasklist_tasks
  server.registerTool(
    "tasklist_tasks",
    {
      title: "List Tasks in Tasklist",
      description: `列出任務清單中的任務。

Args:
  - tasklist_id (string): 清單 ID（必填）
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,            // 任務 ID
      "summary": string,       // 任務摘要
      "is_completed": boolean, // 是否已完成
      "start_time": string,    // 開始時間（ISO 8601）
      "due_time": string,      // 截止時間（ISO 8601）
      "completed_at": string   // 完成時間（ISO 8601）
    }
  ]

Examples:
  - 列出任務: tasklist_tasks tasklist_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need all your tasks (use todo_list instead)
  - You need to search tasks (use todo_search instead)`,
      inputSchema: TasklistTasksSchema,
      outputSchema: TasklistTasksOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, limit, offset, response_format } = params;

        // 先取得任務 ID 列表
        const listData = await larkRequest<{
          items?: Array<{ guid?: string }>;
        }>(`/task/v2/tasklists/${tasklist_id}/tasks`, {
          params: { page_size: limit },
        });

        const taskIds = (listData.items || []).map((t) => t.guid).filter(Boolean) as string[];

        if (taskIds.length === 0) {
          return success("No tasks in tasklist", []);
        }

        // 取得每個任務的詳細資訊
        const tasks = await Promise.all(
          taskIds.map(async (taskId) => {
            try {
              const taskData = await larkRequest<{
                task?: {
                  guid?: string;
                  summary?: string;
                  start?: { timestamp?: string };
                  due?: { timestamp?: string };
                  completed_at?: string;
                };
              }>(`/task/v2/tasks/${taskId}`);

              const task = taskData.task;
              return {
                id: task?.guid,
                summary: task?.summary,
                is_completed: !!task?.completed_at && task?.completed_at !== "0",
                start_time: task?.start?.timestamp
                  ? new Date(parseInt(task.start.timestamp) * 1000).toISOString()
                  : null,
                due_time: task?.due?.timestamp
                  ? new Date(parseInt(task.due.timestamp) * 1000).toISOString()
                  : null,
                completed_at: task?.completed_at && task?.completed_at !== "0"
                  ? new Date(parseInt(task.completed_at) * 1000).toISOString()
                  : null,
              };
            } catch {
              return { id: taskId, summary: "(failed to fetch)", is_completed: false };
            }
          })
        );

        return paginatedResponse(tasks, false, offset || 0, `Found ${tasks.length} tasks in tasklist`, response_format);
      } catch (err) {
        return error("Tasklist tasks failed", err);
      }
    }
  );

  // subtask_create
  server.registerTool(
    "subtask_create",
    {
      title: "Create Subtask",
      description: `建立子任務。

Args:
  - parent_task_id (string): 父任務 ID（必填）
  - summary (string): 子任務摘要（必填）
  - members (string[], optional): 負責人 ID 陣列（open_id 或 user_id）
  - start_time (string, optional): 開始時間（ISO 8601）
  - due_time (string, optional): 截止時間（ISO 8601）
  - response_format (string, optional): 輸出格式

Returns:
  {
    "id": string,           // 子任務 ID
    "summary": string,      // 子任務摘要
    "parent_task_id": string,  // 父任務 ID
    "members": string[],    // 負責人列表
    "start_time": string,   // 開始時間
    "due_time": string      // 截止時間
  }

Examples:
  - 建立子任務: subtask_create parent_task_id=7XXXXXX summary="完成報告"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a top-level task (use todo_create instead)`,
      inputSchema: SubtaskCreateSchema,
      outputSchema: SubtaskCreateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { parent_task_id, summary, members, start_time, due_time, response_format } = params;

        const body: Record<string, unknown> = { summary };

        // 負責人
        if (members && members.length > 0) {
          body.members = members.map((id) => ({ id, type: "user" }));
        }

        // 開始時間
        if (start_time) {
          body.start = {
            timestamp: Math.floor(new Date(start_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
        }

        // 截止時間
        if (due_time) {
          body.due = {
            timestamp: Math.floor(new Date(due_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
        }

        const data = await larkRequest<{
          subtask: {
            guid: string;
            summary: string;
            members?: Array<{ id?: string; name?: string }>;
            start?: { timestamp?: string };
            due?: { timestamp?: string };
          };
        }>(`/task/v2/tasks/${parent_task_id}/subtasks`, {
          method: "POST",
          body,
        });

        const result: Record<string, unknown> = {
          id: data.subtask.guid,
          summary: data.subtask.summary,
          parent_task_id,
        };

        if (data.subtask.members?.length) {
          result.members = data.subtask.members.map((m) => m.name || m.id);
        }
        if (data.subtask.start?.timestamp) {
          result.start_time = new Date(parseInt(data.subtask.start.timestamp) * 1000).toISOString();
        }
        if (data.subtask.due?.timestamp) {
          result.due_time = new Date(parseInt(data.subtask.due.timestamp) * 1000).toISOString();
        }

        return success("子任務已建立", result, response_format);
      } catch (err) {
        return error("建立子任務失敗", err);
      }
    }
  );

  // subtask_list
  server.registerTool(
    "subtask_list",
    {
      title: "List Subtasks",
      description: `列出父任務的子任務。

Args:
  - parent_task_id (string): 父任務 ID（必填）
  - limit (number, optional): 最大結果數，預設 20
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,           // 子任務 ID
      "summary": string,      // 子任務摘要
      "members": string[],    // 負責人列表
      "start_time": string,   // 開始時間
      "due_time": string,     // 截止時間
      "is_completed": boolean // 是否已完成
    }
  ]

Examples:
  - 列出子任務: subtask_list parent_task_id=7XXXXXX

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need all tasks (use todo_list instead)`,
      inputSchema: SubtaskListSchema,
      outputSchema: SubtaskListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { parent_task_id, limit, offset, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{
            guid?: string;
            summary?: string;
            members?: Array<{ id?: string; name?: string }>;
            start?: { timestamp?: string };
            due?: { timestamp?: string };
            completed_at?: string;
          }>;
          page_token?: string;
          has_more?: boolean;
        }>(`/task/v2/tasks/${parent_task_id}/subtasks`, {
          params: { page_size: limit },
        });

        const subtasks = (data.items || []).map((subtask) => {
          const item: Record<string, unknown> = {
            id: subtask.guid,
            summary: subtask.summary,
            is_completed: !!subtask.completed_at && subtask.completed_at !== "0",
          };

          if (subtask.members?.length) {
            item.members = subtask.members.map((m) => m.name || m.id);
          }
          if (subtask.start?.timestamp) {
            item.start_time = new Date(parseInt(subtask.start.timestamp) * 1000).toISOString();
          }
          if (subtask.due?.timestamp) {
            item.due_time = new Date(parseInt(subtask.due.timestamp) * 1000).toISOString();
          }

          return item;
        });

        return paginatedResponse(subtasks, !!data.has_more, offset || 0, `Found ${subtasks.length} subtasks`, response_format);
      } catch (err) {
        return error("列出子任務失敗", err);
      }
    }
  );

  // subtask_update
  server.registerTool(
    "subtask_update",
    {
      title: "Update Subtask",
      description: `更新子任務。至少需提供一個更新欄位。

Args:
  - task_id (string): 子任務 ID（必填）
  - summary (string, optional): 新摘要
  - members (string[], optional): 新負責人 ID 陣列
  - start_time (string, optional): 新開始時間（ISO 8601）
  - due_time (string, optional): 新截止時間（ISO 8601）

Returns:
  {
    "task_id": string,          // 子任務 ID
    "updated_fields": string[]  // 已更新的欄位
  }

Examples:
  - 更新摘要: subtask_update task_id=7XXXXXX summary="Updated"

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to complete the subtask (use task_complete instead)`,
      inputSchema: SubtaskUpdateSchema,
      outputSchema: SubtaskUpdateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { task_id, summary, members, start_time, due_time } = params;

        if (!summary && !members && !start_time && !due_time) {
          return error("至少需要提供一個更新欄位（summary、members、start_time 或 due_time）");
        }

        const taskBody: Record<string, unknown> = {};
        const updateFields: string[] = [];

        if (summary) {
          taskBody.summary = summary;
          updateFields.push("summary");
        }

        if (members) {
          taskBody.members = members.map((id) => ({ id, type: "user" }));
          updateFields.push("members");
        }

        if (start_time) {
          taskBody.start = {
            timestamp: Math.floor(new Date(start_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
          updateFields.push("start");
        }

        if (due_time) {
          taskBody.due = {
            timestamp: Math.floor(new Date(due_time).getTime() / 1000).toString(),
            is_all_day: false,
          };
          updateFields.push("due");
        }

        await larkRequest(`/task/v2/tasks/${task_id}`, {
          method: "PATCH",
          body: {
            task: taskBody,
            update_fields: updateFields,
          },
        });

        return success("子任務已更新", { task_id, updated_fields: updateFields });
      } catch (err) {
        return error("更新子任務失敗", err);
      }
    }
  );

  // section_list
  server.registerTool(
    "section_list",
    {
      title: "List Sections",
      description: `列出所有任務分組（Section）。

Args:
  - resource_type (string, optional): 資源類型 "my_tasks" 或 "tasklist"，預設 "my_tasks"
  - resource_id (string, optional): 清單 GUID（resource_type 為 "tasklist" 時必填）
  - limit (number, optional): 最大結果數，預設 50
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "guid": string,  // 分組 GUID
      "name": string   // 分組名稱
    }
  ]

Examples:
  - 列出我的分組: section_list
  - 列出清單分組: section_list resource_type="tasklist" resource_id=xxx

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need tasks within a section (use section_tasks instead)`,
      inputSchema: SectionListSchema,
      outputSchema: SectionListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { resource_type, resource_id, limit, response_format } = params;

        const reqParams: Record<string, string | number | boolean> = {
          page_size: limit,
          resource_type: resource_type || "my_tasks",
        };

        // tasklist 類型需要提供 resource_id
        if (resource_type === "tasklist" && resource_id) {
          reqParams.resource_id = resource_id;
        }

        const data = await larkRequest<{
          items?: Array<{ guid?: string; name?: string }>;
          page_token?: string;
          has_more?: boolean;
        }>("/task/v2/sections", {
          params: reqParams,
        });

        const sections = (data.items || []).map((section) => ({
          guid: section.guid,
          name: section.name,
        }));

        return paginatedResponse(sections, !!data.has_more, 0, `Found ${sections.length} sections`, response_format);
      } catch (err) {
        return error("Section list failed", err);
      }
    }
  );

  // section_tasks
  server.registerTool(
    "section_tasks",
    {
      title: "List Section Tasks",
      description: `列出分組中的任務。支援過濾完成狀態。

Args:
  - section_guid (string): 分組 GUID（必填）
  - completed (boolean, optional): 過濾已完成/未完成
  - limit (number, optional): 最大結果數，預設 50
  - response_format (string, optional): 輸出格式

Returns:
  [
    {
      "id": string,           // 任務 ID
      "summary": string,      // 任務摘要
      "is_completed": boolean,// 是否已完成
      "due_time": string      // 截止時間
    }
  ]

Examples:
  - 列出分組任務: section_tasks section_guid=xxx
  - 只看未完成: section_tasks section_guid=xxx completed=false

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need all tasks (use todo_list instead)
  - You need tasks in a tasklist (use tasklist_tasks instead)`,
      inputSchema: SectionTasksSchema,
      outputSchema: SectionTasksOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { section_guid, completed, limit, response_format } = params;

        const reqParams: Record<string, string | number | boolean> = { page_size: limit };
        if (completed !== undefined) {
          reqParams.completed = completed;
        }

        const data = await larkRequest<{
          items?: Array<{
            guid?: string;
            summary?: string;
            completed_at?: string;
            due?: { timestamp?: string };
          }>;
          page_token?: string;
          has_more?: boolean;
        }>(`/task/v2/sections/${section_guid}/tasks`, {
          params: reqParams,
        });

        const tasks = (data.items || []).map((task) => {
          // completed_at === "0" 代表未完成，有實際時間戳才是已完成
          const isCompleted = !!task.completed_at && task.completed_at !== "0";
          const item: Record<string, unknown> = {
            id: task.guid,
            summary: task.summary,
            is_completed: isCompleted,
          };

          if (task.due?.timestamp) {
            item.due_time = new Date(parseInt(task.due.timestamp) * 1000).toISOString();
          }

          return item;
        });

        return paginatedResponse(tasks, !!data.has_more, 0, `Found ${tasks.length} tasks in section`, response_format);
      } catch (err) {
        return error("Section tasks failed", err);
      }
    }
  );

  // section_create
  server.registerTool(
    "section_create",
    {
      title: "Create Section",
      description: `在 Tasklist 或「我負責的」中建立分組。

Args:
  - name (string): 分組名稱（必填）
  - resource_type (string): 資源類型 "my_tasks" 或 "tasklist"（必填）
  - resource_id (string, optional): 清單 GUID（resource_type 為 "tasklist" 時必填）
  - response_format (string, optional): 輸出格式

Returns:
  {
    "guid": string,  // 分組 GUID
    "name": string   // 分組名稱
  }

Examples:
  - 在我的任務建立: section_create name="Bug" resource_type="my_tasks"
  - 在清單建立: section_create name="Bug" resource_type="tasklist" resource_id=xxx

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You need to create a tasklist (use tasklist_create instead)`,
      inputSchema: SectionCreateSchema,
      outputSchema: SectionCreateOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { name, resource_type, resource_id, response_format } = params;

        const body: Record<string, unknown> = {
          name,
          resource_type,
        };

        if (resource_type === "tasklist" && resource_id) {
          body.resource_id = resource_id;
        }

        const data = await larkRequest<{
          section: { guid: string; name: string };
        }>("/task/v2/sections", {
          method: "POST",
          body,
        });

        return success("Section created", {
          guid: data.section.guid,
          name: data.section.name,
        }, response_format);
      } catch (err) {
        return error("Section creation failed", err);
      }
    }
  );

  // section_delete
  server.registerTool(
    "section_delete",
    {
      title: "Delete Section",
      description: `刪除分組。此操作不可逆。

Args:
  - section_guid (string): 分組 GUID（必填）

Returns:
  {
    "section_guid": string  // 已刪除的分組 GUID
  }

Examples:
  - 刪除分組: section_delete section_guid=xxx

Permissions:
  - task:task

Error handling:
  - 99991663/99991664: Token invalid → use lark_auth_url to re-authorize
  - 99991668: Permission denied → check App scope settings
  - 99991400: Rate limited → wait and retry (auto-retry enabled)

Don't use when:
  - You only need to move tasks out (remove them from section first)`,
      inputSchema: SectionDeleteSchema,
      outputSchema: SectionDeleteOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { section_guid } = params;

        await larkRequest(`/task/v2/sections/${section_guid}`, {
          method: "DELETE",
        });

        return success("Section deleted", { section_guid });
      } catch (err) {
        return error("Section deletion failed", err);
      }
    }
  );

}
