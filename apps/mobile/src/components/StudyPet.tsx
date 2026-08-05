import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
const ENERGY_EAR_ANGLE: Record<Energy, number> = { sleepy: -12, calm: 2, energetic: 10 };

const REACTION_CONFIG: Record<PetAction, { emoji: string; durationMs: number }> = {
  petting: { emoji: "💕", durationMs: 900 },
  eating: { emoji: "😋", durationMs: 1200 },
  playing: { emoji: "✨", durationMs: 1300 },
};

const TAIL_BASE = { cat: "168,168", dog: "168,163" };
const TAIL_PATH = {
  cat: "M 168 168 Q 210 155 214 100 Q 216 78 200 66",
  dog: "M 168 163 Q 195 148 192 116 Q 190 100 175 96",
};

function Accessory({ id }: { id: string }) {
  switch (id) {
    case "bandana":
      return <Path d="M 82 128 L 138 128 L 110 152 Z" fill="#E85D5D" />;
    case "sunglasses":
      return (
        <G>
          <Rect x={70} y={68} width={30} height={17} rx={7} fill="#1A1A1A" />
          <Rect x={120} y={68} width={30} height={17} rx={7} fill="#1A1A1A" />
          <Rect x={98} y={73} width={24} height={4} fill="#1A1A1A" />
        </G>
      );
    case "bowtie":
      return (
        <G>
          <Path d="M 100 132 L 110 139 L 100 146 Z" fill="#5B7FE8" />
          <Path d="M 120 132 L 110 139 L 120 146 Z" fill="#5B7FE8" />
          <Circle cx={110} cy={139} r={3} fill="#3A56B0" />
        </G>
      );
    case "backpack":
      return (
        <G>
          <Rect x={44} y={140} width={17} height={42} rx={8} fill="#9B6B3E" />
          <Rect x={159} y={140} width={17} height={42} rx={8} fill="#9B6B3E" />
        </G>
      );
    case "gradcap":
      return (
        <G>
          <Rect x={78} y={30} width={64} height={8} fill="#1F2937" />
          <Rect x={100} y={38} width={20} height={10} rx={2} fill="#1F2937" />
          <Path d="M 142 34 L 154 47" stroke="#FBBF24" strokeWidth={2} />
          <Circle cx={154} cy={49} r={3} fill="#FBBF24" />
        </G>
      );
    case "scarf":
      return <Path d="M 80 126 Q 110 144 140 126 L 140 140 Q 110 156 80 140 Z" fill="#E8A34D" />;
    case "medal":
      return (
        <G>
          <Path d="M 100 118 L 106 132" stroke="#D64545" strokeWidth={3} />
          <Path d="M 120 118 L 114 132" stroke="#D64545" strokeWidth={3} />
          <Circle cx={110} cy={138} r={10} fill="#FFD700" stroke="#B8860B" strokeWidth={1.5} />
        </G>
      );
    case "explorerhat":
      return (
        <G>
          <Ellipse cx={110} cy={44} rx={58} ry={12} fill="#C2A46B" />
          <Ellipse cx={110} cy={30} rx={28} ry={18} fill="#C2A46B" />
          <Rect x={88} y={36} width={44} height={6} fill="#8B6F3E" />
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
  const earAngle = useSharedValue(2);
  const whiskerAngle = useSharedValue(0);
  const legBobL = useSharedValue(0);
  const legBobR = useSharedValue(0);
  const tapBounce = useSharedValue(0);
  const reactionBounce = useSharedValue(0);
  const reactionRotate = useSharedValue(0);
  const reactionDip = useSharedValue(0);
  const emojiOpacity = useSharedValue(0);
  const emojiFloat = useSharedValue(0);
  const zFloat = useSharedValue(0);
  const restEyeOpenRef = useRef(1);
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  // Idle motion — breathing, tail wag, ear rest angle, blink rest state, and
  // an alternating leg weight-shift. Skipped while a one-shot reaction is
  // playing, and re-armed automatically once that reaction clears.
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

    const swing = ENERGY_TAIL_SWING[energy];
    tailAngle.value = withRepeat(
      withSequence(
        withTiming(swing, { duration: speed * 0.6, easing: Easing.inOut(Easing.quad) }),
        withTiming(-swing, { duration: speed * 0.6, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    const eyeTarget = energy === "sleepy" ? 0.4 : 1;
    restEyeOpenRef.current = eyeTarget;
    eyeSquish.value = withTiming(eyeTarget, { duration: 400 });

    earAngle.value = withTiming(ENERGY_EAR_ANGLE[energy], { duration: 500 });

    const legSpeed = speed * 1.4;
    legBobL.value = withRepeat(withSequence(withTiming(1, { duration: legSpeed }), withTiming(0, { duration: legSpeed })), -1, true);
    legBobR.value = withDelay(
      legSpeed,
      withRepeat(withSequence(withTiming(1, { duration: legSpeed }), withTiming(0, { duration: legSpeed })), -1, true),
    );

    zFloat.value =
      energy === "sleepy"
        ? withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1)
        : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [energy, activeAction]);

  useEffect(() => {
    const blink = setInterval(() => {
      eyeSquish.value = withSequence(withTiming(0.1, { duration: 90 }), withTiming(restEyeOpenRef.current, { duration: 130 }));
    }, 2800);
    const earTwitch = setInterval(() => {
      earAngle.value = withSequence(withTiming(earAngle.value + 6, { duration: 150 }), withTiming(earAngle.value, { duration: 200 }));
    }, 4200);
    whiskerAngle.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      clearInterval(blink);
      clearInterval(earTwitch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeAction) return;
    const config = REACTION_CONFIG[activeAction];
    setActiveEmoji(config.emoji);

    if (activeAction === "eating") {
      reactionDip.value = withRepeat(withSequence(withTiming(8, { duration: 150 }), withTiming(0, { duration: 150 })), 3, false);
    } else if (activeAction === "playing") {
      reactionBounce.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.3, { duration: 200 }), withTiming(1, { duration: 200 }), withTiming(0, { duration: 300 }));
      reactionRotate.value = withSequence(withTiming(10, { duration: 150 }), withTiming(-10, { duration: 150 }), withTiming(10, { duration: 150 }), withTiming(0, { duration: 150 }));
      legBobL.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0.2, { duration: 150 }), withTiming(1, { duration: 150 }), withTiming(0, { duration: 200 }));
      legBobR.value = withSequence(withTiming(0.2, { duration: 150 }), withTiming(1, { duration: 150 }), withTiming(0.2, { duration: 150 }), withTiming(0, { duration: 200 }));
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
    const breatheScale = 1 + breathe.value * 0.03;
    const bounceScale = 1 + tapBounce.value * 0.15 + reactionBounce.value * 0.12;
    return {
      transform: [
        { scale: GROWTH_SCALE[growthStage] * bounceScale },
        { scaleY: breatheScale },
        { translateY: reactionDip.value },
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
  const eyeBaseRy = species === "cat" ? 11 : 9;
  const eyeAnimatedProps = useAnimatedProps(() => ({ ry: eyeBaseRy * eyeSquish.value }));
  const earLeftAnimatedProps = useAnimatedProps(() => ({ rotation: earAngle.value }));
  const earRightAnimatedProps = useAnimatedProps(() => ({ rotation: -earAngle.value }));
  const whiskerLeftAnimatedProps = useAnimatedProps(() => ({ rotation: whiskerAngle.value }));
  const whiskerRightAnimatedProps = useAnimatedProps(() => ({ rotation: -whiskerAngle.value }));
  const legLAnimatedProps = useAnimatedProps(() => ({ cy: 220 - legBobL.value * 5 }));
  const legRAnimatedProps = useAnimatedProps(() => ({ cy: 220 - legBobR.value * 5 }));

  function handlePress() {
    tapBounce.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 260 }));
  }

  const showTongue = species === "dog" && (energy === "energetic" || activeAction === "playing");
  const backpack = equippedAccessories.includes("backpack");
  const otherAccessories = equippedAccessories.filter((id) => id !== "backpack");

  return (
    <Pressable onPress={handlePress} style={{ width: size, alignItems: "center" }}>
      {energy === "sleepy" && !activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 6, right: size * 0.18, zIndex: 1 }, zStyle]}>
          <Text style={{ fontSize: 20 }}>💤</Text>
        </Animated.View>
      )}
      {activeEmoji && (
        <Animated.View style={[{ position: "absolute", top: 6, zIndex: 1 }, emojiStyle]}>
          <Text style={{ fontSize: 28 }}>{activeEmoji}</Text>
        </Animated.View>
      )}
      <Animated.View style={bodyStyle}>
        <Svg viewBox="0 0 220 240" width={size} height={size * (240 / 220)}>
          {backpack && <Accessory id="backpack" />}

          {/* tail, anchored behind the torso */}
          <AnimatedG origin={TAIL_BASE[species]} animatedProps={tailAnimatedProps}>
            <Path
              d={TAIL_PATH[species]}
              stroke={color}
              strokeWidth={species === "cat" ? 11 : 15}
              strokeLinecap="round"
              fill="none"
            />
          </AnimatedG>

          {/* hind haunches, peeking out behind the torso */}
          <Ellipse cx={62} cy={178} rx={19} ry={27} fill={color} />
          <Ellipse cx={158} cy={178} rx={19} ry={27} fill={color} />

          {/* torso */}
          <Ellipse cx={110} cy={155} rx={53} ry={49} fill={color} />

          {/* front legs + paws (paws animate up/down) */}
          <Rect x={81} y={176} width={19} height={40} rx={9.5} fill={color} />
          <Rect x={120} y={176} width={19} height={40} rx={9.5} fill={color} />
          <AnimatedEllipse cx={90} cy={220} rx={13} ry={9} animatedProps={legLAnimatedProps} fill={color} />
          <AnimatedEllipse cx={130} cy={220} rx={13} ry={9} animatedProps={legRAnimatedProps} fill={color} />

          {/* head */}
          <Ellipse cx={110} cy={85} rx={45} ry={41} fill={color} />

          {/* ears */}
          {species === "cat" ? (
            <>
              <AnimatedG origin="78,58" animatedProps={earLeftAnimatedProps}>
                <Path d="M 78 58 L 60 12 L 100 55 Z" fill={color} />
                <Path d="M 78 52 L 68 24 L 92 50 Z" fill="#E8A0A0" opacity={0.75} />
              </AnimatedG>
              <AnimatedG origin="142,58" animatedProps={earRightAnimatedProps}>
                <Path d="M 142 58 L 160 12 L 120 55 Z" fill={color} />
                <Path d="M 142 52 L 152 24 L 128 50 Z" fill="#E8A0A0" opacity={0.75} />
              </AnimatedG>
            </>
          ) : (
            <>
              <AnimatedG origin="70,68" animatedProps={earLeftAnimatedProps}>
                <Ellipse cx={62} cy={94} rx={18} ry={33} fill={color} />
              </AnimatedG>
              <AnimatedG origin="150,68" animatedProps={earRightAnimatedProps}>
                <Ellipse cx={158} cy={94} rx={18} ry={33} fill={color} />
              </AnimatedG>
            </>
          )}

          {/* muzzle */}
          <Ellipse cx={110} cy={101} rx={species === "cat" ? 19 : 23} ry={species === "cat" ? 13 : 16} fill={color} />

          {/* whiskers (cat only) */}
          {species === "cat" && (
            <>
              <AnimatedG origin="92,100" animatedProps={whiskerLeftAnimatedProps}>
                <Path d="M 90 95 Q 62 87 50 85" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
                <Path d="M 90 100 Q 60 100 48 101" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
                <Path d="M 90 105 Q 62 111 50 115" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
              </AnimatedG>
              <AnimatedG origin="128,100" animatedProps={whiskerRightAnimatedProps}>
                <Path d="M 130 95 Q 158 87 170 85" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
                <Path d="M 130 100 Q 160 100 172 101" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
                <Path d="M 130 105 Q 158 111 170 115" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />
              </AnimatedG>
            </>
          )}

          {/* eyes */}
          <AnimatedEllipse cx={88} cy={78} rx={species === "cat" ? 7 : 8.5} animatedProps={eyeAnimatedProps} fill="#2B2B2B" />
          <AnimatedEllipse cx={132} cy={78} rx={species === "cat" ? 7 : 8.5} animatedProps={eyeAnimatedProps} fill="#2B2B2B" />
          <Circle cx={91} cy={73} r={2.5} fill="#FFFFFF" />
          <Circle cx={135} cy={73} r={2.5} fill="#FFFFFF" />

          {/* nose */}
          {species === "cat" ? (
            <Path d="M 104 92 L 116 92 L 110 98 Z" fill="#E8A0A0" />
          ) : (
            <Ellipse cx={110} cy={93} rx={6} ry={4.5} fill="#2B2320" />
          )}

          {/* mouth (+ tongue for an energetic/playing dog) */}
          {species === "cat" ? (
            <Path d="M 98 108 Q 104 114 110 108 Q 116 114 122 108" stroke="#2B2320" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          ) : (
            <>
              <Path d="M 94 110 Q 110 122 126 110" stroke="#2B2320" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              {showTongue && <Path d="M 104 116 Q 110 130 116 116 Z" fill="#E8767A" />}
            </>
          )}

          {otherAccessories.map((id) => (
            <Accessory key={id} id={id} />
          ))}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
