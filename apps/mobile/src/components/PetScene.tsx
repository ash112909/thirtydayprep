import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { SHOP_ITEMS } from "@/lib/petShop";
import type { PetSpecies } from "@/types/domain";

interface Props {
  species: PetSpecies;
  ownedItems: string[]; // toys + in-stock food ids, placed as props beside the house
  isPlaying?: boolean; // sends the toy being played with over to the pet
  playingToyId?: string | null; // which owned toy id is the one in motion
  onToyPress?: (itemId: string) => void; // tap a toy directly to choose it
  width: number;
  height: number;
  children: ReactNode;
}

const ITEM_ICON: Record<string, string> = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item.icon]));
const ITEM_KIND: Record<string, string> = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item.kind]));

// Fixed ground-line slots (not random per-render) — kept in a tight cluster
// on the same grass band just in front of the pet, so items read as a toy
// pile actually sitting on the ground, not a scatter climbing the corner.
const ITEM_SLOTS: { left: number; bottom: number }[] = [
  { left: 10, bottom: 6 },
  { left: 19, bottom: 5 },
  { left: 27, bottom: 8 },
  { left: 14, bottom: 11 },
  { left: 22, bottom: 12 },
];

// Where a played toy travels to — roughly the pet's feet, so the toy visibly
// meets the pet instead of just bouncing in its own resting spot.
const PLAY_TARGET = { left: 42, bottom: 16 };

function isNightNow() {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 19;
}

function SceneProp({
  icon,
  size,
  leftPx,
  bottomPx,
  travel,
  onPress,
}: {
  icon: string;
  size: number;
  leftPx: number;
  bottomPx: number;
  travel: { dx: number; dy: number } | null; // set only for the toy currently being played with
  onPress?: () => void; // present only for tappable (toy) props
}) {
  const progress = useSharedValue(0);
  const invite = useSharedValue(0);

  // A slow breathing glow behind tappable toys — the only cue (besides a
  // hover cursor on web) that these are interactive at all, since nothing
  // else in the scene distinguishes a tappable prop from a static one.
  useEffect(() => {
    if (onPress) {
      invite.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      invite.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPress != null]);

  const inviteStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + invite.value * 0.22,
    transform: [{ scale: 1 + invite.value * 0.12 }],
  }));

  useEffect(() => {
    if (travel) {
      // Out (350ms) + two wiggle beats at the pet's feet (600ms) + back
      // (350ms) = 1300ms, matching StudyPet's playing-pose duration so the
      // toy's round trip lines up with the pet's own reaction animation.
      progress.value = withSequence(
        withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }),
        withRepeat(withSequence(withTiming(0.85, { duration: 150 }), withTiming(1, { duration: 150 })), 2, true),
        withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
      );
    } else {
      progress.value = withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travel != null]);

  const style = useAnimatedStyle(() => {
    const dx = travel?.dx ?? 0;
    const dy = travel?.dy ?? 0;
    return {
      transform: [
        { translateX: progress.value * dx },
        { translateY: progress.value * dy - Math.sin(progress.value * Math.PI) * 10 },
        { rotate: `${Math.sin(progress.value * Math.PI * 3) * 14}deg` },
        { scale: 1 + progress.value * 0.15 },
      ],
    };
  });

  const content = (
    <>
      <Animated.View style={style}>
        <Text style={{ fontSize: size }}>{icon}</Text>
      </Animated.View>
      <View style={{ width: size * 0.6, height: size * 0.15, borderRadius: size * 0.15, backgroundColor: "#00000030" }} />
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => [
          { position: "absolute", alignItems: "center", left: leftPx, bottom: bottomPx, cursor: "pointer" },
          pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
        ]}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -size * 0.05,
              width: size * 1.1,
              height: size * 1.1,
              borderRadius: size,
              backgroundColor: "rgba(56,189,248,0.35)",
            },
            inviteStyle,
          ]}
        />
        {content}
      </Pressable>
    );
  }

  return (
    <View style={{ position: "absolute", alignItems: "center", left: leftPx, bottom: bottomPx }}>{content}</View>
  );
}

