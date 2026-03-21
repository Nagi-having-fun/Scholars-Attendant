/**
 * Convert Notion-flavored Markdown to Notion API block objects.
 *
 * Supports: headings, paragraphs, images, block equations, bulleted/numbered lists,
 * dividers, table_of_contents, tables (<table>), callouts (<callout>),
 * toggle details (<details>), and rich text (bold, italic, code, links, inline math).
 */

// ── Rich text types ──────────────────────────────────────────────

interface RichText {
  type: "text" | "equation";
  text?: { content: string; link?: { url: string } | null };
  equation?: { expression: string };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}

// ── Block helpers ────────────────────────────────────────────────

type Block = Record<string, unknown> & { object: "block"; type: string };

function heading(level: 1 | 2 | 3, richText: RichText[]): Block {
  const key = `heading_${level}` as const;
  return { object: "block", type: key, [key]: { rich_text: richText } };
}

function paragraph(richText: RichText[]): Block {
  return { object: "block", type: "paragraph", paragraph: { rich_text: richText } };
}

function bulletedListItem(richText: RichText[], children?: Block[]): Block {
  const item: Record<string, unknown> = { rich_text: richText };
  if (children?.length) item.children = children;
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: item };
}

function numberedListItem(richText: RichText[], children?: Block[]): Block {
  const item: Record<string, unknown> = { rich_text: richText };
  if (children?.length) item.children = children;
  return { object: "block", type: "numbered_list_item", numbered_list_item: item };
}

function imageBlock(url: string, caption: string): Block {
  return {
    object: "block",
    type: "image",
    image: {
      type: "external",
      external: { url },
      caption: caption ? parseInlineRichText(caption) : [],
    },
  };
}

function equationBlock(expression: string): Block {
  return { object: "block", type: "equation", equation: { expression } };
}

function divider(): Block {
  return { object: "block", type: "divider", divider: {} };
}

function tableOfContents(): Block {
  return { object: "block", type: "table_of_contents", table_of_contents: {} };
}

function calloutBlock(icon: string, color: string, children: Block[]): Block {
  const notionColor = color.replace("_bg", "_background") || "default";
  return {
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: icon || "💡" },
      color: notionColor,
      rich_text: [],
      children,
    },
  };
}

function tableBlock(
  rows: RichText[][][],
  hasHeader: boolean,
  fitWidth: boolean,
): Block {
  const width = rows[0]?.length ?? 1;
  const tableRows: Block[] = rows.map((row) => ({
    object: "block" as const,
    type: "table_row",
    table_row: { cells: row },
  }));
  return {
    object: "block",
    type: "table",
    table: {
      table_width: width,
      has_column_header: hasHeader,
      has_row_header: false,
      children: tableRows,
    },
  };
}

function toggleBlock(summary: RichText[], children: Block[]): Block {
  return {
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: summary,
      is_toggleable: true,
      children,
    },
  };
}

// ── Inline rich text parser ──────────────────────────────────────

export function parseInlineRichText(text: string): RichText[] {
  const result: RichText[] = [];
  let i = 0;

  function pushText(
    content: string,
    opts?: {
      bold?: boolean;
      italic?: boolean;
      code?: boolean;
      strikethrough?: boolean;
      link?: string;
    },
  ) {
    if (!content) return;
    const rt: RichText = { type: "text", text: { content, link: null } };
    if (opts?.link) rt.text!.link = { url: opts.link };
    const ann: RichText["annotations"] = {};
    if (opts?.bold) ann.bold = true;
    if (opts?.italic) ann.italic = true;
    if (opts?.code) ann.code = true;
    if (opts?.strikethrough) ann.strikethrough = true;
    if (Object.keys(ann).length) rt.annotations = ann;
    result.push(rt);
  }

  function pushEquation(expression: string) {
    result.push({ type: "equation", equation: { expression } });
  }

  while (i < text.length) {
    // Inline math $...$
    if (text[i] === "$" && text[i + 1] !== "$") {
      const end = text.indexOf("$", i + 1);
      if (end > i + 1) {
        let expr = text.slice(i + 1, end);
        // Handle $`...`$ variant
        if (expr.startsWith("`") && expr.endsWith("`")) {
          expr = expr.slice(1, -1);
        }
        pushEquation(expr);
        i = end + 1;
        continue;
      }
    }

    // Bold **...**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        pushText(text.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }

    // Italic *...*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        pushText(text.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }

    // Strikethrough ~~...~~
    if (text[i] === "~" && text[i + 1] === "~") {
      const end = text.indexOf("~~", i + 2);
      if (end > i + 2) {
        pushText(text.slice(i + 2, end), { strikethrough: true });
        i = end + 2;
        continue;
      }
    }

    // Inline code `...`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        pushText(text.slice(i + 1, end), { code: true });
        i = end + 1;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket > i && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket + 2) {
          const linkText = text.slice(i + 1, closeBracket);
          const linkUrl = text.slice(closeBracket + 2, closeParen);
          pushText(linkText, { link: linkUrl });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Plain text — collect until next special char
    let end = i + 1;
    while (end < text.length && !"*~`[$".includes(text[end])) {
      end++;
    }
    pushText(text.slice(i, end));
    i = end;
  }

  return result;
}

