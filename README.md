# Lark MCP Server

Lark (飛書) MCP Server - 讓 Claude 直接操作 Lark 文件、Wiki、待辦事項。

## 基本資訊

| 項目 | 值 |
|------|-----|
| 名稱 | lark-mcp-server |
| 版本 | 3.12.0 |
| 執行環境 | Bun |
| 認證方式 | OAuth 2.0 (User Access Token) |
| Token 儲存 | `~/.lark-token.json` |

## 安裝

```bash
bun install
```

## Claude Code 設定

在 `~/.claude/settings.json` 中加入：

```json
{
  "mcpServers": {
    "lark": {
      "command": "bun",
      "args": ["run", "/path/to/lark-mcp-server/src/index.ts"],
      "env": {
        "LARK_APP_ID": "your_app_id",
        "LARK_APP_SECRET": "your_app_secret"
      }
    }
  }
}
```

## 首次授權

1. 使用 `lark_auth_url` 取得授權連結
2. 在瀏覽器開啟連結並登入
3. 複製回調網址中的 `code` 參數
4. 使用 `lark_auth` 提交授權碼

---

## 工具列表

### 認證工具

| 工具 | 說明 |
|------|------|
| `lark_auth_url` | 取得 Lark 授權連結 |
| `lark_auth` | 提交授權碼完成 OAuth 登入 |
| `user_me` | 取得當前用戶資訊（open_id、name、email）|
| `user_get` | 查詢指定用戶資訊 |
| `user_list` | 列出部門成員 |

### Wiki 工具

| 工具 | 說明 |
|------|------|
| `wiki_spaces` | 列出所有 Wiki 空間 |
| `wiki_list_nodes` | 列出 Wiki 空間的節點 |
| `wiki_read` | 讀取 Wiki 內容（回傳原始 blocks）|
| `wiki_update` | 更新 Wiki 內容（範圍更新或清空重寫）|
| `wiki_prepend` | 在 Wiki 頂部插入內容 |
| `wiki_append` | 在 Wiki 底部追加內容 |
| `wiki_insert_blocks` | 在指定位置插入內容 |
| `wiki_delete_blocks` | 刪除指定範圍的區塊 |

### 文件工具

| 工具 | 說明 |
|------|------|
| `doc_create` | 建立新文件 |
| `doc_read` | 讀取文件（回傳原始 blocks）|
| `blocks_to_markdown` | 將 blocks 轉換為 Markdown（顯示用）|
| `doc_update` | 更新文件內容（範圍更新或清空重寫）|
| `doc_delete` | 刪除文件 |
| `doc_insert_blocks` | 在指定位置插入內容 |
| `doc_delete_blocks` | 刪除指定範圍的區塊 |
| `drive_list` | 列出雲端硬碟檔案 |
| `drive_recent` | 列出最近存取的檔案 |
| `lark_search` | 全域搜尋（支援我的文件資料庫、共享空間）|

### 待辦事項工具

| 工具 | 說明 |
|------|------|
| `todo_list` | 列出待辦事項 |
| `todo_create` | 建立待辦事項 |
| `todo_search` | 搜尋待辦事項 |
| `todo_update` | 更新待辦事項 |
| `todo_add_members` | 新增任務負責人 |
| `todo_remove_members` | 移除任務負責人 |
| `task_complete` | 完成任務或子任務 |
| `task_delete` | 刪除任務或子任務 |

### 任務清單工具

| 工具 | 說明 |
|------|------|
| `tasklist_list` | 列出所有任務清單 |
| `tasklist_create` | 建立任務清單 |
| `tasklist_get` | 取得任務清單詳情 |
| `tasklist_update` | 更新任務清單名稱 |
| `tasklist_delete` | 刪除任務清單 |
| `tasklist_add_task` | 將待辦加入清單（可指定分組）|
| `tasklist_remove_task` | 從清單移除待辦 |
| `tasklist_tasks` | 列出清單中的待辦 |

