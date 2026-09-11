// src/components/AudioVisualizer.js
// Real-time, audio-reactive bar visualizer for the Now Playing screen.
// Reads actual PCM frames from expo-audio's sampling API (not a fake/random
// animation) and buckets them into bars. Falls back to a slow ambient pulse
// when sampling isn't available — web, or the rare case where playback is
// running through the YouTube embed fallback (no sample access there).
import React, { useEffect, useCallback, useMemo } from 'react';
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

const BAR_COUNT = 28;
const GAIN = 3.2;
const BAR_MAX_HEIGHT = 84;
const BAR_MIN_HEIGHT = 6;

let permissionRequestInFlight = false;

// Sampling requires RECORD_AUDIO (Android) / mic usage description (iOS) at
// the OS level even though we're only reading playback audio, not the mic.
function useSamplingPermissionOnce(enabled) {
  useEffect(() => {
    if (!enabled || permissionRequestInFlight) return;
    permissionRequestInFlight = true;
    (async () => {
      try {
        const current = await getRecordingPermissionsAsync();
        if (!current?.granted) {
          await requestRecordingPermissionsAsync();
        }
      } catch (e) {
        // Sampling just won't light up — visualizer falls back to idle mode.
      }
    })();
  }, [enabled]);
}

function Bar({ index, levels, color }) {
  const style = useAnimatedStyle(() => {
    const v = levels.value[index] ?? 0.05;
    return {
      height: withTiming(BAR_MIN_HEIGHT + v * BAR_MAX_HEIGHT, { duration: 110 }),
      opacity: 0.4 + v * 0.6,
    };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function LiveBars({ player, color }) {
  const levels = useSharedValue(new Array(BAR_COUNT).fill(0.05));

  const handleSample = useCallback((sample) => {
    const frames = sample?.channels?.[0]?.frames;
    if (!frames || frames.length === 0) return;

    const bucketSize = Math.max(1, Math.floor(frames.length / BAR_COUNT));
    const next = new Array(BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) {
      const start = i * bucketSize;
      const end = i === BAR_COUNT - 1 ? frames.length : Math.min(frames.length, start + bucketSize);
      let sum = 0;
      for (let j = start; j < end; j++) sum += frames[j] * frames[j];
      const rms = Math.sqrt(sum / Math.max(1, end - start));
      next[i] = Math.min(1, rms * GAIN);
    }
    levels.value = next;
  }, [levels]);

  useAudioSampleListener(player, handleSample);

  const barIndices = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => i), []);

  return (
    <View style={styles.row}>
      {barIndices.map((i) => (
        <Bar key={i} index={i} levels={levels} color={color} />
      ))}
    </View>
  );
}

function IdleBar({ t, phase, color }) {
  const style = useAnimatedStyle(() => {
    const wave = 0.1 + 0.06 * Math.sin((t.value + phase) * Math.PI * 2);
    return { height: BAR_MIN_HEIGHT + wave * BAR_MAX_HEIGHT, opacity: 0.22 };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function IdleBars({ color }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [t]);

  const barIndices = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => i), []);

  return (
    <View style={styles.row}>
      {barIndices.map((i) => (
        <IdleBar key={i} t={t} phase={i / BAR_COUNT} color={color} />
      ))}
    </View>
  );
}

export default function AudioVisualizer({ active, size }) {
  const { player, playbackMode, isPlaying } = usePlayer();
  const { COLORS } = useTheme();

  const canSample = !!(active && playbackMode === 'native' && player?.isAudioSamplingSupported);
  useSamplingPermissionOnce(canSample);

  if (!active) return null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {canSample && isPlaying ? (
        <LiveBars player={player} color={COLORS.textPrimary} />
      ) : (
        <IdleBars color={COLORS.textPrimary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: BAR_MAX_HEIGHT + BAR_MIN_HEIGHT,
  },
  bar: {
    width: 5,
    borderRadius: 3,
  },
});
