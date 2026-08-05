import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import type { Energy, GrowthStage } from "@/lib/petState";
import type { PetSpecies } from "@/types/domain";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type PetAction = "petting" | "eating" | "playing";

interface Props {
  species: PetSpecies;
  color: string;
  energy: Energy;
  growthStage: GrowthStage;
  equippedAccessories: string[];
  size?: number;
  activeAction?: PetAction | null;
  onActionComplete?: () => void;
}

const GROWTH_SCALE: Record<GrowthStage, number> = { hatchling: 0.72, adolescent: 0.87, grown: 1 };
const ENERGY_BREATH_MS: Record<Energy, number> = { sleepy: 2600, calm: 1700, energetic: 950 };
const ENERGY_TAIL_SWING: Record<Energy, number> = { sleepy: 4, calm: 12, energetic: 26 };

const REACTION_CONFIG: Record<PetAction, { emoji: string; durationMs: number }> = {
  petting: { emoji: "💕", durationMs: 900 },
  eating: { emoji: "😋", durationMs: 1200 },
  playing: { emoji: "✨", durationMs: 1300 },
};

function Ears({ species, color }: { species: PetSpecies; color: string }) {
  if (species === "cat") {
    return (
      <>
        <Path d="M 55 78 L 72 26 L 92 76 Z" fill={color} />
        <Path d="M 145 78 L 128 26 L 108 76 Z" fill={color} />
      </>
    );
  }
  return (
    <>
      <Ellipse cx={44} cy={98} rx={17} ry={32} fill={color} transform="rotate(-14 44 98)" />
      <Ellipse cx={156} cy={98} rx={17} ry={32} fill={color} transform="rotate(14 156 98)" />
    </>
  );
}

function Accessory({ id }: { id: string }) {
  switch (id) {
    case "bandana":
      return <Path d="M 70 152 L 130 152 L 100 178 Z" fill="#E85D5D" />;
    case "sunglasses":
      return (
        <G>
          <Rect x={68} y={104} width={26} height={16} rx={6} fill="#1A1A1A" />
          <Rect x={106} y={104} width={26} height={16} rx={6} fill="#1A1A1A" />
          <Rect x={94} y={109} width={12} height={4} fill="#1A1A1A" />
        </G>
      );
    case "bowtie":
      return (
        <G>
          <Path d="M 90 158 L 100 165 L 90 172 Z" fill="#5B7FE8" />
          <Path d="M 110 158 L 100 165 L 110 172 Z" fill="#5B7FE8" />
          <Circle cx={100} cy={165} r={3} fill="#3A56B0" />
        </G>
      );
    case "backpack":
      return (
        <G>
          <Rect x={38} y={140} width={16} height={38} rx={7} fill="#9B6B3E" />
          <Rect x={146} y={140} width={16} height={38} rx={7} fill="#9B6B3E" />
        </G>
      );
    case "gradcap":
      return (
        <G>
          <Rect x={70} y={38} width={60} height={8} fill="#1F2937" />
          <Rect x={90} y={46} width={20} height={10} rx={2} fill="#1F2937" />
          <Path d="M 130 42 L 142 55" stroke="#FBBF24" strokeWidth={2} />
          <Circle cx={142} cy={57} r={3} fill="#FBBF24" />
        </G>
      );
    case "scarf":
      return <Path d="M 68 150 Q 100 168 132 150 L 132 163 Q 100 180 68 163 Z" fill="#E8A34D" />;
    case "medal":
      return (
        <G>
          <Path d="M 90 145 L 97 158" stroke="#D64545" strokeWidth={3} />
          <Path d="M 110 145 L 103 158" stroke="#D64545" strokeWidth={3} />
          <Circle cx={100} cy={163} r={9} fill="#FFD700" stroke="#B8860B" strokeWidth={1.5} />
        </G>
      );
    case "explorerhat":
      return (
        <G>
          <Ellipse cx={100} cy={53} rx={56} ry={11} fill="#C2A46B" />
          <Ellipse cx={100} cy={40} rx={27} ry={17} fill="#C2A46B" />
          <Rect x={78} y={46} width={44} height={6} fill="#8B6F3E" />
        </G>
      );
    default:
      return null;
  }
}

