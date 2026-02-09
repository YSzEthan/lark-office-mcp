/**
 * Markdown ↔ Lark Block 轉換工具
 * 解決原生 API schema 過大的問題（30,000+ tokens → 精簡輸入）
 */

import type { LarkBlock, LarkTextContent } from "../types.js";
import { getSheetAsMarkdown } from "../services/lark-client.js";

// =============================================================================
// Markdown → Lark Blocks
// =============================================================================

/**
 * 建立文字元素
 */
function textElement(content: string, style?: {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  inline_code?: boolean;
}): LarkTextContent {
  return {
    elements: [{
      text_run: {
        content,
        ...(style && { text_element_style: style }),
      },
    }],
  };
}

/**
 * 解析行內樣式（粗體、斜體、刪除線、行內程式碼）
 */
function parseInlineStyles(text: string): LarkTextContent {
  const elements: LarkTextContent["elements"] = [];

  // 簡化處理：支援 **粗體**、*斜體*、~~刪除線~~、`行內程式碼`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|[^*~`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // **粗體**
      elements.push({ text_run: { content: match[2], text_element_style: { bold: true } } });
    } else if (match[3]) {
      // *斜體*
      elements.push({ text_run: { content: match[3], text_element_style: { italic: true } } });
    } else if (match[4]) {
      // ~~刪除線~~
      elements.push({ text_run: { content: match[4], text_element_style: { strikethrough: true } } });
    } else if (match[5]) {
      // `行內程式碼`
      elements.push({ text_run: { content: match[5], text_element_style: { inline_code: true } } });
    } else if (match[0]) {
      // 普通文字
      elements.push({ text_run: { content: match[0] } });
    }
  }

  return { elements: elements.length > 0 ? elements : [{ text_run: { content: text } }] };
}

/**
 * Markdown 語法對應表
 */