### 子任務工具

| 工具 | 說明 |
|------|------|
| `subtask_create` | 建立子任務（支援負責人、開始/截止時間）|
| `subtask_list` | 列出父任務的子任務 |
| `subtask_update` | 更新子任務（摘要、負責人、時間）|

> 注意：子任務的完成和刪除請使用 `task_complete` 和 `task_delete`。

### 任務分組工具

| 工具 | 說明 |
|------|------|
| `section_list` | 列出任務分組（「我負責的」或任務清單中的分組）|
| `section_tasks` | 列出分組中的任務（支援過濾未完成）|
| `section_create` | 建立分組（Tasklist 或「我負責的」）|
| `section_delete` | 刪除分組 |

> **注意**：Lark API 限制，只有 Tasklist 中的分組支援透過 `tasklist_add_task` 加入任務。「我負責的」中的分組只能透過 UI 操作移動任務。

---

## 通用參數

所有列表/搜尋工具皆支援以下可選參數：

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| limit | number | 20（list）/ 10（search）| 最大結果數 (1-100) |
| offset | number | 0 | 分頁偏移量 |
| response_format | string | "json" | 輸出格式（僅列表/搜尋工具支援）|

> **讀取工具說明**：`wiki_read` 和 `doc_read` 回傳原始 blocks。需要顯示給用戶時，使用 `blocks_to_markdown` 轉換。

---

## 工具參數詳細說明

### 認證工具

#### `lark_auth`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| code | string | 是 | 從授權頁面取得的授權碼 |

#### `user_me`

無參數。回傳當前用戶的 open_id、user_id、name、email、mobile。

#### `user_get`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| user_id | string | 是 | 用戶 ID（open_id 或 user_id）|

#### `user_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| department_id | string | 否 | 部門 ID（不填列出根部門 "0"）|

### Wiki 工具

#### `wiki_list_nodes`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| space_id | string | 是 | Wiki 空間 ID |
| parent_node_token | string | 否 | 父節點 Token（不填列出根節點）|

#### `wiki_read`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |

#### `wiki_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |
| content | string | 是 | 新的 Markdown 內容 |
| start_index | number | 否 | 起始位置（範圍更新時使用）|
| end_index | number | 否 | 結束位置（範圍更新時使用）|

#### `wiki_prepend` / `wiki_append`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |
| content | string | 是 | Markdown 內容 |

#### `wiki_insert_blocks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |
| content | string | 是 | Markdown 內容 |
| index | number | 否 | 插入位置（預設 0）|

#### `wiki_delete_blocks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |
| start_index | number | 是 | 起始位置（從 0 開始）|
| end_index | number | 是 | 結束位置（不包含）|

### 文件工具

#### `doc_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| folder_token | string | 是 | 目標資料夾 Token |
| title | string | 是 | 文件標題 |
| content | string | 否 | 初始 Markdown 內容 |

#### `doc_read`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |

#### `doc_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |
| content | string | 是 | 新的 Markdown 內容 |
| start_index | number | 否 | 起始位置（範圍更新時使用）|
| end_index | number | 否 | 結束位置（範圍更新時使用）|

#### `doc_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |

#### `doc_insert_blocks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |
| content | string | 是 | Markdown 內容 |
| index | number | 否 | 插入位置（預設 0）|

#### `doc_delete_blocks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |
| start_index | number | 是 | 起始位置（從 0 開始）|
| end_index | number | 是 | 結束位置（不包含）|

#### `drive_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| folder_token | string | 否 | 資料夾 Token（不填列出根目錄）|

#### `drive_recent`

無必填參數。

#### `blocks_to_markdown`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| blocks | array | 是 | 從 wiki_read 或 doc_read 取得的 blocks 陣列 |

