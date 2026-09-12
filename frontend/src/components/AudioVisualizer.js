// src/components/AudioVisualizer.js
// Audio-reactive spectrum, drawn straight onto the screen — no card, no
// border. Reads real PCM frames from expo-audio's sampling API and splits the
// buffer into bands, so the shape follows the music rather than looping a
// canned animation. Each bar is tinted across a teal→gold ramp by position,
// and brightens as it peaks.
import React, { useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useAudioSampleListener, requestRecordingPermissionsAsync, getRecordingPermissionsAsync } from 'expo-audio';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';

const BAR_COUNT = 36;
const GAIN = 3.6;

let permissionRequested = false;

// Sampling sits behind RECORD_AUDIO on Android even though we only read
// playback, never the mic.
function useSamplingPermissionOnce(enabled) {
  useEffect(() => {
    if (!enabled || permissionRequested) return;
    permissionRequested = true;
    (async () => {
      try {
        const current = await getRecordingPermissionsAsync();
        if (!current?.granted) await requestRecordingPermissionsAsync();
      } catch (e) {
        // Visualizer just stays in its idle state.
      }
    })();
  }, [enabled]);
}

// Blend teal -> gold across the spectrum so low and high bands read differently.
function bandColor(t, COLORS) {
  const from = [127, 179, 174];  // secondary
  const to = [232, 190, 90];     // primary
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function Bar({ index, levels, color, maxHeight }) {
  const style = useAnimatedStyle(() => {
    const v = levels.value[index] ?? 0.04;
    return {
      height: withTiming(4 + v * maxHeight, { duration: 95 }),
      opacity: 0.35 + v * 0.65,
    };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function LiveBars({ player, colors, maxHeight }) {
  const levels = useSharedValue(new Array(BAR_COUNT).fill(0.04));

  const handleSample = useCallback((sample) => {
    const frames = sample?.channels?.[0]?.frames;
    if (!frames || frames.length === 0) return;

    const bucket = Math.max(1, Math.floor(frames.length / BAR_COUNT));
    const next = new Array(BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) {
      const start = i * bucket;
      const end = i === BAR_COUNT - 1 ? frames.length : Math.min(frames.length, start + bucket);
      let sum = 0;
      for (let j = start; j < end; j++) sum += frames[j] * frames[j];
      const rms = Math.sqrt(sum / Math.max(1, end - start));
      next[i] = Math.min(1, rms * GAIN);
    }
    levels.value = next;
  }, [levels]);

  useAudioSampleListener(player, handleSample);

  return (
    <View style={styles.row}>
      {colors.map((color, i) => (
        <Bar key={i} index={i} levels={levels} color={color} maxHeight={maxHeight} />
      ))}
    </View>
  );
}

function IdleBars({ colors, maxHeight }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);

  return (
    <View style={styles.row}>
      {colors.map((color, i) => (
        <IdleBar key={i} t={t} phase={i / colors.length} color={color} maxHeight={maxHeight} />
      ))}
    </View>
  );
}

function IdleBar({ t, phase, color, maxHeight }) {
  const style = useAnimatedStyle(() => {
    const wave = 0.30 + 0.22 * Math.sin((t.value + phase) * Math.PI * 2);
    return { height: 4 + wave * maxHeight, opacity: 0.45 };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export default function AudioVisualizer({ active, size }) {
  const { player, playbackMode, isPlaying } = usePlayer();
  const { COLORS } = useTheme();

  const canSample = !!(active && playbackMode === 'native' && player?.isAudioSamplingSupported);
  useSamplingPermissionOnce(canSample);

  const colors = useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, i) => bandColor(i / (BAR_COUNT - 1), COLORS)),
    [COLORS]
  );

  if (!active) return null;

  const maxHeight = Math.max(110, (size || 240) * 0.62);

  return (
    <View style={[styles.container, { height: size }]}>
      {canSample && isPlaying
        ? <LiveBars player={player} colors={colors} maxHeight={maxHeight} />
        : <IdleBars colors={colors} maxHeight={maxHeight} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  bar: { width: 4, borderRadius: 2 },
});