export function StudyPet({
  species,
  color,
  energy,
  growthStage,
  equippedAccessories,
  size = 220,
  activeAction,
  onActionComplete,
}: Props) {
  const breathe = useSharedValue(0);
  const tailAngle = useSharedValue(0);
  const eyeSquish = useSharedValue(1);
  const tapBounce = useSharedValue(0);
  const reactionBounce = useSharedValue(0);
  const reactionRotate = useSharedValue(0);
  const emojiOpacity = useSharedValue(0);
  const emojiFloat = useSharedValue(0);
  const zFloat = useSharedValue(0);
  const restEyeOpenRef = useRef(1);
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  useEffect(() => {
    const speed = ENERGY_BREATH_MS[energy];
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: speed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: speed, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    const swing = ENERGY_TAIL_SWING[energy];
    tailAngle.value = withRepeat(
      withSequence(
        withTiming(swing, { duration: speed * 0.6, easing: Easing.inOut(Easing.quad) }),
        withTiming(-swing, { duration: speed * 0.6, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    const target = energy === "sleepy" ? 0.4 : 1;
    restEyeOpenRef.current = target;
    eyeSquish.value = withTiming(target, { duration: 400 });

    if (energy === "sleepy") {
      zFloat.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
    } else {
      zFloat.value = 0;
    }
  }, [energy, breathe, tailAngle, eyeSquish, zFloat]);

  useEffect(() => {
    const interval = setInterval(() => {
      eyeSquish.value = withSequence(withTiming(0.1, { duration: 90 }), withTiming(restEyeOpenRef.current, { duration: 130 }));
    }, 2800);
    return () => clearInterval(interval);
  }, [eyeSquish]);

  useEffect(() => {
    if (!activeAction) return;
    const config = REACTION_CONFIG[activeAction];
    setActiveEmoji(config.emoji);

    if (activeAction === "eating") {
      reactionBounce.value = withRepeat(withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 180 })), 3, false);
    } else if (activeAction === "playing") {
      reactionBounce.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.3, { duration: 200 }), withTiming(1, { duration: 200 }), withTiming(0, { duration: 300 }));
      reactionRotate.value = withSequence(withTiming(10, { duration: 150 }), withTiming(-10, { duration: 150 }), withTiming(10, { duration: 150 }), withTiming(0, { duration: 150 }));
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
    const breatheScale = 1 + breathe.value * 0.035;
    const bounceScale = 1 + tapBounce.value * 0.15 + reactionBounce.value * 0.12;
    return {
      transform: [
        { scale: GROWTH_SCALE[growthStage] * bounceScale },
        { scaleY: breatheScale },
        { rotate: `${reactionRotate.value}deg` },
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

  const tailAnimatedProps = useAnimatedProps(() => ({ rotation: tailAngle.value }));
  const eyeAnimatedProps = useAnimatedProps(() => ({ ry: 9 * eyeSquish.value }));

  function handlePress() {
    tapBounce.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 260 }));
  }

  const backpack = equippedAccessories.includes("backpack");
  const otherAccessories = equippedAccessories.filter((id) => id !== "backpack");

  return (
    <Pressable onPress={handlePress} style={{ width: size, alignItems: "center" }}>
      {energy === "sleepy" && !activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 10, right: size * 0.15, zIndex: 1 }, zStyle]}>
          <Text style={{ fontSize: 20 }}>💤</Text>
        </Animated.View>
      )}
      {activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 10, zIndex: 1 }, emojiStyle]}>
          <Text style={{ fontSize: 28 }}>{activeEmoji}</Text>
        </Animated.View>
      )}
      <Animated.View style={bodyStyle}>
        <Svg viewBox="0 0 200 220" width={size} height={size * 1.1}>
          {backpack && <Accessory id="backpack" />}

          <AnimatedG origin="155,168" animatedProps={tailAnimatedProps}>
            <Path d="M 155 168 Q 188 162 192 132 Q 194 116 180 114" stroke={color} strokeWidth={14} strokeLinecap="round" fill="none" />
          </AnimatedG>

          <Ellipse cx={78} cy={186} rx={15} ry={9} fill={color} />
          <Ellipse cx={122} cy={186} rx={15} ry={9} fill={color} />

          <Ellipse cx={100} cy={126} rx={60} ry={64} fill={color} />
          <Ears species={species} color={color} />

          <AnimatedEllipse cx={80} cy={116} rx={9} animatedProps={eyeAnimatedProps} fill="#2B2B2B" />
          <AnimatedEllipse cx={120} cy={116} rx={9} animatedProps={eyeAnimatedProps} fill="#2B2B2B" />
          <Circle cx={83} cy={112} r={2.5} fill="#FFFFFF" />
          <Circle cx={123} cy={112} r={2.5} fill="#FFFFFF" />

          <Ellipse cx={100} cy={134} rx={5} ry={4} fill="#3A2A2A" />
          <Path d="M 90 146 Q 100 153 110 146" stroke="#3A2A2A" strokeWidth={3} strokeLinecap="round" fill="none" />

          {otherAccessories.map((id) => (
            <Accessory key={id} id={id} />
          ))}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
