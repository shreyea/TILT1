// src/screens/IntroScreen.js
// Opening titles. The wordmark assembles letter by letter over a slow gold
// bloom, a hairline draws underneath, then the whole thing lifts away — so the
// first thing the app does is feel composed rather than just "load".
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

const HOLD_MS = 2050;

function Letter({ text, progress, accent, s }) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 22 },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }));

  return (
    <Animated.Text style={[s.letter, accent && s.accent, style]}>
      {text}
    </Animated.Text>
  );
}

// Concentric discs approximate a radial falloff — a single circle reads as
// a hard edge against the dark ground.
const BLOOM_LAYERS = Array.from({ length: 7 }, (_, i) => {
  const t = i / 6;
  return { scale: 2.1 - t * 1.5, opacity: 0.012 + t * 0.022 };
});

function BloomLayer({ glow, base, layer, s }) {
  const style = useAnimatedStyle(() => {
    const size = base * layer.scale;
    return {
      width: size, height: size, borderRadius: size / 2,
      opacity: layer.opacity * (0.55 + glow.value * 0.45),
      transform: [{ scale: 0.94 + glow.value * 0.12 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[s.glow, style]} />;
}

function Bloom({ glow, base, s }) {
  return BLOOM_LAYERS.map((layer, i) => (
    <BloomLayer key={i} glow={glow} base={base} layer={layer} s={s} />
  ));
}

export default function IntroScreen({ onComplete }) {
  const { COLORS } = useTheme();
  const s = React.useMemo(() => createStyles(COLORS), [COLORS]);
  const { width: W, height: H } = useWindowDimensions();

  const t1 = useSharedValue(0);
  const slash = useSharedValue(0);
  const l = useSharedValue(0);
  const t2 = useSharedValue(0);
  const rule = useSharedValue(0);
  const glow = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.bezier(0.16, 1, 0.3, 1);

    // Letters land in sequence; the slash arrives last and brightest.
    t1.value = withDelay(120, withTiming(1, { duration: 520, easing: ease }));
    l.value = withDelay(260, withTiming(1, { duration: 520, easing: ease }));
    t2.value = withDelay(400, withTiming(1, { duration: 520, easing: ease }));
    slash.value = withDelay(620, withTiming(1, { duration: 620, easing: ease }));

    rule.value = withDelay(880, withTiming(1, { duration: 760, easing: ease }));

    glow.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    exit.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.06 }],
  }));

  const bloomBase = Math.min(W, H) * 0.42;

  const ruleStyle = useAnimatedStyle(() => ({
    width: rule.value * Math.min(W * 0.46, 210),
    opacity: rule.value * 0.65,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: rule.value * 0.75,
    transform: [{ translateY: (1 - rule.value) * 8 }],
  }));

  return (
    <Animated.View style={[s.container, containerStyle]}>
      <Bloom glow={glow} base={bloomBase} s={s} />

      <View style={s.row}>
        <Letter text="T" progress={t1} s={s} />
        <Letter text={"\\"} progress={slash} accent s={s} />
        <Letter text="L" progress={l} s={s} />
        <Letter text="T" progress={t2} s={s} />
      </View>

      <Animated.View style={[s.rule, ruleStyle]} />
      <Animated.Text style={[s.tagline, taglineStyle]}>MUSIC, UNINTERRUPTED</Animated.Text>
    </Animated.View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  glow: { position: 'absolute', backgroundColor: COLORS.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  letter: {
    color: COLORS.textPrimary,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: 2,
  },
  accent: { color: COLORS.primary },
  rule: {
    height: 1,
    backgroundColor: COLORS.primary,
    marginTop: 26,
  },
  tagline: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 4,
    marginTop: 16,
    fontWeight: '600',
  },
});
