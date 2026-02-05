# Lark MCP Server

Lark (飛書) MCP Server - 讓 Claude 直接操作 Lark 文件、Wiki、待辦事項。

## 基本資訊

| 項目 | 值 |
|------|-----|
| 名稱 | lark-mcp-server |
| 版本 | 3.4.0 |
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

### Wiki 工具

| 工具 | 說明 |
|------|------|
| `wiki_spaces` | 列出所有 Wiki 空間 |
| `wiki_list_nodes` | 列出 Wiki 空間的節點 |
| `wiki_read` | 讀取 Wiki 內容（回傳 Markdown）|
| `wiki_update` | 更新 Wiki 內容（範圍更新或清空重寫）|
| `wiki_prepend` | 在 Wiki 頂部插入內容 |
| `wiki_append` | 在 Wiki 底部追加內容 |
| `wiki_insert_blocks` | 在指定位置插入內容 |
| `wiki_delete_blocks` | 刪除指定範圍的區塊 |
| `wiki_search` | 搜尋 Wiki 空間 |

### 文件工具

| 工具 | 說明 |
|------|------|
| `doc_create` | 建立新文件 |
| `doc_read` | 讀取文件（回傳 Markdown）|
| `doc_update` | 更新文件內容（範圍更新或清空重寫）|
| `doc_delete` | 刪除文件 |
| `doc_insert_blocks` | 在指定位置插入內容 |
| `doc_delete_blocks` | 刪除指定範圍的區塊 |
| `doc_search` | 搜尋文件 |
| `drive_list` | 列出雲端硬碟檔案 |
| `lark_search` | 全域搜尋 |

### 待辦事項工具

| 工具 | 說明 |
|------|------|
| `todo_list` | 列出待辦事項 |
| `todo_create` | 建立待辦事項 |
| `todo_search` | 搜尋待辦事項 |
| `todo_complete` | 完成待辦事項 |
| `todo_update` | 更新待辦事項 |
| `todo_delete` | 刪除待辦事項 |

### 任務清單工具

| 工具 | 說明 |
|------|------|
| `tasklist_list` | 列出所有任務清單 |
| `tasklist_create` | 建立任務清單 |
| `tasklist_get` | 取得任務清單詳情 |
| `tasklist_update` | 更新任務清單名稱 |
| `tasklist_delete` | 刪除任務清單 |
| `tasklist_add_task` | 將待辦加入清單 |
| `tasklist_remove_task` | 從清單移除待辦 |
| `tasklist_tasks` | 列出清單中的待辦 |

### 子任務工具

| 工具 | 說明 |
|------|------|
| `subtask_create` | 建立子任務（支援負責人、開始/截止時間）|
| `subtask_list` | 列出父任務的子任務 |
| `subtask_update` | 更新子任務（摘要、負責人、時間）|
| `subtask_complete` | 完成子任務 |
| `subtask_delete` | 刪除子任務 |

---

## 通用參數

所有列表/搜尋工具皆支援以下可選參數：

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| limit | number | 50 | 最大結果數 (1-100) |
| offset | number | 0 | 分頁偏移量 |
| response_format | string | "markdown" | 輸出格式："markdown" 或 "json" |

---

## 工具參數詳細說明

### 認證工具

#### `lark_auth`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| code | string | 是 | 從授權頁面取得的授權碼 |

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

#### `wiki_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| space_id | string | 是 | Wiki 空間 ID |
| query | string | 是 | 搜尋關鍵字 |

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

#### `doc_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |
| folder_token | string | 否 | 限定搜尋的資料夾 |

#### `drive_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| folder_token | string | 否 | 資料夾 Token（不填列出根目錄）|

#### `lark_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |

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

#### `todo_complete` / `todo_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 待辦事項 ID |

#### `todo_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 待辦事項 ID |
| summary | string | 否 | 新摘要 |
| description | string | 否 | 新描述 |
| due_time | string | 否 | 新截止時間 |

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

#### `tasklist_add_task` / `tasklist_remove_task`

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

#### `subtask_complete` / `subtask_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 子任務 ID |

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

---

## 所需權限 (Scopes)

在 Lark 開發者後台設定以下權限：

- `wiki:wiki` - Wiki 讀寫
- `drive:drive` - 雲端硬碟（含文件操作、搜尋）
- `task:task:read` - 讀取待辦事項
- `task:task:write` - 寫入待辦事項
- `task:tasklist:read` - 讀取任務清單
- `task:tasklist:write` - 寫入任務清單
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
