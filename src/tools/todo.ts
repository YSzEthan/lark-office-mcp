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
} from "../schemas/index.js";
import { larkRequest } from "../services/lark-client.js";
import { success, error, simplifyTodo, simplifyTodoList } from "../utils/response.js";

/**
 * 註冊待辦事項工具
 */
export function registerTodoTools(server: McpServer): void {
  // todo_create
  server.registerTool(
    "todo_create",
    {
      title: "Create Task",
      description: `建立待辦事項。回傳 id、summary。

Example: todo_create summary="Review PR"`,
      inputSchema: TodoCreateSchema,
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
      description: `列出待辦事項。回傳 id、summary、due_time、is_completed。

Example: todo_list completed=true`,
      inputSchema: TodoListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { completed, limit, response_format } = params;

        // 根據官方文件：completed 為 boolean，true=已完成，false=未完成
        // 不傳遞 completed 參數則不過濾
        const reqParams: Record<string, unknown> = { page_size: limit };
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

        let message = `Found ${simplified.length} tasks`;
        if (data.has_more) {
          message += " (more available)";
        }

        return success(message, simplified, response_format);
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
      description: `搜尋待辦事項。回傳符合關鍵字的任務清單。

Example: todo_search query="meeting"`,
      inputSchema: TodoSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { query, completed, limit, response_format } = params;

        // 根據官方文件：completed 為 boolean，true=已完成，false=未完成
        const searchParams: Record<string, unknown> = { page_size: limit };
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
        return success(`Search "${query}" found ${simplified.length} tasks`, simplified, response_format);
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

Example: task_complete task_id=7XXXXXX`,
      inputSchema: TodoCompleteSchema,
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

Example: todo_update task_id=7XXXXXX summary="Updated"`,
      inputSchema: TodoUpdateSchema,
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
      description: `刪除任務或子任務。適用於 todo 和 subtask。

Example: task_delete task_id=7XXXXXX`,
      inputSchema: TodoDeleteSchema,
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

Example: todo_add_members task_id=7XXXXXX members=["ou_xxxxx"]`,
      inputSchema: TodoAddMembersSchema,
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

Example: todo_remove_members task_id=7XXXXXX members=["ou_xxxxx"]`,
      inputSchema: TodoRemoveMembersSchema,
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
      description: `建立任務清單（任務容器）。回傳 id、name。

Example: tasklist_create name="Project Tasks"`,
      inputSchema: TasklistCreateSchema,
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
      description: `列出所有任務清單。回傳 id、name。

Example: tasklist_list`,
      inputSchema: TasklistListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { limit, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{ guid?: string; name?: string }>;
        }>("/task/v2/tasklists", {
          params: { page_size: limit },
        });

        const lists = (data.items || []).map((list) => ({
          id: list.guid,
          name: list.name,
        }));

        return success(`Found ${lists.length} tasklists`, lists, response_format);
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
      description: `取得任務清單詳情。回傳 id、name、creator、members。

Example: tasklist_get tasklist_id=7XXXXXX`,
      inputSchema: TasklistGetSchema,
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
      description: `更新任務清單名稱。回傳 id、name。

Example: tasklist_update tasklist_id=7XXXXXX name="New Name"`,
      inputSchema: TasklistUpdateSchema,
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
      description: `刪除任務清單。

Example: tasklist_delete tasklist_id=7XXXXXX`,
      inputSchema: TasklistDeleteSchema,
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

Example: tasklist_add_task tasklist_id=7XXXXXX task_id=7YYYYYY section_guid=zzz`,
      inputSchema: TasklistAddTaskSchema,
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

Example: tasklist_remove_task tasklist_id=7XXXXXX task_id=7YYYYYY`,
      inputSchema: TasklistRemoveTaskSchema,
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
      description: `列出任務清單中的任務。回傳 id、summary、is_completed。

Example: tasklist_tasks tasklist_id=7XXXXXX`,
      inputSchema: TasklistTasksSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { tasklist_id, limit, response_format } = params;

        const data = await larkRequest<{
          items?: Array<{
            guid?: string;
            summary?: string;
            completed_at?: string;
          }>;
        }>(`/task/v2/tasklists/${tasklist_id}/tasks`, {
          params: { page_size: limit },
        });

        const tasks = (data.items || []).map((task) => ({
          id: task.guid,
          summary: task.summary,
          is_completed: !!task.completed_at && task.completed_at !== "0",
        }));

        return success(`Found ${tasks.length} tasks in tasklist`, tasks, response_format);
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
      description: `建立子任務。回傳 id、summary、members、時間。

Example: subtask_create parent_task_id=7XXXXXX summary="完成報告"`,
      inputSchema: SubtaskCreateSchema,
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
      description: `列出父任務的子任務。回傳 id、summary、members、時間、is_completed。

Example: subtask_list parent_task_id=7XXXXXX`,
      inputSchema: SubtaskListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { parent_task_id, limit, response_format } = params;

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

        let message = `找到 ${subtasks.length} 個子任務`;
        if (data.has_more) {
          message += "（還有更多）";
        }

        return success(message, subtasks, response_format);
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

Example: subtask_update task_id=7XXXXXX summary="Updated"`,
      inputSchema: SubtaskUpdateSchema,
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
      description: `列出所有任務分組（Section）。回傳 guid、name。

Example: section_list`,
      inputSchema: SectionListSchema,
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

        const reqParams: Record<string, unknown> = {
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

        let message = `Found ${sections.length} sections`;
        if (data.has_more) {
          message += " (more available)";
        }

        return success(message, sections, response_format);
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
      description: `列出分組中的任務。支援過濾未完成任務。

Example: section_tasks section_guid=xxx completed=false`,
      inputSchema: SectionTasksSchema,
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

        const reqParams: Record<string, unknown> = { page_size: limit };
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

        let message = `Found ${tasks.length} tasks in section`;
        if (data.has_more) {
          message += " (more available)";
        }

        return success(message, tasks, response_format);
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
      description: `在 Tasklist 或「我負責的」中建立分組。回傳 guid、name。

Example: section_create name="Bug" resource_type="tasklist" resource_id=xxx`,
      inputSchema: SectionCreateSchema,
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
      description: `刪除分組。

Example: section_delete section_guid=xxx`,
      inputSchema: SectionDeleteSchema,
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
