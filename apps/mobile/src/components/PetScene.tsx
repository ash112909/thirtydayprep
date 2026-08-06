import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { SHOP_ITEMS } from "@/lib/petShop";
import type { PetSpecies } from "@/types/domain";

interface Props {
  species: PetSpecies;
  ownedItems: string[]; // toys + in-stock food ids, placed as props beside the house
  width: number;
  height: number;
  children: ReactNode;
}

const ITEM_ICON: Record<string, string> = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item.icon]));

// Fixed ground-line slots (not random per-render) so owned items read as
// props actually set down beside the house, not floating decoration.
const ITEM_SLOTS: { left: `${number}%`; bottom: `${number}%` }[] = [
  { left: "6%", bottom: "9%" },
  { left: "17%", bottom: "6%" },
  { left: "5%", bottom: "19%" },
  { left: "27%", bottom: "12%" },
  { left: "14%", bottom: "15%" },
];

function isNightNow() {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 19;
}

export function PetScene({ species, ownedItems, width, height, children }: Props) {
  const night = isNightNow();
  const skyTop = night ? "#0B1224" : "#7DD3FC";
  const skyBottom = night ? "#1E1B4B" : "#BAE6FD";
  const grassTop = night ? "#1F3B2C" : "#3F7D52";
  const grassBottom = night ? "#142A1E" : "#2F5F3E";

  const groundY = height * 0.78;
  const houseW = width * 0.36;
  const houseH = height * 0.32;
  const houseX = width * 0.74;
  const houseBaseY = groundY + 4;

  return (
    <View style={{ width, height, borderRadius: 24, overflow: "hidden" }}>
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
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.6} width={houseW} height={houseH * 0.6} rx={4} fill="#92400E" />
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.28} width={houseW} height={2} fill="#78350F" opacity={0.6} />
            <Polygon
              points={`${houseX - houseW / 2 - 8},${houseBaseY - houseH * 0.6} ${houseX + houseW / 2 + 8},${houseBaseY - houseH * 0.6} ${houseX},${houseBaseY - houseH}`}
              fill="#B45309"
            />
            <Path
              d={`M ${houseX - houseW * 0.15} ${houseBaseY} L ${houseX - houseW * 0.15} ${houseBaseY - houseH * 0.34} A ${houseW * 0.15} ${houseW * 0.15} 0 0 1 ${houseX + houseW * 0.15} ${houseBaseY - houseH * 0.34} L ${houseX + houseW * 0.15} ${houseBaseY} Z`}
              fill="#1E1408"
            />
          </>
        ) : (
          <>
            <Rect x={houseX - houseW / 2} y={houseBaseY - houseH * 0.56} width={houseW} height={houseH * 0.56} rx={12} fill="#7C3AED" />
            <Polygon
              points={`${houseX - houseW / 2 - 6},${houseBaseY - houseH * 0.56} ${houseX + houseW / 2 + 6},${houseBaseY - houseH * 0.56} ${houseX + houseW / 2 + 6},${houseBaseY - houseH * 0.56 - houseH * 0.15} ${houseX - houseW / 2 - 6},${houseBaseY - houseH * 0.56 - houseH * 0.15}`}
              fill="#5B21B6"
            />
            <Circle cx={houseX} cy={houseBaseY - houseH * 0.3} r={houseW * 0.14} fill="#1E1233" />
            <Circle cx={houseX} cy={houseBaseY - houseH * 0.3} r={houseW * 0.14} fill="none" stroke="#5B21B6" strokeWidth={3} />
            <Circle cx={houseX + houseW * 0.34} cy={houseBaseY - houseH * 0.62} r={4} fill="#5B21B6" />
            <Circle cx={houseX + houseW * 0.34} cy={houseBaseY - houseH * 0.75} r={5} fill="#7C3AED" />
          </>
        )}
      </Svg>

      {ownedItems.slice(0, ITEM_SLOTS.length).map((itemId, i) => (
        <View key={itemId} style={{ position: "absolute", alignItems: "center", ...ITEM_SLOTS[i] }}>
          <Text style={{ fontSize: 18 }}>{ITEM_ICON[itemId] ?? "🧸"}</Text>
          <View style={{ width: 14, height: 4, borderRadius: 4, backgroundColor: "#00000030" }} />
        </View>
      ))}

      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 12 }}>{children}</View>
    </View>
  );
}