#### `lark_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |
| doc_type | string | 否 | 文件類型（doc/docx/sheet/bitable/wiki/file）|
| folder_token | string | 否 | 限定搜尋的資料夾 |
| wiki_space_id | string | 否 | 限定搜尋的 Wiki 空間 |

> 使用 `/suite/docs-api/search/object` API，支援搜尋所有可存取文件（包括我的文件資料庫、共享空間）。

### 待辦事項工具

#### `todo_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| completed | boolean | 否 | 只列出已完成（預設 false）|

#### `todo_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| summary | string | 是 | 待辦摘要 |
| description | string | 否 | 詳細描述 |
| due_time | string | 否 | 截止時間（ISO 8601）|

#### `todo_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |
| completed | boolean | 否 | 只搜尋已完成 |

#### `task_complete` / `task_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 任務或子任務 ID |

#### `todo_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 待辦事項 ID |
| summary | string | 否 | 新摘要 |
| description | string | 否 | 新描述 |
| start_time | string | 否 | 開始時間（ISO 8601 格式）|
| due_time | string | 否 | 新截止時間（ISO 8601 格式）|

#### `todo_add_members` / `todo_remove_members`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 任務 ID |
| members | string[] | 是 | 用戶 ID 清單（open_id 或 user_id）|

### 任務清單工具

#### `tasklist_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | 清單名稱 |

#### `tasklist_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |
| name | string | 是 | 新清單名稱 |

#### `tasklist_get` / `tasklist_delete` / `tasklist_tasks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |

#### `tasklist_add_task`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |
| task_id | string | 是 | 待辦事項 ID |
| section_guid | string | 否 | 分組 GUID（不填則加入預設分組）|

> **提示**：若任務已在該清單中，再次呼叫並指定不同的 `section_guid` 可直接將任務移至新分組，無需先移除。

#### `tasklist_remove_task`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |
| task_id | string | 是 | 待辦事項 ID |

### 子任務工具

#### `subtask_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| parent_task_id | string | 是 | 父任務 ID |
| summary | string | 是 | 子任務摘要 |
| members | string[] | 否 | 負責人 ID 清單（open_id 或 user_id）|
| start_time | string | 否 | 開始時間（ISO 8601 格式）|
| due_time | string | 否 | 截止時間（ISO 8601 格式）|

#### `subtask_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| parent_task_id | string | 是 | 父任務 ID |

#### `subtask_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 子任務 ID |
| summary | string | 否 | 新摘要 |
| members | string[] | 否 | 新負責人 ID 清單 |
| start_time | string | 否 | 新開始時間（ISO 8601 格式）|
| due_time | string | 否 | 新截止時間（ISO 8601 格式）|

### 任務分組工具

#### `section_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| resource_type | string | 否 | 資源類型：`my_tasks`（我負責的）或 `tasklist`（清單），預設 `my_tasks` |
| resource_id | string | 條件 | 任務清單 GUID（當 resource_type 為 `tasklist` 時必填）|

#### `section_tasks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| section_guid | string | 是 | 分組 GUID |
| completed | boolean | 否 | 過濾完成狀態（`false` 只取未完成）|

#### `section_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | 分組名稱（最多 100 字元）|
| resource_type | string | 是 | 資源類型：`my_tasks` 或 `tasklist` |
| resource_id | string | 條件 | 任務清單 GUID（當 resource_type 為 `tasklist` 時必填）|

#### `section_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| section_guid | string | 是 | 分組 GUID |

---

## 支援的 Markdown 語法

| 語法 | 範例 | 支援 |
|------|------|------|
| 標題 | `# H1` ~ `###### H6` | 是 |
| 無序清單 | `- item` | 是 |
| 有序清單 | `1. item` | 是 |
| 引用 | `> quote` | 是 |
| 待辦 | `- [x] done` | 是 |
| 粗體 | `**bold**` | 是 |
| 斜體 | `*italic*` | 是 |
| 刪除線 | `~~strike~~` | 是 |
| 行內程式碼 | `` `code` `` | 是 |
| 分隔線 | `---` | 是 |
| 程式碼區塊 | ` ```lang ``` ` | 是 |
| 表格 | Markdown Table | 是 |

