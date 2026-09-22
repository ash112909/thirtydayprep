import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// expo-haptics has no web implementation, and even on native a call can
// reject on devices/simulators without a haptic engine — swallow both
// rather than let a vibration failure break an answer submission.
function safeHaptic(run: () => Promise<void>) {
  if (Platform.OS === "web") return;
  run().catch(() => {});
}

export function hapticTap() {
  safeHaptic(() => Haptics.selectionAsync());
}

export function hapticCorrect() {
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticIncorrect() {
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

// A bigger moment (finishing a day, claiming an achievement) gets a
// stronger combo instead of the plain single-tap success notification.
export function hapticCelebrate() {
  safeHaptic(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
}
