import { Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { MasterySnapshot, Subcategory } from "@/types/domain";

interface Props {
  subcategories: Subcategory[];
  mastery: MasterySnapshot;
}

const SHORT_LABELS: Record<string, string> = {
  "information-and-ideas": "Info & Ideas",
  "craft-and-structure": "Craft",
  "expression-of-ideas": "Expression",
  "standard-english-conventions": "Conventions",
  algebra: "Algebra",
  "advanced-math": "Adv. Math",
  "problem-solving-data-analysis": "Data Analysis",
  "geometry-trigonometry": "Geometry",
};

const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_RADIUS = 88;
const LABEL_RADIUS = MAX_RADIUS + 30;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointAt(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

function polygonPoints(count: number, radiusFor: (index: number) => number): string {
  return Array.from({ length: count }, (_, i) => {
    const { x, y } = pointAt(i, count, radiusFor(i));
    return `${x},${y}`;
  }).join(" ");
}

function anchorFor(x: number): "start" | "middle" | "end" {
  if (x < CENTER - 4) return "end";
  if (x > CENTER + 4) return "start";
  return "middle";
}

// A spider/radar chart across all 8 SAT subcategories, so mastery reads as
// one shape at a glance instead of eight separate bar rows.
export function SkillRadarChart({ subcategories, mastery }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    empty: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  }));

  if (!subcategories.length) {
    return <Text style={styles.empty}>Nothing to chart yet.</Text>;
  }

  const count = subcategories.length;
  const values = subcategories.map((sc) => Math.max(0, Math.min(100, Math.round(mastery[sc.id] ?? 0))));

  return (
    <View>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {RINGS.map((ring) => (
          <Polygon
            key={ring}
            points={polygonPoints(count, () => MAX_RADIUS * ring)}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {subcategories.map((_, i) => {
          const { x, y } = pointAt(i, count, MAX_RADIUS);
          return <Line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        <Polygon
          points={polygonPoints(count, (i) => (values[i] / 100) * MAX_RADIUS)}
          fill={colors.primary}
          fillOpacity={0.35}
          stroke={colors.primary}
          strokeWidth={2}
        />
        {values.map((v, i) => {
          const { x, y } = pointAt(i, count, (v / 100) * MAX_RADIUS);
          return <Circle key={i} cx={x} cy={y} r={3} fill={colors.primary} />;
        })}
        {subcategories.map((sc, i) => {
          const { x, y } = pointAt(i, count, LABEL_RADIUS);
          return (
            <SvgText
              key={sc.id}
              x={x}
              y={y}
              fill={colors.textMuted}
              fontSize={10}
              fontWeight="600"
              textAnchor={anchorFor(x)}
            >
              {SHORT_LABELS[sc.slug] ?? sc.name}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
