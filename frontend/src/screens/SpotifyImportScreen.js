import { useTheme } from '../context/ThemeContext';
// src/screens/SpotifyImportScreen.js
// Premium Spotify playlist import — paste URL → match → create native playlist
import React, { useMemo,  useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Platform, Animated, Easing,
  Dimensions, Image, Switch, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { importSpotifyPlaylist } from '../api';
import { SPACING, BORDER_RADIUS, FONT_SIZE } from '../theme';

const { width: W } = Dimensions.get('window');

// ─── Animated step indicator ─────────────────────────────────
function StepDot({ active, done, label, COLORS, s }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[
        s.stepDot,
        done && s.stepDotDone,
        active && s.stepDotActive,
      ]}>
        {done
          ? <Ionicons name="checkmark" size={12} color="#FFF" />
          : <View style={[s.stepDotInner, active && { backgroundColor: '#FFF' }]} />
        }
      </View>
      <Text style={[s.stepLabel, (active || done) && { color: COLORS.primary }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Pulse loader ─────────────────────────────────────────────
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
    <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center', marginTop: 8 }}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={{ width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' }}
      >
        <Ionicons name="musical-notes" size={26} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Track row for results ─────────────────────────────────
function MiniTrack({ track, matched, status, COLORS, s }) {
  return (
    <View style={s.miniTrack}>
      {track.art_url ? (
        <Image source={{ uri: track.art_url }} style={s.miniArt} />
      ) : (
        <View style={[s.miniArt, { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="musical-notes" size={16} color={COLORS.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.miniTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={s.miniArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <View style={[s.matchBadge, { backgroundColor: matched ? 'rgba(6,214,160,0.15)' : 'rgba(239,68,68,0.12)' }]}>
        <Ionicons
          name={matched ? 'checkmark-circle' : 'close-circle'}
          size={16}
          color={matched ? COLORS.secondary : COLORS.error}
        />
        <Text style={[s.matchBadgeText, { color: matched ? COLORS.secondary : COLORS.error }]}>
          {matched ? 'Matched' : 'Not found'}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function SpotifyImportScreen({ onClose, onPlaylistCreated }) {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);



  const [url, setUrl] = useState('');
  const [enhance, setEnhance] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | fetching | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const progressAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  const currentStep = {
    idle: -1,
    fetching: 1,
    done: 4,
    error: -1,
  }[phase];

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
      Alert.alert('Paste a URL', 'Please paste a Spotify playlist link first.');
      return;
    }
    if (!trimmed.includes('spotify.com/playlist/') && !trimmed.includes('spotify:playlist:')) {
      Alert.alert('Invalid URL', 'This doesn\'t look like a Spotify playlist URL.\n\nExample: https://open.spotify.com/playlist/...');
      return;
    }

    setPhase('fetching');
    setError('');
    setResult(null);
    animateProgress(0.15);

    // Simulate realistic progress stages
    const progTimer1 = setTimeout(() => animateProgress(0.4), 800);
    const progTimer2 = setTimeout(() => animateProgress(0.7), 2500);
    const progTimer3 = setTimeout(() => animateProgress(0.88), 5000);

    try {
      const data = await importSpotifyPlaylist(trimmed, enhance);
      clearTimeout(progTimer1); clearTimeout(progTimer2); clearTimeout(progTimer3);
      animateProgress(1);
      setResult(data);
      setPhase('done');

      // Animate card in
      Animated.spring(cardAnim, {
        toValue: 1, friction: 8, tension: 60, useNativeDriver: true,
      }).start();
    } catch (e) {
      clearTimeout(progTimer1); clearTimeout(progTimer2); clearTimeout(progTimer3);
      const msg = e?.response?.data?.detail || e?.message || 'Import failed. Check the URL and try again.';
      setError(msg);
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

  const { stats, spotify_metadata, matched_tracks = [], unmatched_tracks = [], recommendations = [] } = result || {};
  const matchRate = stats ? Math.round((stats.matched / stats.total) * 100) : 0;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1DB95430', COLORS.background]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.45]}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={s.headerBrand}>
          <LinearGradient colors={['#1DB954', '#158A3E']} style={s.spotifyBadge}>
            <FontAwesome5 name="spotify" size={18} color="#FFF" />
          </LinearGradient>
          <Text style={s.headerTitle}>Import Playlist</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* URL Input */}
        <Text style={s.sectionTitle}>Paste Spotify link</Text>
        <Text style={s.sectionSub}>
          Share any public Spotify playlist → Copy link → Paste here
        </Text>

        <View style={[s.inputWrap, phase === 'fetching' && { borderColor: COLORS.primary + '80' }]}>
          <Ionicons name="link" size={20} color={COLORS.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://open.spotify.com/playlist/..."
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

        {/* Options */}
        <View style={s.optionRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.optionTitle}>✨ Enhance with AI recommendations</Text>
            <Text style={s.optionSub}>Add 5 similar songs to the playlist</Text>
          </View>
          <Switch
            value={enhance}
            onValueChange={setEnhance}
            trackColor={{ false: COLORS.surfaceElevated, true: COLORS.primary + '60' }}
            thumbColor={enhance ? COLORS.primary : COLORS.textMuted}
          />
        </View>

        {/* Progress bar + steps */}
        {phase === 'fetching' && (
          <View style={s.progressSection}>
            <PulseLoader COLORS={COLORS} />
            <Text style={s.progressLabel}>Importing your playlist…</Text>
            <Text style={s.progressSub}>Fetching tracks from Spotify and matching to our catalog</Text>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.secondary]}
                  style={{ flex: 1, borderRadius: 4 }}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                />
              </Animated.View>
            </View>

            {/* Step indicators */}
            <View style={s.stepsRow}>
              <StepDot active={currentStep === 1} done={currentStep > 1} label="Fetch" COLORS={COLORS} s={s} />
              <View style={s.stepLine} />
              <StepDot active={currentStep === 2} done={currentStep > 2} label="Match" COLORS={COLORS} s={s} />
              <View style={s.stepLine} />
              <StepDot active={currentStep === 3} done={currentStep > 3} label="Create" COLORS={COLORS} s={s} />
              <View style={s.stepLine} />
              <StepDot active={currentStep === 4} done={currentStep > 4} label="Done" COLORS={COLORS} s={s} />
            </View>
          </View>
        )}

        {/* Error state */}
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

        {/* Results */}
        {phase === 'done' && result && (
          <Animated.View style={{ opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
            {/* Playlist Card */}
            <View style={s.resultCard}>
              <LinearGradient colors={['#1DB95420', COLORS.surface]} style={s.resultCardGrad}>
                {spotify_metadata?.cover_url ? (
                  <Image source={{ uri: spotify_metadata.cover_url }} style={s.resultCover} />
                ) : (
                  <View style={[s.resultCover, { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={36} color={COLORS.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.resultPlaylistName} numberOfLines={2}>{spotify_metadata?.name}</Text>
                  <Text style={s.resultOwner}>by {spotify_metadata?.owner}</Text>

                  {/* Match rate pill */}
                  <View style={s.matchRatePill}>
                    <LinearGradient
                      colors={matchRate >= 80 ? [COLORS.secondary + '30', COLORS.secondary + '10'] : ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.05)']}
                      style={s.matchRatePillGrad}
                    >
                      <Text style={[s.matchRateText, { color: matchRate >= 80 ? COLORS.secondary : COLORS.warning }]}>
                        {matchRate}% matched
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{stats.total}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={[s.statBox, { borderColor: COLORS.secondary + '40' }]}>
                <Text style={[s.statNum, { color: COLORS.secondary }]}>{stats.matched}</Text>
                <Text style={s.statLabel}>Matched</Text>
              </View>
              {stats.recommendations_added > 0 && (
                <View style={[s.statBox, { borderColor: COLORS.primary + '40' }]}>
                  <Text style={[s.statNum, { color: COLORS.primary }]}>{stats.recommendations_added}</Text>
                  <Text style={s.statLabel}>AI Added</Text>
                </View>
              )}
              <View style={[s.statBox, { borderColor: COLORS.error + '30' }]}>
                <Text style={[s.statNum, { color: COLORS.error }]}>{stats.unmatched}</Text>
                <Text style={s.statLabel}>Missing</Text>
              </View>
            </View>

            {/* Open playlist button */}
            <TouchableOpacity onPress={handleOpenPlaylist} style={s.openBtn}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.openBtnGrad}>
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={s.openBtnText}>Open Playlist</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Matched tracks preview */}
            {matched_tracks.length > 0 && (
              <View style={s.tracksSection}>
                <Text style={s.tracksSectionTitle}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} /> Matched Tracks
                </Text>
                {matched_tracks.slice(0, 8).map((t, i) => (
                  <MiniTrack key={`m_${i}`} track={t} matched COLORS={COLORS} s={s} />
                ))}
                {matched_tracks.length > 8 && (
                  <Text style={s.moreText}>+{matched_tracks.length - 8} more matched</Text>
                )}
              </View>
            )}

            {/* Unmatched tracks */}
            {unmatched_tracks.length > 0 && (
              <View style={[s.tracksSection, { marginTop: 20 }]}>
                <Text style={s.tracksSectionTitle}>
                  <Ionicons name="alert-circle" size={14} color={COLORS.error} /> Not Available
                </Text>
                <Text style={s.unmatchedNote}>
                  These tracks aren't in our catalog yet. They may be exclusive releases or regional content.
                </Text>
                {unmatched_tracks.slice(0, 5).map((t, i) => (
                  <MiniTrack key={`u_${i}`} track={t} matched={false} COLORS={COLORS} s={s} />
                ))}
                {unmatched_tracks.length > 5 && (
                  <Text style={s.moreText}>+{unmatched_tracks.length - 5} more unavailable</Text>
                )}
              </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <View style={[s.tracksSection, { marginTop: 20 }]}>
                <View style={s.aiHeader}>
                  <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={s.aiDot} />
                  <Text style={s.tracksSectionTitle}>AI-Enhanced Picks</Text>
                </View>
                {recommendations.map((t, i) => (
                  <MiniTrack key={`r_${i}`} track={t} matched COLORS={COLORS} s={s} />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Import button */}
        {(phase === 'idle' || phase === 'error') && (
          <TouchableOpacity
            onPress={handleImport}
            style={[s.importBtn, !url.trim() && { opacity: 0.5 }]}
            disabled={!url.trim()}
          >
            <LinearGradient
              colors={['#1DB954', '#158A3E']}
              style={s.importBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
            >
              <FontAwesome5 name="spotify" size={20} color="#FFF" />
              <Text style={s.importBtnText}>Import from Spotify</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* How it works */}
        {phase === 'idle' && (
          <View style={s.howSection}>
            <Text style={s.howTitle}>How it works</Text>
            {[
              ['🔗', 'Paste any public Spotify playlist URL'],
              ['🔍', 'We fetch all tracks using the Spotify API'],
              ['🎯', 'Each track is matched to our music catalog'],
              ['✅', 'A native playlist is created in your library'],
              ['✨', 'Optionally enhance with AI recommendations'],
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spotifyBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  sectionTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 8, marginBottom: 6, letterSpacing: -0.4 },
  sectionSub: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 18, lineHeight: 18 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14, paddingHorizontal: 14, height: 52,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  input: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '500' },

  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14, padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  optionTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  optionSub: { color: COLORS.textSecondary, fontSize: 12 },

  // Progress
  progressSection: { alignItems: 'center', paddingVertical: 24 },
  progressLabel: { color: '#FFF', fontSize: 17, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  progressSub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  progressTrack: {
    width: W - 48, height: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4, overflow: 'hidden', marginBottom: 24,
  },
  progressFill: { height: 8, borderRadius: 4 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  stepLine: { width: 40, height: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '30' },
  stepDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },

  // Error
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 8,
  },
  errorTitle: { color: COLORS.error, fontSize: 17, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  errorMsg: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.surfaceElevated },

  // Result card
  resultCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, ...SHADOWS.card },
  resultCardGrad: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  resultCover: { width: 72, height: 72, borderRadius: 10 },
  resultPlaylistName: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 3 },
  resultOwner: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  matchRatePill: { alignSelf: 'flex-start' },
  matchRatePillGrad: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  matchRateText: { fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  statNum: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  statLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Open button
  openBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 24, ...SHADOWS.button },
  openBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 10,
  },
  openBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Track list
  tracksSection: { gap: 2 },
  tracksSectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  miniTrack: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  miniArt: { width: 40, height: 40, borderRadius: 8 },
  miniTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  miniArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  matchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  matchBadgeText: { fontSize: 11, fontWeight: '700' },
  moreText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  unmatchedNote: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aiDot: { width: 10, height: 10, borderRadius: 5 },

  // Import button
  importBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 28, ...SHADOWS.button },
  importBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, gap: 12,
  },
  importBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  // How it works
  howSection: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 16,
    padding: 18, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  howTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howText: { color: COLORS.textSecondary, fontSize: 14, flex: 1, lineHeight: 18 },
});
