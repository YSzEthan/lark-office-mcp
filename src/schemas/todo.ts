/**
 * 待辦事項工具 Zod Schema 定義
 */

import { z } from "zod";
import { ListPaginationSchema, SearchPaginationSchema, ResponseFormatSchema } from "./common.js";

/**
 * Task ID 參數
 */
export const TaskIdSchema = z.object({
  task_id: z
    .string()
    .min(1)
    .describe("Task ID (required)"),
});

/**
 * Tasklist ID 參數
 */
export const TasklistIdSchema = z.object({
  tasklist_id: z
    .string()
    .min(1)
    .describe("Tasklist ID (required)"),
});

/**
 * 建立待辦事項
 */
export const TodoCreateSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(500)
    .describe("Task summary (required)"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("Detailed description (optional)"),
  due_time: z
    .string()
    .optional()
    .describe("Due time in ISO 8601 format (e.g., 2024-12-31T23:59:59+08:00)"),
}).merge(ResponseFormatSchema);

/**
 * 列出待辦事項
 */
export const TodoListSchema = z.object({
  completed: z
    .boolean()
    .default(false)
    .describe("List only completed tasks (default: false)"),
}).merge(ListPaginationSchema).merge(ResponseFormatSchema);

/**
 * 搜尋待辦事項
 */
export const TodoSearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search keyword (required)"),
  completed: z
    .boolean()
    .optional()
    .describe("Search only completed tasks"),
}).merge(SearchPaginationSchema).merge(ResponseFormatSchema);

/**
 * 完成待辦事項
 */
export const TodoCompleteSchema = TaskIdSchema;

/**
 * 更新待辦事項
 */
export const TodoUpdateSchema = TaskIdSchema.extend({
  summary: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe("New summary"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("New description"),
  due_time: z
    .string()
    .optional()
    .describe("New due time (ISO 8601 format)"),
});

/**
 * 刪除待辦事項
 */
export const TodoDeleteSchema = TaskIdSchema;

/**
 * 建立任務清單
 */
export const TasklistCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe("Tasklist name (required)"),
}).merge(ResponseFormatSchema);

/**
 * 列出任務清單
 */
export const TasklistListSchema = ListPaginationSchema.merge(ResponseFormatSchema);

/**
 * 取得任務清單詳情
 */
export const TasklistGetSchema = TasklistIdSchema.merge(ResponseFormatSchema);

/**
 * 更新任務清單
 */
export const TasklistUpdateSchema = TasklistIdSchema.extend({
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("New tasklist name"),
});

/**
 * 刪除任務清單
 */
export const TasklistDeleteSchema = TasklistIdSchema;

/**
 * 將待辦加入任務清單
 */
export const TasklistAddTaskSchema = TasklistIdSchema.merge(TaskIdSchema);

/**
 * 從任務清單移除待辦
 */
export const TasklistRemoveTaskSchema = TasklistIdSchema.merge(TaskIdSchema);

/**
 * 列出任務清單中的待辦
 */
export const TasklistTasksSchema = TasklistIdSchema.merge(ListPaginationSchema).merge(ResponseFormatSchema);

/**
 * 子任務父任務 ID 參數
 */
export const SubtaskParentSchema = z.object({
  parent_task_id: z
    .string()
    .min(1)
    .describe("Parent task ID (required)"),
});

/**
 * 建立子任務
 */
export const SubtaskCreateSchema = SubtaskParentSchema.extend({
  summary: z
    .string()
    .min(1)
    .max(500)
    .describe("Subtask summary (required)"),
  members: z
    .array(z.string())
    .optional()
    .describe("Assignee user IDs (open_id or user_id)"),
  start_time: z
    .string()
    .optional()
    .describe("Start time in ISO 8601 format (e.g., 2024-12-01T09:00:00+08:00)"),
  due_time: z
    .string()
    .optional()
    .describe("Due time in ISO 8601 format (e.g., 2024-12-31T23:59:59+08:00)"),
}).merge(ResponseFormatSchema);

/**
 * 列出子任務
 */
export const SubtaskListSchema = SubtaskParentSchema.merge(ListPaginationSchema).merge(ResponseFormatSchema);

/**
 * 更新子任務
 */
export const SubtaskUpdateSchema = TaskIdSchema.extend({
  summary: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe("New subtask summary"),
  members: z
    .array(z.string())
    .optional()
    .describe("New assignee user IDs (open_id or user_id)"),
  start_time: z
    .string()
    .optional()
    .describe("New start time in ISO 8601 format"),
  due_time: z
    .string()
    .optional()
    .describe("New due time in ISO 8601 format"),
});

/**
 * Section GUID 參數
 */
export const SectionGuidSchema = z.object({
  section_guid: z
    .string()
    .min(1)
    .describe("Section GUID (required)"),
});

/**
 * 列出 Section
 */
export const SectionListSchema = z.object({
  resource_type: z
    .enum(["my_tasks", "tasklist"])
    .default("my_tasks")
    .describe("Resource type: 'my_tasks' (我負責的) or 'tasklist' (清單)"),
  resource_id: z
    .string()
    .optional()
    .describe("Tasklist GUID (required when resource_type is 'tasklist')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Max results (default: 50)"),
}).merge(ResponseFormatSchema);

/**
 * 列出 Section 中的任務
 */
export const SectionTasksSchema = SectionGuidSchema.extend({
  completed: z
    .boolean()
    .optional()
    .describe("Filter by completion status"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Max results (default: 50)"),
}).merge(ResponseFormatSchema);

// 型別匯出
export type SectionListInput = z.infer<typeof SectionListSchema>;
export type SectionTasksInput = z.infer<typeof SectionTasksSchema>;
export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;
export type TodoListInput = z.infer<typeof TodoListSchema>;
export type TodoSearchInput = z.infer<typeof TodoSearchSchema>;
export type TodoCompleteInput = z.infer<typeof TodoCompleteSchema>;
export type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>;
export type TodoDeleteInput = z.infer<typeof TodoDeleteSchema>;
export type TasklistCreateInput = z.infer<typeof TasklistCreateSchema>;
export type TasklistListInput = z.infer<typeof TasklistListSchema>;
export type TasklistGetInput = z.infer<typeof TasklistGetSchema>;
export type TasklistUpdateInput = z.infer<typeof TasklistUpdateSchema>;
export type TasklistDeleteInput = z.infer<typeof TasklistDeleteSchema>;
export type TasklistAddTaskInput = z.infer<typeof TasklistAddTaskSchema>;
export type TasklistRemoveTaskInput = z.infer<typeof TasklistRemoveTaskSchema>;
export type TasklistTasksInput = z.infer<typeof TasklistTasksSchema>;
export type SubtaskCreateInput = z.infer<typeof SubtaskCreateSchema>;
export type SubtaskListInput = z.infer<typeof SubtaskListSchema>;
export type SubtaskUpdateInput = z.infer<typeof SubtaskUpdateSchema>;
