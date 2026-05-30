export type MarkdownBlock =
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return [];
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const parts = inner.split("|").map((c) => c.trim());
  if (trimmed.endsWith("|") && parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && t.length > 0;
}

function isSeparatorRow(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s/g, "")))
  );
}

/** 마크다운 표(| … |)와 일반 텍스트 블록으로 분리 */
export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let textBuf: string[] = [];
  let i = 0;

  const flushText = () => {
    if (textBuf.length > 0) {
      blocks.push({ type: "text", content: textBuf.join("\n") });
      textBuf = [];
    }
  };

  while (i < lines.length) {
    if (!isTableLine(lines[i]!)) {
      textBuf.push(lines[i]!);
      i += 1;
      continue;
    }

    const tableLines: string[] = [];
    while (i < lines.length && isTableLine(lines[i]!)) {
      tableLines.push(lines[i]!);
      i += 1;
    }

    if (tableLines.length < 2) {
      textBuf.push(...tableLines);
      continue;
    }

    const row0 = parseTableRow(tableLines[0]!);
    const row1 = parseTableRow(tableLines[1]!);

    if (isSeparatorRow(row1)) {
      flushText();
      const headers = row0;
      const rows: string[][] = [];
      for (let j = 2; j < tableLines.length; j += 1) {
        const cells = parseTableRow(tableLines[j]!);
        if (cells.length > 0) rows.push(cells);
      }
      if (headers.length > 0) {
        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    textBuf.push(...tableLines);
  }

  flushText();
  return blocks;
}

export function textHasMarkdownTable(text: string): boolean {
  return parseMarkdownBlocks(text).some((b) => b.type === "table");
}
