import { ActivityIndicator, Pressable, Text } from "react-native";
import { useThemedStyles } from "@/hooks/useThemedStyles";

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = "primary" }: Props) {
  const isSecondary = variant === "secondary";
  const { styles, colors } = useThemedStyles((colors) => ({
    base: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    text: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryText: {
      color: colors.text,
    },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : colors.onPrimary} />
      ) : (
        <Text style={[styles.text, isSecondary && styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}
