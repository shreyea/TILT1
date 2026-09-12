// src/screens/NowPlayingScreen.js
// Full-bleed player. The artwork itself is the background — blurred and
// darkened — so the screen needs no panels or cards. Cover / Pulse / Lyrics
// swap through the same stage area; everything else is type and one accent.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions,
  StatusBar, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import AudioSettingsScreen from './AudioSettingsScreen';
import AudioVisualizer from '../components/AudioVisualizer';
import AmbientPulse from '../components/AmbientPulse';
import TrackActionSheet from '../components/TrackActionSheet';
import * as Storage from '../services/StorageService';
import { trackArt } from '../utils/trackArt';
import { fetchLyrics as lookupLyrics } from '../services/LyricsService';

function fmt(ms) {
  if (!ms || ms < 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STAGES = [
  { key: 'art', label: 'Cover' },
  { key: 'visualizer', label: 'Pulse' },
  { key: 'lyrics', label: 'Lyrics' },
];

export default function NowPlayingScreen({ onClose }) {
  const { COLORS } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const stageSize = Math.min(W * 0.78, 330);
  const s = useMemo(() => createStyles(COLORS, W, H, stageSize), [COLORS, W, H, stageSize]);

  const {
    currentTrack, isPlaying, isLoading, position, duration,
    volume, repeatMode, shuffleOn,
    togglePlay, seekTo, changeVolume, playNext, playPrevious,
    toggleShuffle, cycleRepeat,
  } = usePlayer();

  const [liked, setLiked] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showAmbient, setShowAmbient] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [stageMode, setStageMode] = useState('art');

  const [syncedLines, setSyncedLines] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lyricsError, setLyricsError] = useState(null);

  useEffect(() => {
    if (!currentTrack?.id) return;
    Storage.getLikedSongs()
      .then(songs => setLiked(songs.some(t => t.id === currentTrack.id)))
      .catch(() => {});
  }, [currentTrack?.id]);

  const handleLike = useCallback(async () => {
    if (!currentTrack) return;
    const songs = await Storage.getLikedSongs();
    const isLiked = songs.some(t => t.id === currentTrack.id);
    await Storage.saveLikedSongs(
      isLiked ? songs.filter(t => t.id !== currentTrack.id) : [currentTrack, ...songs]
    );
    setLiked(!isLiked);
  }, [currentTrack]);

  // Reset the stage whenever the song changes.
  useEffect(() => {
    setStageMode('art');
    setSyncedLines([]);
    setPlainLyrics(null);
    setLyricsError(null);
  }, [currentTrack?.id]);

  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    setLoadingLyrics(true);
    setLyricsError(null);
    try {
      const result = await lookupLyrics(currentTrack);
      if (!result) {
        setLyricsError('No lyrics found for this track');
        setSyncedLines([]);
        setPlainLyrics(null);
      } else if (result.synced.length > 0) {
        setSyncedLines(result.synced);
        setPlainLyrics(null);
      } else {
        setPlainLyrics(result.plain);
        setSyncedLines([]);
      }
    } catch (e) {
      setLyricsError('Could not load lyrics');
    } finally {
      setLoadingLyrics(false);
    }
  }, [currentTrack]);

  const selectStage = useCallback(async (mode) => {
    setStageMode(mode);
    if (mode === 'lyrics' && !syncedLines.length && !plainLyrics && !lyricsError) {
      await fetchLyrics();
    }
  }, [syncedLines.length, plainLyrics, lyricsError, fetchLyrics]);

  const activeLineIndex = useMemo(() => {
    if (!syncedLines.length) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (position >= syncedLines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [position, syncedLines]);

  if (!currentTrack) {
    return (
      <View style={[s.container, s.centered]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="musical-notes-outline" size={54} color={COLORS.textMuted} />
        <Text style={s.emptyText}>Nothing playing</Text>
        <TouchableOpacity onPress={onClose} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const art = trackArt(currentTrack);

  const renderLyrics = () => {
    const hasActive = activeLineIndex >= 0;
    const current = hasActive ? syncedLines[activeLineIndex] : syncedLines[0];
    const prevLine = hasActive && activeLineIndex > 0 ? syncedLines[activeLineIndex - 1] : null;
    const nextLine = hasActive
      ? (activeLineIndex < syncedLines.length - 1 ? syncedLines[activeLineIndex + 1] : null)
      : syncedLines[1] || null;

    return (
      <View style={s.lyricsWrap}>
        {prevLine ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => seekTo(prevLine.time)}>
            <Text style={s.lyricFaded} numberOfLines={2}>{prevLine.text}</Text>
          </TouchableOpacity>
        ) : <View style={s.lyricSpacer} />}

        <Text style={s.lyricCurrent} numberOfLines={3}>{current?.text}</Text>

        {nextLine ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => seekTo(nextLine.time)}>
            <Text style={s.lyricFaded} numberOfLines={2}>{nextLine.text}</Text>
          </TouchableOpacity>
        ) : <View style={s.lyricSpacer} />}
      </View>
    );
  };

  const renderStage = () => {
    if (stageMode === 'visualizer') {
      return <AudioVisualizer active size={stageSize} />;
    }
    if (stageMode === 'lyrics') {
      return (
        <View style={s.stageArea}>
          {loadingLyrics ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : lyricsError ? (
            <View style={s.centered}>
              <Ionicons name="text-outline" size={34} color={COLORS.textMuted} />
              <Text style={s.lyricsMessage}>{lyricsError}</Text>
            </View>
          ) : syncedLines.length > 0 ? (
            renderLyrics()
          ) : plainLyrics ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
              <Text style={s.lyricPlain}>{plainLyrics}</Text>
            </ScrollView>
          ) : null}
        </View>
      );
    }
    return art ? (
      <Image source={{ uri: art }} style={s.cover} />
    ) : (
      <View style={[s.cover, s.coverPlaceholder]}>
        <Ionicons name="musical-notes" size={64} color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* The artwork is the background — no panels needed on top of it */}
      {art && <Image source={{ uri: art }} style={s.backdrop} blurRadius={90} />}
      <LinearGradient
        colors={['rgba(3,24,29,0.55)', 'rgba(3,24,29,0.88)', COLORS.background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.topBar}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={s.topLabel}>Now Playing</Text>
        <TouchableOpacity onPress={() => setShowSheet(true)} style={s.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <View style={s.stageWrap}>
          <Animated.View key={stageMode} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={s.stageFill}>
            {renderStage()}
          </Animated.View>
        </View>

        <View style={s.switcher}>
          {STAGES.map((st) => {
            const active = stageMode === st.key;
            return (
              <TouchableOpacity key={st.key} onPress={() => selectStage(st.key)} activeOpacity={0.7} style={s.switchItem}>
                <Text style={[s.switchLabel, active && s.switchLabelActive]}>{st.label.toUpperCase()}</Text>
                <View style={[s.switchDot, active && { backgroundColor: COLORS.primary }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.meta}>
          <View style={{ flex: 1, marginRight: 14 }}>
            <Text style={s.title} numberOfLines={2}>{currentTrack.title}</Text>
            <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <TouchableOpacity onPress={handleLike} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={25} color={liked ? COLORS.liked : COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={s.seekWrap}>
          <Slider
            style={s.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            onSlidingComplete={seekTo}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.seekBarTrack}
            thumbTintColor={COLORS.primary}
          />
          <View style={s.timeRow}>
            <Text style={s.time}>{fmt(position)}</Text>
            <Text style={s.time}>{fmt(duration)}</Text>
          </View>
        </View>

        <View style={s.controls}>
          <TouchableOpacity onPress={toggleShuffle} style={s.sideBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="shuffle" size={22} color={shuffleOn ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={playPrevious} style={s.skipBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={s.playBtn} activeOpacity={0.85}>
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={30}
                color={COLORS.background}
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={playNext} style={s.skipBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="play-skip-forward" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={cycleRepeat} style={s.sideBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="repeat" size={22} color={repeatMode !== 'off' ? COLORS.primary : COLORS.textSecondary} />
            {repeatMode === 'one' && <View style={s.repeatOneDot} />}
          </TouchableOpacity>
        </View>

        <View style={s.volumeRow}>
          <Ionicons name="volume-low" size={15} color={COLORS.textMuted} />
          <Slider
            style={s.volumeSlider}
            minimumValue={0} maximumValue={1} step={0.01}
            value={volume} onValueChange={changeVolume}
            minimumTrackTintColor={COLORS.textSecondary}
            maximumTrackTintColor={COLORS.seekBarTrack}
            thumbTintColor={COLORS.textSecondary}
          />
          <Ionicons name="volume-high" size={15} color={COLORS.textMuted} />
        </View>

        <View style={s.bottomRow}>
          <BottomAction icon="sparkles-outline" label="Ambient" onPress={() => setShowAmbient(true)} s={s} COLORS={COLORS} />
          <BottomAction icon="options-outline" label="Audio" onPress={() => setShowAudioSettings(true)} s={s} COLORS={COLORS} />
          <BottomAction icon="add-circle-outline" label="Add to" onPress={() => setShowSheet(true)} s={s} COLORS={COLORS} />
        </View>
      </View>

      {showAmbient && (
        <View style={s.fullOverlay}>
          <AmbientPulse onClose={() => setShowAmbient(false)} />
        </View>
      )}
      {showAudioSettings && (
        <View style={s.fullOverlay}>
          <AudioSettingsScreen onClose={() => setShowAudioSettings(false)} />
        </View>
      )}

      <TrackActionSheet track={currentTrack} visible={showSheet} onClose={() => setShowSheet(false)} />
    </View>
  );
}

function BottomAction({ icon, label, onPress, s, COLORS }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.bottomBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
      <Text style={s.bottomLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS, W, H, STAGE) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 14 },
  emptyBtn: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 10 },
  emptyBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  backdrop: { ...StyleSheet.absoluteFillObject, width: W, height: H, opacity: 0.35 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 56 : 42, paddingBottom: 6,
  },
  iconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  topLabel: {
    color: COLORS.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 2.4, textTransform: 'uppercase',
  },

  body: { flex: 1, justifyContent: 'center', paddingBottom: 16 },

  stageWrap: { height: STAGE, marginHorizontal: 24, justifyContent: 'center' },
  stageFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cover: { width: STAGE, height: STAGE, borderRadius: 14, alignSelf: 'center' },
  coverPlaceholder: {
    backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center',
  },
  stageArea: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  switcher: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginTop: 22 },
  switchItem: { alignItems: 'center', paddingVertical: 6 },
  switchLabel: { color: COLORS.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.6 },
  switchLabelActive: { color: COLORS.textPrimary },
  switchDot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 6, backgroundColor: 'transparent' },

  meta: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 28, marginTop: 26 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29 },
  artist: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6 },

  seekWrap: { paddingHorizontal: 24, marginTop: 20 },
  slider: { width: '100%', height: 30 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6, paddingHorizontal: 4 },
  time: { color: COLORS.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 18, marginTop: 14,
  },
  sideBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  skipBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  playBtn: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  repeatOneDot: {
    position: 'absolute', bottom: 8, width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: COLORS.primary,
  },

  volumeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 28, marginTop: 16,
  },
  volumeSlider: { flex: 1, height: 28 },

  bottomRow: { flexDirection: 'row', justifyContent: 'center', gap: 44, marginTop: 22 },
  bottomBtn: { alignItems: 'center', gap: 5 },
  bottomLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  lyricsWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 10 },
  lyricFaded: { color: COLORS.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center', fontWeight: '600' },
  lyricSpacer: { height: 42 },
  lyricCurrent: {
    color: COLORS.textPrimary, fontSize: 24, lineHeight: 31,
    textAlign: 'center', fontWeight: '800', letterSpacing: -0.3,
  },
  lyricPlain: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 26, textAlign: 'center' },
  lyricsMessage: { color: COLORS.textSecondary, fontSize: 14, marginTop: 12, textAlign: 'center' },

  fullOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.background, zIndex: 50, elevation: 50,
  },
});
