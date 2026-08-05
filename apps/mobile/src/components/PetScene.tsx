import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop, Circle, Ellipse } from "react-native-svg";
import { colors } from "@/theme";

interface Props {
  ownedToys: string[]; // toy item ids to scatter as decorations
  width: number;
  height: number;
  children: ReactNode;
}

const TOY_ICON: Record<string, string> = { ball: "🎾", yarn: "🧶", bone_toy: "🦴" };
const TOY_POSITIONS: { left?: `${number}%`; right?: `${number}%`; bottom: `${number}%` }[] = [
  { left: "10%", bottom: "8%" },
  { right: "10%", bottom: "6%" },
  { left: "18%", bottom: "16%" },
];

export function PetScene({ ownedToys, width, height, children }: Props) {
  return (
    <View style={{ width, height, borderRadius: 24, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.surfaceAlt} />
            <Stop offset="1" stopColor={colors.surface} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        <Circle cx={width * 0.82} cy={height * 0.16} r={18} fill={colors.primary} opacity={0.25} />
        <Ellipse cx={width * 0.5} cy={height} rx={width * 0.7} ry={height * 0.14} fill={colors.background} opacity={0.6} />
      </Svg>

      {ownedToys.slice(0, TOY_POSITIONS.length).map((toyId, i) => (
        <View key={toyId} style={{ position: "absolute", opacity: 0.85, ...TOY_POSITIONS[i] }}>
          <Text style={{ fontSize: 22 }}>{TOY_ICON[toyId] ?? "🧸"}</Text>
        </View>
      ))}

      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 12 }}>{children}</View>
    </View>
  );
}

export { TOY_ICON };
