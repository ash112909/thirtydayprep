import { Text, View } from "react-native";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { TableSegment } from "@/lib/markdownTable";

interface Props {
  table: TableSegment;
}

// Shared grid renderer for a parsed markdown table — used by both StemText
// (tables embedded in a question's stem) and PassageText (tables embedded
// in a reading passage, e.g. R&W "quantitative information" questions).
export function MarkdownTable({ table }: Props) {
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

  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        {table.headers.map((cell, ci) => (
          <View key={ci} style={[styles.cell, ci === table.headers.length - 1 && styles.lastCellInRow]}>
            <Text style={styles.headerCellText}>{cell}</Text>
          </View>
        ))}
      </View>
      {table.rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell, ci) => (
            <View
              key={ci}
              style={[
                styles.cell,
                ci === row.length - 1 && styles.lastCellInRow,
                ri === table.rows.length - 1 && styles.lastRow,
              ]}
            >
              <Text style={styles.cellText}>{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
