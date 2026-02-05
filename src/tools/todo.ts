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
  TasklistCreateSchema,
  TasklistListSchema,
  TasklistGetSchema,
  TasklistUpdateSchema,
  TasklistDeleteSchema,
  TasklistAddTaskSchema,
  TasklistRemoveTaskSchema,
  TasklistTasksSchema,
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
      description: `Create a new task/todo.

Args:
  - summary (string): Task summary (required)
  - description (string): Detailed description (optional)
  - due_time (string): Due time in ISO 8601 format (optional)

Returns:
  - Task ID and summary

Example:
  - todo_create summary="Review PR"
  - todo_create summary="Submit report" due_time="2024-12-31T23:59:59+08:00"`,
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
      description: `List tasks/todos.

Args:
  - completed (boolean): List only completed tasks (default: false)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of tasks with id, summary, due_time, is_completed

Example:
  - todo_list
  - todo_list completed=true`,
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
        }>(endpoint, { params: { page_size: limit } });

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
      description: `Search tasks/todos by keyword.

Args:
  - query (string): Search keyword (required)
  - completed (boolean): Search only completed tasks (optional)
  - limit (number): Max results (default: 50)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of matching tasks

Example:
  - todo_search query="meeting"`,
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
        }>(endpoint, { params: { page_size: limit } });

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

  // todo_complete
  server.registerTool(
    "todo_complete",
    {
      title: "Complete Task",
      description: `Mark a task as completed.

Args:
  - task_id (string): Task ID (required)

Returns:
  - Success message

Example:
  - todo_complete task_id=7XXXXXX`,
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
      description: `Update a task's details.

Args:
  - task_id (string): Task ID (required)
  - summary (string): New summary (optional)
  - description (string): New description (optional)
  - due_time (string): New due time in ISO 8601 format (optional)

At least one of summary, description, or due_time must be provided.

Returns:
  - Success message with updated fields

Example:
  - todo_update task_id=7XXXXXX summary="Updated title"`,
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
        const { task_id, summary, description, due_time } = params;

        if (!summary && !description && !due_time) {
          return error("At least one field (summary, description, or due_time) must be provided");
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
        if (due_time) {
          body.due = {
            timestamp: new Date(due_time).getTime().toString(),
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

  // todo_delete
  server.registerTool(
    "todo_delete",
    {
      title: "Delete Task",
      description: `Delete a task.

Args:
  - task_id (string): Task ID (required)

Returns:
  - Success message

Example:
  - todo_delete task_id=7XXXXXX`,
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

  // tasklist_create
  server.registerTool(
    "tasklist_create",
    {
      title: "Create Tasklist",
      description: `Create a new tasklist (container for tasks).

Args:
  - name (string): Tasklist name (required)

Returns:
  - Tasklist ID and name

Example:
  - tasklist_create name="Project Tasks"`,
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
      description: `List all tasklists.

Args:
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of tasklists with id and name

Example:
  - tasklist_list`,
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
      description: `Get details of a specific tasklist.

Args:
  - tasklist_id (string): Tasklist ID (required)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - Tasklist details including id, name, creator, members

Example:
  - tasklist_get tasklist_id=7XXXXXX`,
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
      description: `Update a tasklist's name.

Args:
  - tasklist_id (string): Tasklist ID (required)
  - name (string): New tasklist name (optional)

Returns:
  - Success message with updated tasklist info

Example:
  - tasklist_update tasklist_id=7XXXXXX name="New Name"`,
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
      description: `Delete a tasklist.

Args:
  - tasklist_id (string): Tasklist ID (required)

Returns:
  - Success message

Example:
  - tasklist_delete tasklist_id=7XXXXXX`,
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
      description: `Add an existing task to a tasklist.

Args:
  - tasklist_id (string): Tasklist ID (required)
  - task_id (string): Task ID (required)

Returns:
  - Success message

Example:
  - tasklist_add_task tasklist_id=7XXXXXX task_id=7YYYYYY`,
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
        const { tasklist_id, task_id } = params;

        await larkRequest(`/task/v2/tasks/${task_id}/add_tasklist`, {
          method: "POST",
          body: { tasklist_guid: tasklist_id },
        });

        return success("Task added to tasklist", { tasklist_id, task_id });
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
      description: `Remove a task from a tasklist.

Args:
  - tasklist_id (string): Tasklist ID (required)
  - task_id (string): Task ID (required)

Returns:
  - Success message

Example:
  - tasklist_remove_task tasklist_id=7XXXXXX task_id=7YYYYYY`,
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
      description: `List all tasks in a specific tasklist.

Args:
  - tasklist_id (string): Tasklist ID (required)
  - limit (number): Max results (default: 50)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format

Returns:
  - List of tasks with id, summary, is_completed

Example:
  - tasklist_tasks tasklist_id=7XXXXXX`,
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
          is_completed: !!task.completed_at,
        }));

        return success(`Found ${tasks.length} tasks in tasklist`, tasks, response_format);
      } catch (err) {
        return error("Tasklist tasks failed", err);
      }
    }
  );
}
