import { StyleProp, Text, TextStyle, View } from "react-native";
import { containsMarkdownTable, parseTextWithTables } from "@/lib/markdownTable";
import { useThemedStyles } from "@/hooks/useThemedStyles";

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
  const { styles } = useThemedStyles((colors) => ({
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: "hidden",
      marginVertical: 12,
    },
    row: { flexDirection: "row" },
    headerRow: { backgroundColor: colors.surfaceAlt },
    cell: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastCellInRow: { borderRightWidth: 0 },
    lastRow: { borderBottomWidth: 0 },
    cellText: { color: colors.text, fontSize: 14, lineHeight: 19 },
    headerCellText: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  }));

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
          <View key={i} style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              {seg.headers.map((cell, ci) => (
                <View key={ci} style={[styles.cell, ci === seg.headers.length - 1 && styles.lastCellInRow]}>
                  <Text style={styles.headerCellText}>{cell}</Text>
                </View>
              ))}
            </View>
            {seg.rows.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((cell, ci) => (
                  <View
                    key={ci}
                    style={[
                      styles.cell,
                      ci === row.length - 1 && styles.lastCellInRow,
                      ri === seg.rows.length - 1 && styles.lastRow,
                    ]}
                  >
                    <Text style={styles.cellText}>{cell}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ),
      )}
    </>
  );
}
