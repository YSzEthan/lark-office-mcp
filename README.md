# Lark MCP Server

Lark (飛書) MCP Server - 讓 Claude 直接操作 Lark 文件、Wiki、待辦事項。

## 基本資訊

| 項目 | 值 |
|------|-----|
| 名稱 | lark-mcp |
| 版本 | 2.0.0 |
| 認證方式 | OAuth 2.0 (User Access Token) |
| Token 儲存 | `~/.lark-token.json` |

## 安裝

```bash
npm install
npm run build
```

## 環境變數

```bash
export LARK_APP_ID="your_app_id"
export LARK_APP_SECRET="your_app_secret"
```

## Claude Code 設定

在 `~/.claude/settings.json` 中加入：

```json
{
  "mcpServers": {
    "lark": {
      "command": "node",
      "args": ["/path/to/lark-wiki/dist/index.js"],
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
| `wiki_prepend` | 在 Wiki 頂部插入內容 |
| `wiki_append` | 在 Wiki 底部追加內容 |
| `wiki_insert_blocks` | 在指定位置插入內容 |
| `wiki_search` | 搜尋 Wiki 空間 |

### 文件工具

| 工具 | 說明 |
|------|------|
| `doc_create` | 建立新文件 |
| `doc_read` | 讀取文件（回傳 Markdown）|
| `doc_update` | 更新文件內容（清空重寫）|
| `doc_delete` | 刪除文件 |
| `doc_insert_blocks` | 在指定位置插入內容 |
| `doc_search` | 搜尋文件 |
| `drive_list` | 列出雲端硬碟檔案 |
| `search_all` | 全域搜尋 |

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
| `tasklist_delete` | 刪除任務清單 |
| `tasklist_add_task` | 將待辦加入清單 |
| `tasklist_remove_task` | 從清單移除待辦 |
| `tasklist_tasks` | 列出清單中的待辦 |

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
| parent_node_token | string | | 父節點 Token（不填列出根節點）|

#### `wiki_read`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| wiki_token | string | 是 | Wiki 節點 Token |

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
| index | number | | 插入位置（預設 0）|

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
| content | string | | 初始 Markdown 內容 |

#### `doc_read`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |

#### `doc_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |
| content | string | 是 | 新的 Markdown 內容 |

#### `doc_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |

#### `doc_insert_blocks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| document_id | string | 是 | 文件 ID |
| content | string | 是 | Markdown 內容 |
| index | number | | 插入位置（預設 0）|

#### `doc_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |
| folder_token | string | | 限定搜尋的資料夾 |

#### `drive_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| folder_token | string | | 資料夾 Token（不填列出根目錄）|

#### `search_all`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |

### 待辦事項工具

#### `todo_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| completed | boolean | | 只列出已完成（預設 false）|
| page_size | number | | 每頁數量（預設 50，最大 100）|
| page_token | string | | 分頁標記 |

#### `todo_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| summary | string | 是 | 待辦摘要 |
| description | string | | 詳細描述 |
| due_time | string | | 截止時間（ISO 8601）|

#### `todo_search`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| query | string | 是 | 搜尋關鍵字 |
| completed | boolean | | 只搜尋已完成 |

#### `todo_complete` / `todo_delete`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 待辦事項 ID |

#### `todo_update`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| task_id | string | 是 | 待辦事項 ID |
| summary | string | | 新摘要 |
| description | string | | 新描述 |
| due_time | string | | 新截止時間 |

### 任務清單工具

#### `tasklist_list`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| page_size | number | | 每頁數量（預設 50）|

#### `tasklist_create`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | 清單名稱 |

#### `tasklist_get` / `tasklist_delete` / `tasklist_tasks`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |

#### `tasklist_add_task` / `tasklist_remove_task`

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| tasklist_id | string | 是 | 任務清單 ID |
| task_id | string | 是 | 待辦事項 ID |

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
| 分隔線 | `---` | 替代格式 |
| 程式碼區塊 | ` ```lang ``` ` | 替代格式 |

> **注意**: 分隔線和程式碼區塊因 Lark API 限制，使用替代格式呈現。

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
├── index.ts          # MCP Server 入口
├── lark-client.ts    # Lark API 客戶端
├── tools/
│   ├── wiki.ts       # Wiki 工具
│   ├── doc.ts        # 文件工具
│   └── todo.ts       # 待辦事項工具
└── utils/
    ├── markdown.ts   # Markdown ↔ Lark Block 轉換
    └── response.ts   # 回應格式化工具
```

---

## 已知限制

### Lark API Block Type 限制

Lark Docx API 的建立端點不支援部分 block types：

| Block Type | 名稱 | 讀取 | 建立 |
|------------|------|------|------|
| 19 | Divider (分隔線) | 是 | 否 |
| 22 | Code (程式碼區塊) | 是 | 否 |
| 27 | Callout (提示區塊) | 是 | 否 |

這些 block types 會自動轉換為替代格式：
- 分隔線 → 視覺分隔線文字 `─────────────────────────────`
- 程式碼區塊 → `[語言]` 標籤 + inline_code 樣式文字

---

## License

MIT
