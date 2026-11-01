// src/components/LyricsFullscreen.js
// Full-screen lyrics, Spotify-style: every line is on screen and scrollable,
// the current line is bright and large, and the view follows the song until
// you scroll yourself. Tap any line to jump there.
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { trackArt } from '../utils/trackArt';

const RESUME_FOLLOW_MS = 3500;   // after a manual scroll, wait this long before following again

export default function LyricsFullscreen({
  track, lines, plain, loading, error, position, duration,
  isPlaying, onTogglePlay, onSeek, onClose, onRetry,
}) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const scrollRef = useRef(null);
  const layouts = useRef({});
  const viewH = useRef(0);
  const manualUntil = useRef(0);
  const lastScrolledTo = useRef(-1);

  const activeIndex = useMemo(() => {
    if (!lines?.length) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (position >= lines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [position, lines]);

  const scrollToLine = useCallback((index, animated = true) => {
    const l = layouts.current[index];
    if (!l || !scrollRef.current) return;
    const y = Math.max(0, l.y - viewH.current * 0.32 + l.height / 2);
    scrollRef.current.scrollTo({ y, animated });
  }, []);

  // Follow the song.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex === lastScrolledTo.current) return;
    if (Date.now() < manualUntil.current) return;
    lastScrolledTo.current = activeIndex;
    scrollToLine(activeIndex);
  }, [activeIndex, scrollToLine]);

  // Land on the current line right away when opened mid-song.
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeIndex >= 0) scrollToLine(activeIndex, false);
    }, 120);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onManualScroll = useCallback(() => {
    manualUntil.current = Date.now() + RESUME_FOLLOW_MS;
  }, []);

  const art = trackArt(track);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      {art && <Image source={{ uri: art }} style={s.backdrop} blurRadius={80} />}
      <LinearGradient
        colors={['rgba(3,10,12,0.78)', 'rgba(3,10,12,0.9)', COLORS.background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title} numberOfLines={1}>{track?.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{track?.artist}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="text-outline" size={36} color={COLORS.textMuted} />
          <Text style={s.message}>{error}</Text>
          {onRetry && (
            <TouchableOpacity onPress={onRetry} style={s.retry}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : lines?.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
          onScrollBeginDrag={onManualScroll}
          onMomentumScrollBegin={onManualScroll}
        >
          {lines.map((line, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;
            return (
              <TouchableOpacity
                key={`${line.time}_${i}`}
                activeOpacity={0.6}
                onPress={() => { manualUntil.current = 0; lastScrolledTo.current = -1; onSeek(line.time); }}
                onLayout={(e) => { layouts.current[i] = e.nativeEvent.layout; }}
              >
                <Text
                  style={[
                    s.line,
                    isPast && s.linePast,
                    isActive && s.lineActive,
                  ]}
                >
                  {line.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : plain ? (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.plain}>{plain}</Text>
        </ScrollView>
      ) : null}

      {/* Slim transport so you never have to leave the lyrics */}
      <LinearGradient colors={['transparent', COLORS.background]} style={s.footer} pointerEvents="box-none">
        <View style={s.bar}><View style={[s.barFill, { width: `${progress * 100}%` }]} /></View>
        <TouchableOpacity onPress={onTogglePlay} style={s.playBtn} activeOpacity={0.85}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={COLORS.background}
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  artist: { color: COLORS.textSecondary, fontSize: 12.5, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 260 },
  line: {
    color: COLORS.textPrimary, opacity: 0.42,
    fontSize: 27, lineHeight: 36, fontWeight: '800', letterSpacing: -0.4,
    paddingVertical: 11,
  },
  linePast: { opacity: 0.3 },
  lineActive: { opacity: 1, color: COLORS.textPrimary },
  plain: { color: COLORS.textPrimary, opacity: 0.85, fontSize: 18, lineHeight: 30, fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  message: { color: COLORS.textSecondary, fontSize: 14, marginTop: 14, textAlign: 'center' },
  retry: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.cardBorder },
  retryText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 28, paddingTop: 50, paddingBottom: 30,
    flexDirection: 'row', alignItems: 'center', gap: 18,
  },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.seekBarTrack, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.primary },
  playBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
});