const MARKDOWN_PATTERNS: Array<{
  regex: RegExp;
  toBlock: (match: RegExpMatchArray, line: string) => Record<string, unknown>;
}> = [
  // 標題 H1-H9（Lark 支援 9 級標題）
  { regex: /^######### (.+)$/, toBlock: (m) => ({ block_type: 11, heading9: parseInlineStyles(m[1]) }) },
  { regex: /^######## (.+)$/, toBlock: (m) => ({ block_type: 10, heading8: parseInlineStyles(m[1]) }) },
  { regex: /^####### (.+)$/, toBlock: (m) => ({ block_type: 9, heading7: parseInlineStyles(m[1]) }) },
  { regex: /^###### (.+)$/, toBlock: (m) => ({ block_type: 8, heading6: parseInlineStyles(m[1]) }) },
  { regex: /^##### (.+)$/, toBlock: (m) => ({ block_type: 7, heading5: parseInlineStyles(m[1]) }) },
  { regex: /^#### (.+)$/, toBlock: (m) => ({ block_type: 6, heading4: parseInlineStyles(m[1]) }) },
  { regex: /^### (.+)$/, toBlock: (m) => ({ block_type: 5, heading3: parseInlineStyles(m[1]) }) },
  { regex: /^## (.+)$/, toBlock: (m) => ({ block_type: 4, heading2: parseInlineStyles(m[1]) }) },
  { regex: /^# (.+)$/, toBlock: (m) => ({ block_type: 3, heading1: parseInlineStyles(m[1]) }) },

  // 清單
  { regex: /^[-*] \[x\] (.+)$/i, toBlock: (m) => ({ block_type: 17, todo: { ...parseInlineStyles(m[1]), done: true } }) },
  { regex: /^[-*] \[ \] (.+)$/, toBlock: (m) => ({ block_type: 17, todo: { ...parseInlineStyles(m[1]), done: false } }) },
  { regex: /^[-*] (.+)$/, toBlock: (m) => ({ block_type: 12, bullet: parseInlineStyles(m[1]) }) },
  { regex: /^\d+\.\s(.+)$/, toBlock: (m) => ({ block_type: 13, ordered: parseInlineStyles(m[1]) }) },

  // 引用
  { regex: /^>\s?(.*)$/, toBlock: (m) => ({ block_type: 15, quote: textElement(m[1] || "") }) },

  // 分隔線
  { regex: /^(-{3,}|_{3,}|\*{3,})$/, toBlock: () => ({ block_type: 22, divider: {} }) },
];

/**
 * 將 Markdown 轉換為 Lark Blocks
 */
export function markdownToBlocks(markdown: string): Array<Record<string, unknown>> {
  const lines = markdown.split("\n");
  const blocks: Array<Record<string, unknown>> = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLanguage = "";

  for (const line of lines) {
    // 處理程式碼區塊
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeContent = [];
      } else {
        // 結束程式碼區塊
        blocks.push({
          block_type: 14,
          code: {
            elements: [{ text_run: { content: codeContent.join("\n") } }],
            language: getLanguageCode(codeLanguage),
          },
        });
        inCodeBlock = false;
        codeContent = [];
        codeLanguage = "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // 跳過空行
    if (!line.trim()) continue;

    // 檢查 Markdown 語法
    let matched = false;
    for (const pattern of MARKDOWN_PATTERNS) {
      const match = line.match(pattern.regex);
      if (match) {
        blocks.push(pattern.toBlock(match, line));
        matched = true;
        break;
      }
    }

    // 預設為普通文字
    if (!matched) {
      blocks.push({ block_type: 2, text: parseInlineStyles(line) });
    }
  }

  return blocks;
}

/**
 * 程式語言對應 Lark 語言代碼
 */
function getLanguageCode(language: string): number {
  const languageMap: Record<string, number> = {
    "": 0,
    "plaintext": 1,
    "bash": 3,
    "shell": 3,
    "sh": 3,
    "c": 4,
    "cpp": 5,
    "c++": 5,
    "csharp": 6,
    "c#": 6,
    "css": 7,
    "go": 9,
    "html": 12,
    "java": 13,
    "javascript": 14,
    "js": 14,
    "json": 16,
    "kotlin": 18,
    "markdown": 20,
    "md": 20,
    "php": 22,
    "python": 24,
    "py": 24,
    "ruby": 26,
    "rust": 27,
    "sql": 29,
    "swift": 31,
    "typescript": 33,
    "ts": 33,
    "xml": 36,
    "yaml": 37,
    "yml": 37,
  };

  return languageMap[language.toLowerCase()] ?? 1;
}

// =============================================================================
// Lark Blocks → Markdown
// =============================================================================

/**
 * 渲染表格為 Markdown
 */
function renderTable(
  block: LarkBlock,
  blockMap: Map<string, LarkBlock>,
  extractTextFn: (content?: LarkTextContent) => string
): string | null {
  const property = block.table?.property;
  const cells = block.table?.cells;

  if (!property?.row_size || !property?.column_size || !cells) {
    return null;
  }

  const rows = property.row_size;
  const cols = property.column_size;
  const tableLines: string[] = [];

  // 遍歷每一行
  for (let row = 0; row < rows; row++) {
    const rowCells: string[] = [];

    for (let col = 0; col < cols; col++) {
      const cellIndex = row * cols + col;
      const cellId = cells[cellIndex];
      const cellBlock = cellId ? blockMap.get(cellId) : null;

      // 提取單元格內容
      let cellContent = "";
      if (cellBlock) {
        // TableCell 的內容可能在 children 中
        if (cellBlock.children?.length) {
          const childContents: string[] = [];
          for (const childId of cellBlock.children) {
            const childBlock = blockMap.get(childId);
            if (childBlock) {
              const text = extractTextFn(
                childBlock.text || childBlock.bullet || childBlock.ordered
              );
              if (text) childContents.push(text);
            }
          }
          cellContent = childContents.join(" ");
        } else if (cellBlock.table_cell) {
          cellContent = extractTextFn(cellBlock.table_cell);
        }
      }

      // 清理單元格內容（移除換行和管道符）
      cellContent = cellContent.replace(/[\n\r|]/g, " ").trim();
      rowCells.push(cellContent || " ");
    }

    tableLines.push(`| ${rowCells.join(" | ")} |`);

    // 第一行後加分隔線
    if (row === 0) {
      tableLines.push(`| ${rowCells.map(() => "---").join(" | ")} |`);
    }
  }

  return tableLines.join("\n");
}

/**
 * 從 Lark Block 提取文字內容
 */
function extractText(content?: LarkTextContent): string {
  if (!content?.elements) return "";

  return content.elements.map((el) => {
    if (el.text_run) {
      let text = el.text_run.content;
      const style = el.text_run.text_element_style;

      if (style?.bold) text = `**${text}**`;
      if (style?.italic) text = `*${text}*`;
      if (style?.strikethrough) text = `~~${text}~~`;
      if (style?.inline_code) text = `\`${text}\``;
      if (style?.link?.url) text = `[${text}](${style.link.url})`;

      return text;
    }
    if (el.equation) return `$${el.equation.content}$`;
    return "";
  }).join("");
}

/**
 * 取得語言名稱
 */
function getLanguageName(code?: number): string {
  const languageNames: Record<number, string> = {
    0: "",
    1: "plaintext",
    3: "bash",
    4: "c",
    5: "cpp",
    6: "csharp",
    7: "css",
    9: "go",
    12: "html",
    13: "java",
    14: "javascript",
    16: "json",
    18: "kotlin",
    20: "markdown",
    22: "php",
    24: "python",
    26: "ruby",
    27: "rust",
    29: "sql",
    31: "swift",
    33: "typescript",
    36: "xml",
    37: "yaml",
  };

  return languageNames[code ?? 0] ?? "";
}

/**
 * 將 Lark Blocks 轉換為 Markdown
 * 解決原生 API 回應過大的問題（88,946 字符 → 純文字）
 */
export async function blocksToMarkdown(blocks: LarkBlock[]): Promise<string> {
  const lines: string[] = [];

  // 建立 block map 以便查找子 blocks（用於表格）
  const blockMap = new Map<string, LarkBlock>();
  for (const block of blocks) {
    blockMap.set(block.block_id, block);
  }

  for (const block of blocks) {
    switch (block.block_type) {
      case 1: // Page（文件根節點，跳過）
        break;
      case 2: // Text
        lines.push(extractText(block.text));
        break;
      case 3: // Heading1
        lines.push(`# ${extractText(block.heading1)}`);
        break;
      case 4: // Heading2
        lines.push(`## ${extractText(block.heading2)}`);
        break;
      case 5: // Heading3
        lines.push(`### ${extractText(block.heading3)}`);
        break;
      case 6: // Heading4
        lines.push(`#### ${extractText(block.heading4)}`);
        break;
      case 7: // Heading5
        lines.push(`##### ${extractText(block.heading5)}`);
        break;
      case 8: // Heading6
        lines.push(`###### ${extractText(block.heading6)}`);
        break;
      case 9: // Heading7
        lines.push(`####### ${extractText(block.heading7)}`);
        break;
      case 10: // Heading8
        lines.push(`######## ${extractText(block.heading8)}`);
        break;
      case 11: // Heading9
        lines.push(`######### ${extractText(block.heading9)}`);
        break;
      case 12: // Bullet
        lines.push(`- ${extractText(block.bullet)}`);
        break;
      case 13: // Ordered
        lines.push(`1. ${extractText(block.ordered)}`);
        break;
      case 14: // Code
        const lang = getLanguageName(block.code?.language);
        lines.push(`\`\`\`${lang}`);
        lines.push(extractText(block.code));
        lines.push("```");
        break;
      case 15: // Quote
        lines.push(`> ${extractText(block.quote)}`);
        break;
      case 16: // Equation
        lines.push(`$$${extractText(block.equation)}$$`);
        break;
      case 17: // Todo
        const checked = block.todo?.done ? "x" : " ";
        lines.push(`- [${checked}] ${extractText(block.todo)}`);
        break;
      case 19: // Callout（高亮塊）
        lines.push(`> 💡 ${extractText(block.callout)}`);
        break;
      case 22: // Divider（分割線）
        lines.push("---");
        break;
      case 23: // File（文件）
        if (block.file?.token) {
          lines.push(`📎 [file](lark://file/${block.file.token})`);
        }
        break;
      case 27: // Image（圖片）
        if (block.image?.token) {
          lines.push(`![image](lark://image/${block.image.token})`);
        }
        break;
      case 30: // Sheet（嵌入多維表格）
        if (block.sheet?.token) {
          const sheetContent = await getSheetAsMarkdown(block.sheet.token);
          if (sheetContent) {
            lines.push(sheetContent);
          }
        }
        break;
      case 31: // Table（原生表格）
        const tableLines = renderTable(block, blockMap, extractText);
        if (tableLines) {
          lines.push(tableLines);
        }
        break;
      case 32: // TableCell（表格單元格，由 Table 處理，跳過）
        break;
      default:
        // 未知類型，嘗試提取文字
        const textContent = block.text || block.bullet || block.ordered;
        if (textContent) {
          lines.push(extractText(textContent));
        }
    }
  }

  return lines.join("\n");
}
