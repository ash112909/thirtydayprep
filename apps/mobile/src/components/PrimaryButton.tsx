import { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, Text } from "react-native";
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
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    secondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    disabled: {
      opacity: 0.5,
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

  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  function animateTo(toValue: number) {
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 5, tension: 200 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => !isDisabled && animateTo(0.96)}
        onPressOut={() => !isDisabled && animateTo(1)}
        style={[styles.base, isSecondary ? styles.secondary : styles.primary, isDisabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={isSecondary ? colors.primary : colors.onPrimary} />
        ) : (
          <Text style={[styles.text, isSecondary && styles.secondaryText]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