export function PetScene({ species, ownedItems, isPlaying = false, playingToyId = null, onToyPress, width, height, children }: Props) {
  const night = isNightNow();
  const skyTop = night ? "#0B1224" : "#7DD3FC";
  const skyBottom = night ? "#1E1B4B" : "#BAE6FD";
  const grassTop = night ? "#1F3B2C" : "#3F7D52";
  const grassBottom = night ? "#142A1E" : "#2F5F3E";

  const groundY = height * 0.78;
  const houseW = width * 0.44;
  const houseH = height * 0.38;
  const houseX = width * 0.75;
  const houseBaseY = groundY + 4;

  // Scaled to the pet's own size (roughly half the scene height) so props
  // read as proportionate objects rather than tiny stickers next to it.
  const propSize = Math.round(height * 0.16);

  const targetLeftPx = (PLAY_TARGET.left / 100) * width;
  const targetBottomPx = (PLAY_TARGET.bottom / 100) * height;

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={skyTop} />
            <Stop offset="1" stopColor={skyBottom} />
          </LinearGradient>
          <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={grassTop} />
            <Stop offset="1" stopColor={grassBottom} />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={night ? "#E2E8F0" : "#FDE68A"} stopOpacity={0.5} />
            <Stop offset="1" stopColor={night ? "#E2E8F0" : "#FDE68A"} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />

        <Circle cx={width * 0.18} cy={height * 0.17} r={36} fill="url(#glow)" />
        {night ? (
          <>
            <Circle cx={width * 0.18} cy={height * 0.17} r={15} fill="#F1F5F9" />
            <Circle cx={width * 0.18 + 6} cy={height * 0.17 - 4} r={12.5} fill={skyTop} />
            <Circle cx={width * 0.44} cy={height * 0.1} r={1.4} fill="#F1F5F9" opacity={0.85} />
            <Circle cx={width * 0.58} cy={height * 0.2} r={1} fill="#F1F5F9" opacity={0.6} />
            <Circle cx={width * 0.33} cy={height * 0.26} r={1.2} fill="#F1F5F9" opacity={0.7} />
            <Circle cx={width * 0.65} cy={height * 0.08} r={1} fill="#F1F5F9" opacity={0.5} />
          </>
        ) : (
          <Circle cx={width * 0.18} cy={height * 0.17} r={16} fill="#FDE68A" />
        )}

        <Rect x={0} y={groundY} width={width} height={height - groundY} fill="url(#grass)" />
        <Ellipse cx={width * 0.5} cy={groundY} rx={width * 0.62} ry={9} fill={grassTop} opacity={0.5} />

        {species === "dog" ? (
          <>
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.6} width={houseW} height={houseH * 0.6} rx={5} fill="#92400E" />
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.28} width={houseW} height={2.5} fill="#78350F" opacity={0.6} />
            <Polygon
              points={`${houseX - houseW / 2 - 10},${houseBaseY - houseH * 0.6} ${houseX + houseW / 2 + 10},${houseBaseY - houseH * 0.6} ${houseX},${houseBaseY - houseH}`}
              fill="#B45309"
            />
            <Path
              d={`M ${houseX - houseW * 0.15} ${houseBaseY} L ${houseX - houseW * 0.15} ${houseBaseY - houseH * 0.34} A ${houseW * 0.15} ${houseW * 0.15} 0 0 1 ${houseX + houseW * 0.15} ${houseBaseY - houseH * 0.34} L ${houseX + houseW * 0.15} ${houseBaseY} Z`}
              fill="#1E1408"
            />
          </>
        ) : (
          <>
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.56} width={houseW} height={houseH * 0.56} rx={14} fill="#7C3AED" />
            <Polygon
              points={`${houseX - houseW / 2 - 8},${houseBaseY - houseH * 0.56} ${houseX + houseW / 2 + 8},${houseBaseY - houseH * 0.56} ${houseX + houseW / 2 + 8},${houseBaseY - houseH * 0.56 - houseH * 0.15} ${houseX - houseW / 2 - 8},${houseBaseY - houseH * 0.56 - houseH * 0.15}`}
              fill="#5B21B6"
            />
            <Circle cx={houseX} cy={houseBaseY - houseH * 0.3} r={houseW * 0.14} fill="#1E1233" />
            <Circle cx={houseX} cy={houseBaseY - houseH * 0.3} r={houseW * 0.14} fill="none" stroke="#5B21B6" strokeWidth={3} />
            <Circle cx={houseX + houseW * 0.34} cy={houseBaseY - houseH * 0.62} r={4.5} fill="#5B21B6" />
            <Circle cx={houseX + houseW * 0.34} cy={houseBaseY - houseH * 0.76} r={5.5} fill="#7C3AED" />
          </>
        )}
      </Svg>

      {ownedItems.slice(0, ITEM_SLOTS.length).map((itemId, i) => {
        const slot = ITEM_SLOTS[i];
        const leftPx = (slot.left / 100) * width;
        const bottomPx = (slot.bottom / 100) * height;
        const isToy = ITEM_KIND[itemId] === "toy";
        const isPlayedToy = isPlaying && itemId === playingToyId;
        return (
          <SceneProp
            key={itemId}
            icon={ITEM_ICON[itemId] ?? "🧸"}
            size={propSize}
            leftPx={leftPx}
            bottomPx={bottomPx}
            travel={isPlayedToy ? { dx: targetLeftPx - leftPx, dy: bottomPx - targetBottomPx } : null}
            onPress={isToy ? () => onToyPress?.(itemId) : undefined}
          />
        );
      })}

      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 12 }}>{children}</View>
    </View>
  );
}
