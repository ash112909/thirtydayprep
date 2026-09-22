import Svg, { Path } from "react-native-svg";

interface IconProps {
  size: number;
  color: string;
}

// Small inline stroke/fill icons used in place of emoji for UI chrome
// (streak, points, celebration) — emoji reads as a default/AI-generated
// look, these read as designed.
export function FlameIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2c1 3-2 4-2 7a4 4 0 1 0 8 0c0-1-.5-2-1-2 .5 2-1 3-2 3-1.5 0-2-1.5-1-3-2 .5-4 2-4 5a6 6 0 1 0 12 0c0-5-4-7-10-10Z" />
    </Svg>
  );
}

export function StarIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8L5.7 21l1.7-7L2 9.2l7.1-.6L12 2Z" />
    </Svg>
  );
}

export function SparkleIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2c.6 3.6 2 5.4 5.6 6-3.6.6-5 2.4-5.6 6-.6-3.6-2-5.4-5.6-6 3.6-.6 5-2.4 5.6-6ZM19 14c.3 1.8 1 2.6 2.8 3-1.8.4-2.5 1.2-2.8 3-.3-1.8-1-2.6-2.8-3 1.8-.4 2.5-1.2 2.8-3Z" />
    </Svg>
  );
}

export function TrophyIcon({ size, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <Path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <Path d="M12 12v3M9 19h6M10 19v-3.5M14 19v-3.5" />
    </Svg>
  );
}
