import { StyleProp, Text, TextStyle } from "react-native";
import { containsMarkdownTable, parseTextWithTables } from "@/lib/markdownTable";
import { MarkdownTable } from "@/components/MarkdownTable";

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
}

// Drop-in replacement for <Text>{stem}</Text> that also renders an embedded
// markdown data table (if any) as an actual grid instead of run-together
// inline text. Falls straight through to a plain Text for the vast
// majority of questions that have no table, so their rendering is
// unaffected.
export function StemText({ text, style }: Props) {
  if (!containsMarkdownTable(text)) {
    return <Text style={style}>{text}</Text>;
  }

  const segments = parseTextWithTables(text);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <Text key={i} style={style}>
            {seg.content}
          </Text>
        ) : (
          <MarkdownTable key={i} table={seg} />
        ),
      )}
    </>
  );
}
