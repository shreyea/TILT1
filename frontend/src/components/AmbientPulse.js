// src/components/AmbientPulse.js
// Full-screen ambient mode: a dark screen with a soft light that breathes with
// the music. Driven by real PCM amplitude from expo-audio's sampling API, so
// the light tracks what you're actually hearing rather than a canned loop.
// Falls back to a slow breathing animation where sampling isn't available.
import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useAudioSampleListener } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';

// Stacked translucent discs, largest first. Enough of them that the stepped
// edges blend into a soft radial falloff instead of reading as hard rings.
// `scale` is relative to the core size, which comes from the live viewport.
const LAYER_COUNT = 9;
const LAYERS = Array.from({ length: LAYER_COUNT }, (_, i) => {
  const t = i / (LAYER_COUNT - 1); // 0 = outermost, 1 = innermost
  return {
    scale: 2.0 - t * 1.55,         // wide halo -> tight core
    opacity: 0.02 + t * 0.035,     // stacked alpha adds up, so keep each faint
    reach: 0.6 - t * 0.45,         // outer rings swell more with the beat
  };
});

function Layer({ level, layer, color, core }) {
  const style = useAnimatedStyle(() => {
    const v = level.value;
    return {
      transform: [{ scale: withTiming(1 + v * layer.reach, { duration: 90 }) }],
      opacity: withTiming(layer.opacity * (0.45 + v * 0.55), { duration: 120 }),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          width: core * layer.scale,
          height: core * layer.scale,
          borderRadius: (core * layer.scale) / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function LiveLight({ player, color, core }) {
  const level = useSharedValue(0);

  const handleSample = useCallback((sample) => {
    const frames = sample?.channels?.[0]?.frames;
    if (!frames || frames.length === 0) return;

    let sum = 0;
    // Stride through the buffer — full resolution isn't needed for one number.
    const step = Math.max(1, Math.floor(frames.length / 256));
    let count = 0;
    for (let i = 0; i < frames.length; i += step) {
      sum += frames[i] * frames[i];
      count++;
    }
    const rms = Math.sqrt(sum / Math.max(1, count));

    // Ease toward the new level so the light glides instead of strobing.
    const target = Math.min(1, rms * 3.4);
    level.value = level.value * 0.55 + target * 0.45;
  }, [level]);

  useAudioSampleListener(player, handleSample);

  return (
    <>
      {LAYERS.map((layer, i) => (
        <Layer key={i} level={level} layer={layer} color={color} core={core} />
      ))}
    </>
  );
}

function IdleLight({ color, core }) {
  const level = useSharedValue(0.25);

  useEffect(() => {
    level.value = withRepeat(
      withTiming(0.6, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [level]);

  return (
    <>
      {LAYERS.map((layer, i) => (
        <Layer key={i} level={level} layer={layer} color={color} core={core} />
      ))}
    </>
  );
}

export default function AmbientPulse({ onClose }) {
  const { COLORS } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const core = Math.min(W, H) * 0.34;
  const { player, playbackMode, isPlaying, currentTrack, togglePlay } = usePlayer();

  const canSample = !!(playbackMode === 'native' && player?.isAudioSamplingSupported);
  const color = useMemo(() => COLORS.primary, [COLORS.primary]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <TouchableOpacity
        style={styles.stage}
        activeOpacity={1}
        onPress={togglePlay}
      >
        {canSample && isPlaying ? (
          <LiveLight player={player} color={color} core={core} />
        ) : (
          <IdleLight color={color} core={core} />
        )}
      </TouchableOpacity>

      {/* Barely-there track label so the screen stays mostly dark */}
      {currentTrack && (
        <View style={styles.meta} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
        <Ionicons name="contract-outline" size={22} color="rgba(255,255,255,0.35)" />
      </TouchableOpacity>

      <Text style={styles.hint}>Tap anywhere to play or pause</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute' },
  meta: {
    position: 'absolute', bottom: 96, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32,
  },
  title: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  artist: { color: 'rgba(255,255,255,0.28)', fontSize: 12, marginTop: 3 },
  close: { position: 'absolute', top: 52, right: 24, padding: 8 },
  hint: {
    position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.16)', fontSize: 11, letterSpacing: 0.5,
  },
});