// ── Main converter ───────────────────────────────────────────────

export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  function currentLine(): string {
    return i < lines.length ? lines[i] : "";
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Table of contents
    if (trimmed === "<table_of_contents/>") {
      blocks.push(tableOfContents());
      i++;
      continue;
    }

    // Divider
    if (trimmed === "---") {
      blocks.push(divider());
      i++;
      continue;
    }

    // Block equation $$...$$
    if (trimmed === "$$") {
      i++;
      const exprLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "$$") {
        exprLines.push(lines[i]);
        i++;
      }
      blocks.push(equationBlock(exprLines.join("\n")));
      i++; // skip closing $$
      continue;
    }

    // Image ![caption](url)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push(imageBlock(imgMatch[2], imgMatch[1]));
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push(heading(level, parseInlineRichText(headingMatch[2])));
      i++;
      continue;
    }

    // Callout block
    if (trimmed.startsWith("<callout")) {
      const iconMatch = trimmed.match(/icon="([^"]*)"/);
      const colorMatch = trimmed.match(/color="([^"]*)"/);
      const icon = iconMatch?.[1] || "💡";
      const color = colorMatch?.[1] || "default";
      i++;

      // Collect inner content until </callout>
      const innerLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("</callout>")) {
        // Strip one level of tab indentation
        const l = lines[i].startsWith("\t") ? lines[i].slice(1) : lines[i];
        innerLines.push(l);
        i++;
      }
      i++; // skip </callout>

      const children = markdownToBlocks(innerLines.join("\n"));
      blocks.push(calloutBlock(icon, color, children));
      continue;
    }

    // Table block
    if (trimmed.startsWith("<table")) {
      const hasHeader = /header-row="true"/.test(trimmed);
      const fitWidth = /fit-page-width="true"/.test(trimmed);
      i++;

      // Skip <colgroup>
      while (i < lines.length && !lines[i].trim().startsWith("<tr")) {
        if (lines[i].trim().startsWith("</table>")) break;
        i++;
      }

      // Parse rows
      const rows: RichText[][][] = [];
      while (i < lines.length && !lines[i].trim().startsWith("</table>")) {
        const rowLine = lines[i].trim();
        if (rowLine.startsWith("<tr")) {
          i++;
          const cells: RichText[][] = [];
          while (i < lines.length && !lines[i].trim().startsWith("</tr>")) {
            const cellLine = lines[i].trim();
            const cellMatch = cellLine.match(/<td[^>]*>(.*?)<\/td>/);
            if (cellMatch) {
              cells.push(parseInlineRichText(cellMatch[1]));
            }
            i++;
          }
          if (cells.length) rows.push(cells);
          i++; // skip </tr>
        } else {
          i++;
        }
      }
      i++; // skip </table>

      if (rows.length) {
        blocks.push(tableBlock(rows, hasHeader, fitWidth));
      }
      continue;
    }

    // Toggle/details block
    if (trimmed.startsWith("<details")) {
      i++;
      let summaryText = "";
      if (i < lines.length && lines[i].trim().startsWith("<summary>")) {
        const sumMatch = lines[i].trim().match(/<summary>(.*?)<\/summary>/);
        summaryText = sumMatch?.[1] || "";
        i++;
      }

      const innerLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("</details>")) {
        const l = lines[i].startsWith("\t") ? lines[i].slice(1) : lines[i];
        innerLines.push(l);
        i++;
      }
      i++; // skip </details>

      const children = markdownToBlocks(innerLines.join("\n"));
      blocks.push(toggleBlock(parseInlineRichText(summaryText), children));
      continue;
    }

    // Bulleted list
    if (trimmed.startsWith("- ")) {
      blocks.push(bulletedListItem(parseInlineRichText(trimmed.slice(2))));
      i++;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      blocks.push(numberedListItem(parseInlineRichText(numMatch[2])));
      i++;
      continue;
    }

    // Quote block
    if (trimmed.startsWith("> ")) {
      blocks.push({
        object: "block",
        type: "quote",
        quote: { rich_text: parseInlineRichText(trimmed.slice(2)) },
      } as Block);
      i++;
      continue;
    }

    // Default: paragraph
    blocks.push(paragraph(parseInlineRichText(trimmed)));
    i++;
  }

  return blocks;
}
