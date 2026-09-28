import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { containsMarkdownTable, parseTextWithTables } from "@/lib/markdownTable";
import { MarkdownTable } from "@/components/MarkdownTable";

interface Props {
  passage: string;
  underlineStart?: number | null;
  underlineEnd?: number | null;
}

interface SentenceSpan {
  start: number;
  end: number;
}

interface Segment {
  start: number;
  end: number;
  sentenceIndex: number;
  underlined: boolean;
}

// Coarse sentence tokenizer — good enough to give each tap-to-highlight
// chunk a sensible boundary for SAT-style prose. Doesn't need to be
// linguistically perfect, just consistent for a given passage.
function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const re = /[^.!?\n]+[.!?]*(\s+|\n+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans.length ? spans : [{ start: 0, end: text.length }];
}

// Merges sentence boundaries with the (question-authored) underline span
// into one ordered list of renderable segments, each tagged with which
// sentence it belongs to (for highlight toggling) and whether it falls
// inside the underline.
function buildSegments(passage: string, underlineStart: number | null, underlineEnd: number | null): Segment[] {
  const sentences = splitSentences(passage);
  const hasUnderline =
    underlineStart != null &&
    underlineEnd != null &&
    underlineStart >= 0 &&
    underlineEnd > underlineStart &&
    underlineEnd <= passage.length;

  const breakpoints = new Set<number>([0, passage.length]);
  for (const s of sentences) {
    breakpoints.add(s.start);
    breakpoints.add(s.end);
  }
  if (hasUnderline) {
    breakpoints.add(underlineStart!);
    breakpoints.add(underlineEnd!);
  }

  const sorted = [...breakpoints].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const sentenceIndex = sentences.findIndex((s) => start >= s.start && end <= s.end);
    const underlined = hasUnderline && start >= underlineStart! && end <= underlineEnd!;
    segments.push({ start, end, sentenceIndex: sentenceIndex === -1 ? 0 : sentenceIndex, underlined });
  }
  return segments;
}

// Same idea as buildSegments, but scoped to one prose chunk that sits
// alongside an embedded table (see below) rather than the whole passage —
// underline spans never land on a table-bearing passage in practice, so
// this path skips that part and just keeps sentence tap-to-highlight
// working, with a running sentence-index offset so highlight state stays
// consistent across chunks.
function buildLocalSegments(text: string, sentenceIndexBase: number): { segments: Segment[]; nextBase: number } {
  const sentences = splitSentences(text);
  const breakpoints = new Set<number>([0, text.length]);
  for (const s of sentences) {
    breakpoints.add(s.start);
    breakpoints.add(s.end);
  }
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    const sentenceIndex = sentences.findIndex((s) => start >= s.start && end <= s.end);
    segments.push({ start, end, sentenceIndex: sentenceIndexBase + (sentenceIndex === -1 ? 0 : sentenceIndex), underlined: false });
  }
  return { segments, nextBase: sentenceIndexBase + sentences.length };
}

export function PassageText({ passage, underlineStart, underlineEnd }: Props) {
  const { styles } = useThemedStyles((colors) => ({
    box: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    hint: { color: colors.textMuted, fontSize: 11 },
    clearButton: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
    clearButtonText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
    text: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
    underlined: { textDecorationLine: "underline", color: colors.text, fontWeight: "600" },
    // A highlighter mark is a fixed real-world metaphor (yellow highlighter,
    // dark ink), not something that should flip with the app's light/dark
    // theme — same reasoning as the Buddy HUD's always-dark glass pills.
    highlighted: { backgroundColor: "#FDE047", color: "#1C1917" },
  }));

  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());

  useEffect(() => {
    setHighlighted(new Set());
  }, [passage]);

  const hasTable = useMemo(() => containsMarkdownTable(passage), [passage]);

  const segments = useMemo(
    () => (hasTable ? [] : buildSegments(passage, underlineStart ?? null, underlineEnd ?? null)),
    [passage, underlineStart, underlineEnd, hasTable],
  );

  // Only computed for the (rare) table-bearing case: the passage split
  // into its prose/table chunks, with each prose chunk pre-tokenized into
  // its own tappable sentence segments.
  const tableRenderPlan = useMemo(() => {
    if (!hasTable) return null;
    let base = 0;
    return parseTextWithTables(passage).map((seg) => {
      if (seg.type === "table") return { type: "table" as const, table: seg };
      const { segments: local, nextBase } = buildLocalSegments(seg.content, base);
      base = nextBase;
      return { type: "text" as const, content: seg.content, segments: local };
    });
  }, [passage, hasTable]);

  function toggleSentence(sentenceIndex: number) {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(sentenceIndex)) next.delete(sentenceIndex);
      else next.add(sentenceIndex);
      return next;
    });
  }

  return (
    <View style={styles.box}>
      <View style={styles.headerRow}>
        <Text style={styles.hint}>Tap a sentence to highlight it</Text>
        {highlighted.size > 0 && (
          <Pressable style={styles.clearButton} onPress={() => setHighlighted(new Set())}>
            <Text style={styles.clearButtonText}>Clear highlights</Text>
          </Pressable>
        )}
      </View>
      {tableRenderPlan ? (
        tableRenderPlan.map((part, i) =>
          part.type === "table" ? (
            <MarkdownTable key={i} table={part.table} />
          ) : (
            <Text key={i} style={styles.text}>
              {part.segments.map((seg, j) => (
                <Text
                  key={j}
                  onPress={() => toggleSentence(seg.sentenceIndex)}
                  style={[highlighted.has(seg.sentenceIndex) && styles.highlighted]}
                >
                  {part.content.slice(seg.start, seg.end)}
                </Text>
              ))}
            </Text>
          ),
        )
      ) : (
        <Text style={styles.text}>
          {segments.map((seg, i) => (
            <Text
              key={i}
              onPress={() => toggleSentence(seg.sentenceIndex)}
              style={[seg.underlined && styles.underlined, highlighted.has(seg.sentenceIndex) && styles.highlighted]}
            >
              {passage.slice(seg.start, seg.end)}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}
