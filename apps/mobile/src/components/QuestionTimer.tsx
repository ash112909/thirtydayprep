import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useThemedStyles } from "@/hooks/useThemedStyles";

interface Props {
  benchmarkSeconds: number;
  running: boolean;
  resetKey: string | number;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// Counts down from the question's expected pace (questions.avg_seconds) so
// practice has a real sense of the clock running, without pretending to be
// a full timed section — going past zero just flips to an elapsed "+"
// count in the danger color rather than locking the student out, since a
// missed pace target is information, not a penalty.
export function QuestionTimer({ benchmarkSeconds, running, resetKey }: Props) {
  const { styles } = useThemedStyles((colors) => ({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    textWarning: { color: colors.warning },
    textOver: { color: colors.danger },
  }));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
  }, [resetKey]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running, resetKey]);

  const remaining = benchmarkSeconds - elapsed;
  const overTime = remaining <= 0;
  const nearingEnd = !overTime && remaining <= benchmarkSeconds * 0.25;

  return (
    <View style={styles.pill}>
      <Text style={[styles.text, nearingEnd && styles.textWarning, overTime && styles.textOver]}>
        {overTime ? `+${formatClock(-remaining)}` : formatClock(remaining)}
      </Text>
    </View>
  );
}