### 表格支援

**寫入**：Markdown 表格語法會自動轉換為 Lark 原生表格 (Block Type 31)。

> **注意**：Lark API 限制，表格寫入使用三步驟流程：
> 1. 建立空表格結構
> 2. API 回傳 cell IDs
> 3. 逐一填入儲存格內容
>
> 較大的表格寫入會較慢。使用 `wiki_update` / `doc_update` 更新含表格的內容時，會自動等待文件狀態同步（100ms）以確保穩定性。

**讀取**：支援兩種表格類型：

| 類型 | Block Type | 說明 |
|------|------------|------|
| 原生表格 (Table) | 31 | Lark 文件中的原生表格 |
| 嵌入多維表格 (Sheet) | 30 | 嵌入的 Bitable 表格（需 `bitable:app` 權限）|

---

## 所需權限 (Scopes)

在 Lark 開發者後台設定以下權限：

- `wiki:wiki` - Wiki 讀寫
- `drive:drive` - 雲端硬碟（含文件操作、搜尋）
- `bitable:app` - 多維表格讀取（嵌入的 Sheet 表格）
- `task:task:read` - 讀取待辦事項
- `task:task:write` - 寫入待辦事項
- `task:tasklist:read` - 讀取任務清單
- `task:tasklist:write` - 寫入任務清單
- `task:section:write` - 任務分組（取得「我負責的」任務）
- `contact:contact.base:readonly` - 列出部門成員
- `contact:user.base:readonly` - 讀取用戶基本資訊
- `contact:user.email:readonly` - 讀取用戶 email
- `offline_access` - 離線存取（Refresh Token）

---

## 專案結構

```
src/
├── index.ts              # MCP Server 入口
├── constants.ts          # 常數與設定
├── types.ts              # TypeScript 型別定義
├── schemas/              # Zod 驗證 Schema
│   ├── common.ts
│   ├── auth.ts
│   ├── wiki.ts
│   ├── doc.ts
│   └── todo.ts
├── services/
│   └── lark-client.ts    # Lark API 客戶端
├── tools/
│   ├── auth.ts           # 認證工具
│   ├── wiki.ts           # Wiki 工具
│   ├── doc.ts            # 文件工具
│   └── todo.ts           # 待辦事項工具
└── utils/
    ├── errors.ts         # 錯誤處理與錯誤碼定義
    ├── rate-limiter.ts   # API 請求頻率限制
    ├── retry.ts          # 重試機制（指數退避）
    ├── markdown.ts       # Markdown 與 Lark Block 轉換
    └── response.ts       # 回應格式化工具
```

---

## API 穩定性機制

### Rate Limiting

自動限制 API 請求頻率，防止觸發 Lark API 限流（錯誤碼 `99991400`）：

| 類型 | 限制 | 說明 |
|------|------|------|
| 全域限流 | 3 QPS | 所有 API 請求 |
| 文件級限流 | 3 QPS/文件 | 同一文件的編輯操作 |

### 自動重試

遇到可恢復錯誤時自動重試（指數退避）：

| 設定 | 值 |
|------|-----|
| 最大重試次數 | 3 次 |
| 基礎延遲 | 1 秒 |
| 最大延遲 | 10 秒 |

**可重試的錯誤**：
- `99991400` - Rate Limit
- `99991663` / `99991665` - Token 失效（自動刷新）
- `1770010` - 並發編輯衝突

### 結構化錯誤訊息

錯誤回應包含詳細資訊與建議：

```
Error: API request failed

**Error Code**: 99991668
**Description**: Resource access denied
**Message**: no permission to access resource
**Endpoint**: /wiki/v2/spaces/xxx
**Suggestion**: Ensure you have permission to access this resource.
```

---

## License

MIT
