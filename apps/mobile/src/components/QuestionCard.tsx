import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import type { Choice } from "@/types/domain";

interface Props {
  passage: string | null;
  stem: string;
  choices: Choice[];
  selected: string | null;
  correctChoice?: string | null; // when set, review mode: highlight right/wrong
  onSelect: (key: string) => void;
  disabled?: boolean;
}

export function QuestionCard({ passage, stem, choices, selected, correctChoice, onSelect, disabled }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {passage && (
        <View style={styles.passageBox}>
          <Text style={styles.passageText}>{passage}</Text>
        </View>
      )}
      <Text style={styles.stem}>{stem}</Text>
      <View style={styles.choices}>
        {choices.map((choice) => {
          const isSelected = selected === choice.key;
          const isCorrect = correctChoice === choice.key;
          const showResult = correctChoice != null;
          const isWrongSelected = showResult && isSelected && !isCorrect;

          return (
            <Pressable
              key={choice.key}
              disabled={disabled}
              onPress={() => onSelect(choice.key)}
              style={[
                styles.choice,
                isSelected && styles.choiceSelected,
                showResult && isCorrect && styles.choiceCorrect,
                isWrongSelected && styles.choiceWrong,
              ]}
            >
              <Text style={styles.choiceKey}>{choice.key}</Text>
              <Text style={styles.choiceText}>{choice.text}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  passageBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passageText: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  stem: { color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 20, lineHeight: 24 },
  choices: { gap: 12 },
  choice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  choiceCorrect: { borderColor: colors.success, backgroundColor: "#14532D33" },
  choiceWrong: { borderColor: colors.danger, backgroundColor: "#7F1D1D33" },
  choiceKey: { color: colors.textMuted, fontWeight: "700", width: 20 },
  choiceText: { color: colors.text, flex: 1, fontSize: 15, lineHeight: 21 },
});
