// src/components/AmbientPulse.js
// Ambient mode — the app's showpiece. A black room with light that moves to
// the music: a core that swells on transients, two counter-drifting halos, and
// a ring that snaps outward on hits. All driven by real PCM amplitude from
// expo-audio's sampling API, with a slow breathing fallback when sampling
// isn't available (web, or the YouTube-embed fallback path).
import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useAudioSampleListener } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { trackArt } from '../utils/trackArt';

// Halo discs, largest first. Enough steps that the edges read as falloff
// rather than as rings.
const HALO_COUNT = 10;
const HALOS = Array.from({ length: HALO_COUNT }, (_, i) => {
  const t = i / (HALO_COUNT - 1); // 0 = outermost
  return {
    scale: 2.25 - t * 1.75,
    opacity: 0.016 + t * 0.032,
    reach: 0.62 - t * 0.46,
    lag: i * 22, // outer layers trail the beat slightly
  };
});

function Halo({ level, halo, core, colorFrom, colorTo }) {
  const style = useAnimatedStyle(() => {
    const v = level.value;
    return {
      transform: [{ scale: withTiming(1 + v * halo.reach, { duration: 120 + halo.lag }) }],
      opacity: withTiming(halo.opacity * (0.4 + v * 0.6), { duration: 160 + halo.lag }),
      backgroundColor: interpolateColor(v, [0, 1], [colorFrom, colorTo]),
    };
  });

  const size = core * halo.scale;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

// A thin ring that kicks outward on transients — reads as "the beat landed".
function PulseRing({ level, core, color }) {
  const style = useAnimatedStyle(() => {
    const v = level.value;
    const size = core * (1.05 + v * 0.85);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: Math.max(0, v - 0.25) * 0.5,
      borderColor: color,
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

function Light({ level, core, COLORS }) {
  return (
    <>
      {HALOS.map((halo, i) => (
        <Halo
          key={i}
          level={level}
          halo={halo}
          core={core}
          colorFrom={COLORS.secondary}
          colorTo={COLORS.primary}
        />
      ))}
      <PulseRing level={level} core={core} color={COLORS.primary} />
    </>
  );
}

function LiveLight({ player, core, COLORS }) {
  const level = useSharedValue(0);

  const handleSample = useCallback((sample) => {
    const frames = sample?.channels?.[0]?.frames;
    if (!frames || frames.length === 0) return;

    let sum = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(frames.length / 256));
    for (let i = 0; i < frames.length; i += step) {
      sum += frames[i] * frames[i];
      count++;
    }
    const rms = Math.sqrt(sum / Math.max(1, count));
    const target = Math.min(1, rms * 3.6);

    // Snap up on hits, ease down after — a symmetric filter feels sluggish.
    const prev = level.value;
    level.value = target > prev ? prev * 0.3 + target * 0.7 : prev * 0.82 + target * 0.18;
  }, [level]);

  useAudioSampleListener(player, handleSample);

  return <Light level={level} core={core} COLORS={COLORS} />;
}

function IdleLight({ core, COLORS }) {
  const level = useSharedValue(0.2);

  useEffect(() => {
    level.value = withRepeat(
      withTiming(0.62, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [level]);

  return <Light level={level} core={core} COLORS={COLORS} />;
}

export default function AmbientPulse({ onClose }) {
  const { COLORS } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const core = Math.min(W, H) * 0.34;
  const { player, playbackMode, isPlaying, currentTrack, togglePlay } = usePlayer();

  const canSample = !!(playbackMode === 'native' && player?.isAudioSamplingSupported);
  const art = useMemo(() => trackArt(currentTrack), [currentTrack]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <TouchableOpacity style={styles.stage} activeOpacity={1} onPress={togglePlay}>
        {canSample && isPlaying
          ? <LiveLight player={player} core={core} COLORS={COLORS} />
          : <IdleLight core={core} COLORS={COLORS} />}
      </TouchableOpacity>

      {currentTrack && (
        <View style={styles.meta} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
          {!canSample && (
            <Text style={styles.note}>Reactive light needs the app build — this is the idle glow</Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.close}
        onPress={onClose}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Ionicons name="contract-outline" size={21} color="rgba(255,255,255,0.32)" />
      </TouchableOpacity>

      <Text style={styles.hint} pointerEvents="none">Tap anywhere to play or pause</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 1 },
  meta: {
    position: 'absolute', bottom: 92, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32,
  },
  title: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  artist: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 3 },
  note: { color: 'rgba(255,255,255,0.18)', fontSize: 10, marginTop: 10, textAlign: 'center' },
  close: { position: 'absolute', top: 50, right: 22, padding: 8 },
  hint: {
    position: 'absolute', bottom: 42, left: 0, right: 0, textAlign: 'center',
    color: 'rgba(255,255,255,0.15)', fontSize: 11, letterSpacing: 0.5,
  },
});
