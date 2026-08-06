import { useEffect, useState } from "react";
import { Image, Pressable, Text, type ImageSourcePropType } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { Energy, GrowthStage } from "@/lib/petState";
import type { PetSpecies } from "@/types/domain";

export type PetAction = "petting" | "eating" | "playing";
type Pose = "idle" | "energetic" | "sleepy" | "eating" | "playing";

interface Props {
  species: PetSpecies;
  energy: Energy;
  growthStage: GrowthStage;
  size?: number;
  activeAction?: PetAction | null;
  onActionComplete?: () => void;
}

const GROWTH_SCALE: Record<GrowthStage, number> = { hatchling: 0.78, adolescent: 0.9, grown: 1 };
const ENERGY_BREATH_MS: Record<Energy, number> = { sleepy: 2600, calm: 1700, energetic: 950 };
const ENERGY_SWAY_DEG: Record<Energy, number> = { sleepy: 0.8, calm: 1.6, energetic: 2.6 };
const ENERGY_SWAY_PX: Record<Energy, number> = { sleepy: 1, calm: 2.5, energetic: 4 };

const REACTION_CONFIG: Record<PetAction, { emoji: string; durationMs: number }> = {
  petting: { emoji: "💕", durationMs: 900 },
  eating: { emoji: "😋", durationMs: 1200 },
  playing: { emoji: "✨", durationMs: 1300 },
};

// Static requires — Metro needs these literal, can't build the path dynamically.
const IMAGES: Record<PetSpecies, Record<Pose, ImageSourcePropType>> = {
  cat: {
    idle: require("../../assets/pet/cat-idle.png"),
    energetic: require("../../assets/pet/cat-energetic.png"),
    sleepy: require("../../assets/pet/cat-sleepy.png"),
    eating: require("../../assets/pet/cat-eating.png"),
    playing: require("../../assets/pet/cat-playing.png"),
  },
  dog: {
    idle: require("../../assets/pet/dog-idle.png"),
    energetic: require("../../assets/pet/dog-energetic.png"),
    sleepy: require("../../assets/pet/dog-sleepy.png"),
    eating: require("../../assets/pet/dog-eating.png"),
    playing: require("../../assets/pet/dog-playing.png"),
  },
};

function resolvePose(energy: Energy, activeAction: PetAction | null | undefined): Pose {
  if (activeAction === "eating") return "eating";
  if (activeAction === "playing") return "playing";
  if (activeAction === "petting") return "energetic";
  if (energy === "sleepy") return "sleepy";
  if (energy === "energetic") return "energetic";
  return "idle";
}

export function StudyPet({ species, energy, growthStage, size = 220, activeAction, onActionComplete }: Props) {
  const breathe = useSharedValue(0);
  const sway = useSharedValue(0);
  const tapBounce = useSharedValue(0);
  const reactionBounce = useSharedValue(0);
  const reactionRotate = useSharedValue(0);
  const reactionDip = useSharedValue(0);
  const poseOpacity = useSharedValue(1);
  const emojiOpacity = useSharedValue(0);
  const emojiFloat = useSharedValue(0);
  const zFloat = useSharedValue(0);
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  const pose = resolvePose(energy, activeAction);

  // Idle breathing, skipped while a reaction is actively playing.
  useEffect(() => {
    if (activeAction) return;
    const speed = ENERGY_BREATH_MS[energy];
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: speed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: speed, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    const swaySpeed = speed * 1.8;
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: swaySpeed, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: swaySpeed, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    zFloat.value =
      energy === "sleepy"
        ? withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1)
        : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energy, activeAction]);

  // Fade in whenever the displayed pose changes.
  useEffect(() => {
    poseOpacity.value = 0;
    poseOpacity.value = withTiming(1, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  useEffect(() => {
    if (!activeAction) return;
    const config = REACTION_CONFIG[activeAction];
    setActiveEmoji(config.emoji);

    if (activeAction === "eating") {
      reactionDip.value = withRepeat(withSequence(withTiming(8, { duration: 150 }), withTiming(0, { duration: 150 })), 3, false);
    } else if (activeAction === "playing") {
      reactionBounce.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.3, { duration: 200 }), withTiming(1, { duration: 200 }), withTiming(0, { duration: 300 }));
      reactionRotate.value = withSequence(withTiming(8, { duration: 150 }), withTiming(-8, { duration: 150 }), withTiming(8, { duration: 150 }), withTiming(0, { duration: 150 }));
    } else {
      reactionBounce.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 300 }));
    }

    emojiOpacity.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: Math.max(config.durationMs - 400, 0) }), withTiming(0, { duration: 250 }));
    emojiFloat.value = 0;
    emojiFloat.value = withTiming(1, { duration: config.durationMs, easing: Easing.out(Easing.quad) });

    const timeout = setTimeout(() => {
      setActiveEmoji(null);
      onActionComplete?.();
    }, config.durationMs);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAction]);

  const bodyStyle = useAnimatedStyle(() => {
    const breatheScale = 1 + breathe.value * 0.025;
    const bounceScale = 1 + tapBounce.value * 0.12 + reactionBounce.value * 0.1;
    const swayDeg = sway.value * ENERGY_SWAY_DEG[energy];
    const swayPx = sway.value * ENERGY_SWAY_PX[energy];
    return {
      opacity: poseOpacity.value,
      transform: [
        { scale: GROWTH_SCALE[growthStage] * bounceScale },
        { scaleY: breatheScale },
        { translateY: reactionDip.value },
        { translateX: swayPx },
        { rotate: `${reactionRotate.value + swayDeg}deg` },
      ],
    };
  });

  const emojiStyle = useAnimatedStyle(() => ({
    opacity: emojiOpacity.value,
    transform: [{ translateY: -emojiFloat.value * 40 }, { scale: 0.8 + emojiFloat.value * 0.4 }],
  }));

  const zStyle = useAnimatedStyle(() => ({
    opacity: energy === "sleepy" ? (1 - zFloat.value) * 0.8 : 0,
    transform: [{ translateY: -zFloat.value * 30 }, { translateX: zFloat.value * 10 }],
  }));

  function handlePress() {
    tapBounce.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 260 }));
  }

  return (
    <Pressable onPress={handlePress} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {energy === "sleepy" && !activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 6, right: size * 0.12, zIndex: 1 }, zStyle]}>
          <Text style={{ fontSize: 20 }}>💤</Text>
        </Animated.View>
      )}
      {activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 6, zIndex: 1 }, emojiStyle]}>
          <Text style={{ fontSize: 28 }}>{activeEmoji}</Text>
        </Animated.View>
      )}
      <Animated.View style={bodyStyle}>
        <Image source={IMAGES[species][pose]} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}
