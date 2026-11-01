// src/components/Hourglass.js
// An hourglass that actually runs: the sand drains from the top bulb into the
// bottom one while a thin stream falls through the neck, then the glass turns
// over and starts again. Drawn with SVG and driven by Reanimated.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Line, Defs, ClipPath, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const TOP = 12;
const NECK = 96;
const BOTTOM = 180;
const SPAN = NECK - TOP;           // how far the sand level can travel
const DRAIN_MS = 40000;            // one full drain
const FLIP_MS = 800;

const GLASS =
  'M 22 12 H 98 C 98 56, 68 82, 64 96 C 68 110, 98 136, 98 180 H 22 ' +
  'C 22 136, 52 110, 56 96 C 52 82, 22 56, 22 12 Z';

export default function Hourglass({ width = 150, sand = '#E8C170', glass = '#FFFFFF' }) {
  const frac = useSharedValue(0);
  const rot = useSharedValue(0);
  const dash = useSharedValue(0);

  useEffect(() => {
    frac.value = 0;
    rot.value = 0;
    frac.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DRAIN_MS, easing: Easing.linear }),
        withTiming(1, { duration: FLIP_MS }),     // hold while the glass turns
        withTiming(0, { duration: 0 }),           // a turned glass looks like a full one
      ),
      -1,
    );
    rot.value = withRepeat(
      withSequence(
        withDelay(DRAIN_MS, withTiming(180, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    dash.value = withRepeat(withTiming(-14, { duration: 520, easing: Easing.linear }), -1);
  }, [frac, rot, dash]);

  const topSand = useAnimatedProps(() => {
    const y = TOP + frac.value * SPAN;
    return { y, height: Math.max(0, NECK - y) };
  });
  const bottomSand = useAnimatedProps(() => {
    const h = frac.value * (BOTTOM - NECK - 6);
    return { y: BOTTOM - h, height: h };
  });
  const stream = useAnimatedProps(() => {
    const h = frac.value * (BOTTOM - NECK - 6);
    const active = frac.value > 0.002 && frac.value < 0.998;
    return {
      y2: BOTTOM - h,
      strokeDashoffset: dash.value,
      opacity: active ? 1 : 0,
    };
  });

  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const height = (width * 192) / 120;

  return (
    <Animated.View style={[{ width, height }, turn]}>
      <Svg width={width} height={height} viewBox="0 0 120 192">
        <Defs>
          <ClipPath id="glassClip">
            <Path d={GLASS} />
          </ClipPath>
        </Defs>

        <G clipPath="url(#glassClip)">
          <AnimatedRect x={0} width={120} fill={sand} animatedProps={topSand} />
          <AnimatedRect x={0} width={120} fill={sand} animatedProps={bottomSand} />
        </G>

        <AnimatedLine
          x1={60} y1={NECK} x2={60}
          stroke={sand} strokeWidth={2.2} strokeLinecap="round"
          strokeDasharray={[3, 4]}
          animatedProps={stream}
        />

        <Path d={GLASS} fill={glass} fillOpacity={0.06} stroke={glass} strokeOpacity={0.75} strokeWidth={2.2} strokeLinejoin="round" />
        <Rect x={14} y={4} width={92} height={9} rx={4.5} fill={glass} fillOpacity={0.85} />
        <Rect x={14} y={179} width={92} height={9} rx={4.5} fill={glass} fillOpacity={0.85} />
      </Svg>
    </Animated.View>
  );
}
