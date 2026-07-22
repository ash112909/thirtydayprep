import { useMemo, useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import { evaluateExpression } from "@/lib/expressionEvaluator";
import { colors } from "@/theme";

interface Props {
  expression: string;
  angleMode: "deg" | "rad";
  xRange: [number, number];
  onXRangeChange: (range: [number, number]) => void;
  width: number;
  height: number;
}

const SAMPLES = 140;

function niceNumber(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

function computeTicks(min: number, max: number, targetCount = 5): number[] {
  const step = niceNumber(niceNumber(max - min, false) / Math.max(targetCount - 1, 1), true);
  const niceMin = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= max + step / 2; v += step) {
    if (v >= min - step / 2 && v <= max + step / 2) ticks.push(Math.round(v * 1e9) / 1e9);
  }
  return ticks;
}

export function GraphCanvas({ expression, angleMode, xRange, onXRangeChange, width, height }: Props) {
  const panStartRange = useRef<[number, number]>(xRange);

  const [xMin, xMax] = xRange;

  const { points, yMin, yMax, error } = useMemo(() => {
    const sampled: (number | null)[] = [];
    let hasValue = false;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = xMin + ((xMax - xMin) * i) / SAMPLES;
      try {
        const y = evaluateExpression(expression, { x }, angleMode);
        sampled.push(y);
        hasValue = true;
      } catch {
        sampled.push(null);
      }
    }
    if (!hasValue) {
      return { points: [] as (number | null)[], yMin: -10, yMax: 10, error: "Couldn't evaluate this function" };
    }
    const finiteValues = sampled.filter((v): v is number => v != null && Number.isFinite(v));
    if (!finiteValues.length) {
      return { points: sampled, yMin: -10, yMax: 10, error: "No finite values in this view" };
    }
    let lo = Math.min(...finiteValues);
    let hi = Math.max(...finiteValues);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.1;
    return { points: sampled, yMin: lo - pad, yMax: hi + pad, error: null };
  }, [expression, angleMode, xMin, xMax]);

  const toPx = (x: number, y: number): [number, number] => {
    const px = ((x - xMin) / (xMax - xMin)) * width;
    const py = height - ((y - yMin) / (yMax - yMin)) * height;
    return [px, py];
  };

  const pathSegments = useMemo(() => {
    const segments: string[] = [];
    let current: string | null = null;
    const yRangeSize = yMax - yMin;
    let prevY: number | null = null;

    for (let i = 0; i < points.length; i++) {
      const y = points[i];
      const jump = prevY != null && y != null && Math.abs(y - prevY) > yRangeSize * 3;
      if (y == null || jump) {
        if (current) segments.push(current);
        current = null;
        prevY = y;
        continue;
      }
      const x = xMin + ((xMax - xMin) * i) / SAMPLES;
      const [px, py] = toPx(x, y);
      current = current ? `${current} L ${px} ${py}` : `M ${px} ${py}`;
      prevY = y;
    }
    if (current) segments.push(current);
    return segments;
  }, [points, xMin, xMax, yMin, yMax, width, height]);

  const xTicks = computeTicks(xMin, xMax);
  const yTicks = computeTicks(yMin, yMax);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartRange.current = [xMin, xMax];
      },
      onPanResponderMove: (_evt, gesture) => {
        const [startMin, startMax] = panStartRange.current;
        const domainWidth = startMax - startMin;
        const deltaX = -(gesture.dx / width) * domainWidth;
        onXRangeChange([startMin + deltaX, startMax + deltaX]);
      },
    }),
  ).current;

  return (
    <View style={{ width, height }} {...panResponder.panHandlers}>
      <Svg width={width} height={height} style={styles.svg}>
        {xTicks.map((tick) => {
          const [px] = toPx(tick, 0);
          return (
            <Line
              key={`vx-${tick}`}
              x1={px}
              y1={0}
              x2={px}
              y2={height}
              stroke={colors.border}
              strokeWidth={tick === 0 ? 1.5 : 0.5}
            />
          );
        })}
        {yTicks.map((tick) => {
          const [, py] = toPx(0, tick);
          return (
            <Line
              key={`hy-${tick}`}
              x1={0}
              y1={py}
              x2={width}
              y2={py}
              stroke={colors.border}
              strokeWidth={tick === 0 ? 1.5 : 0.5}
            />
          );
        })}
        {xTicks
          .filter((t) => t !== 0)
          .map((tick) => {
            const [px] = toPx(tick, 0);
            const [, zeroY] = toPx(0, 0);
            const labelY = Math.min(Math.max(zeroY + 12, 12), height - 4);
            return (
              <SvgText key={`xl-${tick}`} x={px + 2} y={labelY} fontSize={9} fill={colors.textMuted}>
                {tick}
              </SvgText>
            );
          })}
        {pathSegments.map((d, i) => (
          <Path key={i} d={d} stroke={colors.primary} strokeWidth={2} fill="none" />
        ))}
      </Svg>
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { backgroundColor: "transparent" },
  errorOverlay: { position: "absolute", top: 8, left: 8 },
  errorText: { color: colors.danger, fontSize: 12 },
});
