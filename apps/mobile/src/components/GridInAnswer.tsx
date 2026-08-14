import { ScrollView, Text, TextInput } from "react-native";
import { PassageText } from "@/components/PassageText";
import { useThemedStyles } from "@/hooks/useThemedStyles";

interface Props {
  passage: string | null;
  underlineStart?: number | null;
  underlineEnd?: number | null;
  stem: string;
  value: string;
  correctAnswer?: string | null; // when set, review mode
  onChange: (value: string) => void;
  disabled?: boolean;
}

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

export function GridInAnswer({
  passage,
  underlineStart,
  underlineEnd,
  stem,
  value,
  correctAnswer,
  onChange,
  disabled,
}: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1 },
    content: { paddingBottom: 24 },
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
  }));

  const showResult = correctAnswer != null;
  const isCorrect = showResult && normalize(value) === normalize(correctAnswer!);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {passage && <PassageText passage={passage} underlineStart={underlineStart} underlineEnd={underlineEnd} />}
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
