// A handful of math questions have a data table authored as a GitHub-
// flavored-markdown pipe table embedded in their stem (e.g. "| Season |
// Count |\n| :---: | :---: |\n| Spring | 120 |..."). Rendered as plain
// text, the pipes and dashes just run together inline — this splits a
// stem/passage string into plain-text segments and table segments so a
// component can render the table as an actual grid.

export interface TextSegment {
  type: "text";
  content: string;
}

export interface TableSegment {
  type: "table";
  headers: string[];
  rows: string[][];
}

export type StemSegment = TextSegment | TableSegment;

const ROW_RE = /^\s*\|(.+)\|\s*$/;
const SEPARATOR_CELL_RE = /^:?-{2,}:?$/;

function splitRow(line: string): string[] {
  const match = line.match(ROW_RE);
  const inner = match ? match[1] : line;
  return inner.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  if (!ROW_RE.test(line)) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c));
}

// Quick pre-check so callers can skip parsing entirely for the ~99.9% of
// questions with no table — keeps their rendering byte-identical to before.
export function containsMarkdownTable(text: string): boolean {
  return text.includes("\n") && /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/m.test(text);
}

export function parseTextWithTables(text: string): StemSegment[] {
  const lines = text.split("\n");
  const segments: StemSegment[] = [];
  let buffer: string[] = [];

  function flushText() {
    const content = buffer.join("\n").trim();
    if (content) segments.push({ type: "text", content });
    buffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const nextIsSeparator = i + 1 < lines.length && isSeparatorRow(lines[i + 1]);
    if (ROW_RE.test(line) && nextIsSeparator) {
      flushText();
      const headers = splitRow(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && ROW_RE.test(lines[j])) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      segments.push({ type: "table", headers, rows });
      i = j;
      continue;
    }
    buffer.push(line);
    i++;
  }
  flushText();
  return segments;
}
