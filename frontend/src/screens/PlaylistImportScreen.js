// src/screens/PlaylistImportScreen.js
// Import a public YouTube playlist straight into the local library.
// Uses Piped (no API key, no backend) — every entry already carries a videoId,
// so imported tracks stream immediately with no matching step.
import { useTheme } from '../context/ThemeContext';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, Animated, Easing,
  Dimensions, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { importYouTubePlaylist } from '../services/PlaylistImportService';
import * as Storage from '../services/StorageService';

const { width: W } = Dimensions.get('window');

function PulseLoader({ COLORS }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={{ width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' }}
      >
        <Ionicons name="musical-notes" size={26} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
}

function MiniTrack({ track, COLORS, s }) {
  return (
    <View style={s.miniTrack}>
      {track.art_url ? (
        <Image source={{ uri: track.art_url }} style={s.miniArt} />
      ) : (
        <View style={[s.miniArt, s.miniArtPlaceholder]}>
          <Ionicons name="musical-notes" size={16} color={COLORS.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.miniTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={s.miniArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
    </View>
  );
}

export default function PlaylistImportScreen({ onClose, onPlaylistCreated }) {
  const { COLORS, SHADOWS } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);

  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | fetching | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const progressAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  function animateProgress(toValue) {
    Animated.timing(progressAnim, {
      toValue,
      duration: 600,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }

  async function handleImport() {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Paste a link', 'Paste a YouTube playlist link first.');
      return;
    }

    setPhase('fetching');
    setError('');
    setResult(null);
    animateProgress(0.2);
    const progTimer = setTimeout(() => animateProgress(0.75), 1200);

    try {
      const data = await importYouTubePlaylist(trimmed);
      clearTimeout(progTimer);

      const localId = 'local_' + Date.now();
      const localPlaylist = {
        id: localId,
        name: data.name,
        track_count: data.tracks.length,
        cover_url: data.coverUrl,
      };

      const existing = await Storage.getPlaylists();
      await Storage.savePlaylists([...existing, localPlaylist]);
      await Storage.savePlaylistTracks(localId, data.tracks);

      animateProgress(1);
      setResult({ ...data, playlist: localPlaylist });
      setPhase('done');

      Animated.spring(cardAnim, {
        toValue: 1, friction: 8, tension: 60, useNativeDriver: true,
      }).start();
    } catch (e) {
      clearTimeout(progTimer);
      setError(e?.message || 'Import failed. Check the link and try again.');
      setPhase('error');
    }
  }

  function handleOpenPlaylist() {
    if (result?.playlist) {
      onPlaylistCreated?.(result.playlist);
      onClose?.();
    }
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.primary + '25', COLORS.background]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.45]}
      />

      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Import Playlist</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.sectionTitle}>Paste a YouTube playlist link</Text>
        <Text style={s.sectionSub}>
          Any public YouTube or YouTube Music playlist — every track imports straight into your library.
        </Text>

        <View style={[s.inputWrap, phase === 'fetching' && { borderColor: COLORS.primary + '80' }]}>
          <Ionicons name="link" size={20} color={COLORS.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/playlist?list=..."
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={phase !== 'fetching'}
            returnKeyType="done"
          />
          {url.length > 0 && (
            <TouchableOpacity onPress={() => setUrl('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {phase === 'fetching' && (
          <View style={s.progressSection}>
            <PulseLoader COLORS={COLORS} />
            <Text style={s.progressLabel}>Importing…</Text>
            <Text style={s.progressSub}>Fetching the playlist and its tracks</Text>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.secondary]}
                  style={{ flex: 1, borderRadius: 4 }}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
            </View>
          </View>
        )}

        {phase === 'error' && (
          <View style={s.errorCard}>
            <Ionicons name="warning-outline" size={32} color={COLORS.error} />
            <Text style={s.errorTitle}>Import Failed</Text>
            <Text style={s.errorMsg}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setPhase('idle')}>
              <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 14 }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'done' && result && (
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <View style={s.resultCard}>
              <LinearGradient colors={[COLORS.primary + '20', COLORS.surface]} style={s.resultCardGrad}>
                {result.coverUrl ? (
                  <Image source={{ uri: result.coverUrl }} style={s.resultCover} />
                ) : (
                  <View style={[s.resultCover, s.miniArtPlaceholder]}>
                    <Ionicons name="musical-notes" size={36} color={COLORS.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.resultPlaylistName} numberOfLines={2}>{result.name}</Text>
                  {!!result.uploader && <Text style={s.resultOwner}>by {result.uploader}</Text>}
                  <Text style={s.resultCount}>
                    {result.tracks.length} track{result.tracks.length === 1 ? '' : 's'} added
                    {result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <TouchableOpacity onPress={handleOpenPlaylist} style={s.openBtn}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.openBtnGrad}>
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={s.openBtnText}>Open Playlist</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={s.tracksSection}>
              <Text style={s.tracksSectionTitle}>Imported Tracks</Text>
              {result.tracks.slice(0, 10).map((t, i) => (
                <MiniTrack key={`${t.id}_${i}`} track={t} COLORS={COLORS} s={s} />
              ))}
              {result.tracks.length > 10 && (
                <Text style={s.moreText}>+{result.tracks.length - 10} more</Text>
              )}
            </View>
          </Animated.View>
        )}

        {(phase === 'idle' || phase === 'error') && (
          <TouchableOpacity
            onPress={handleImport}
            style={[s.importBtn, !url.trim() && { opacity: 0.5 }]}
            disabled={!url.trim()}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={s.importBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
            >
              <Ionicons name="download-outline" size={20} color="#FFF" />
              <Text style={s.importBtnText}>Import Playlist</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {phase === 'idle' && (
          <View style={s.howSection}>
            <Text style={s.howTitle}>How it works</Text>
            {[
              ['🔗', 'Open a playlist on YouTube and copy its link'],
              ['📥', 'Paste it above — tracks are read straight from the playlist'],
              ['✅', 'A playlist is created in your library, ready to play'],
            ].map(([icon, text], i) => (
              <View key={i} style={s.howRow}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
                <Text style={s.howText}>{text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  sectionTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 8, marginBottom: 6, letterSpacing: -0.4 },
  sectionSub: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 18, lineHeight: 18 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14, paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 24,
  },
  input: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '500' },

  progressSection: { alignItems: 'center', paddingVertical: 24 },
  progressLabel: { color: '#FFF', fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  progressSub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20 },
  progressTrack: {
    width: W - 48, height: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },

  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 8, marginBottom: 20,
  },
  errorTitle: { color: COLORS.error, fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  errorMsg: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.surfaceElevated },

  resultCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, ...SHADOWS.card },
  resultCardGrad: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  resultCover: { width: 72, height: 72, borderRadius: 10 },
  resultPlaylistName: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 3 },
  resultOwner: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  resultCount: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },

  openBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 24, ...SHADOWS.button },
  openBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 10,
  },
  openBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  tracksSection: { gap: 2 },
  tracksSectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  miniTrack: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  miniArt: { width: 40, height: 40, borderRadius: 8 },
  miniArtPlaceholder: {
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  miniTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  miniArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  moreText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 },

  importBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 28, ...SHADOWS.button },
  importBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, gap: 12,
  },
  importBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  howSection: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 16,
    padding: 18, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  howTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howText: { color: COLORS.textSecondary, fontSize: 14, flex: 1, lineHeight: 18 },
});
