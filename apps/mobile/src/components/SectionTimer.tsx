import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useThemedStyles } from "@/hooks/useThemedStyles";

interface Props {
  totalSeconds: number;
  running: boolean;
  resetKey: string | number;
  onExpire: () => void;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// A real countdown for a mock test section — unlike QuestionTimer (which
// just flips to an elapsed "+" count past zero for a single question), this
// one actually fires onExpire once the section's time budget runs out, so
// the section ends the way a real timed test section does.
export function SectionTimer({ totalSeconds, running, resetKey, onExpire }: Props) {
  const { styles } = useThemedStyles((colors) => ({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: { fontSize: 13, fontWeight: "700", color: colors.text },
    textWarning: { color: colors.warning },
    textOver: { color: colors.danger },
  }));
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    expiredRef.current = false;
  }, [resetKey, totalSeconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, resetKey, onExpire]);

  const nearingEnd = remaining > 0 && remaining <= totalSeconds * 0.1;

  return (
    <View style={styles.pill}>
      <Text style={[styles.text, nearingEnd && styles.textWarning, remaining <= 0 && styles.textOver]}>
        {formatClock(remaining)}
      </Text>
    </View>
  );
}
