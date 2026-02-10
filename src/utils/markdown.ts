/**
 * Lark Block → Markdown 轉換工具
 * 用於將 Lark blocks 轉換為 Markdown 格式顯示給用戶
 */

import type { LarkBlock, LarkTextContent } from "../types.js";
import { getSheetAsMarkdown } from "../services/lark-client.js";

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
