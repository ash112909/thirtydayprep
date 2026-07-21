import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/theme";

interface Props {
  passage: string | null;
  stem: string;
  value: string;
  correctAnswer?: string | null; // when set, review mode
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function GridInAnswer({ passage, stem, value, correctAnswer, onChange, disabled }: Props) {
  const showResult = correctAnswer != null;
  const isCorrect = showResult && normalize(value) === normalize(correctAnswer!);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {passage && (
        <View style={styles.passageBox}>
          <Text style={styles.passageText}>{passage}</Text>
        </View>
      )}
      <Text style={styles.stem}>{stem}</Text>
      <Text style={styles.hint}>Enter your answer (numbers, fractions, or symbols like π are fine)</Text>
      <TextInput
        style={[
          styles.input,
          showResult && (isCorrect ? styles.inputCorrect : styles.inputWrong),
        ]}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder="Your answer"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showResult && !isCorrect && (
        <Text style={styles.correctAnswerText}>Correct answer: {correctAnswer}</Text>
      )}
    </ScrollView>
  );
}

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
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
  stem: { color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 8, lineHeight: 24 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  inputCorrect: { borderColor: colors.success, backgroundColor: "#14532D33" },
  inputWrong: { borderColor: colors.danger, backgroundColor: "#7F1D1D33" },
  correctAnswerText: { color: colors.success, fontSize: 13, marginTop: 10 },
});
