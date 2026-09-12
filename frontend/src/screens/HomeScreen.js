// src/screens/HomeScreen.js
// Editorial home feed: a wordmark, generous type, and full-bleed rows.
// Sections are separated by space and hairlines rather than cards, so the
// artwork carries the colour and the gold accent stays meaningful.
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet,
  StatusBar, TouchableOpacity, ActivityIndicator, Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import TrackActionSheet from '../components/TrackActionSheet';
import { getRecommendations, getBasedSuggestions, getTrending, getNewReleases, getMoodTracks, getArtistTracks } from '../api';
import { SPACING } from '../theme';
import { trackArt } from '../utils/trackArt';

const MOOD_CARDS = [
  { key: 'morning', label: 'Morning', icon: 'sunny-outline' },
  { key: 'workout', label: 'Workout', icon: 'barbell-outline' },
  { key: 'night', label: 'Night Drive', icon: 'moon-outline' },
  { key: 'focus', label: 'Focus', icon: 'eye-outline' },
  { key: 'party', label: 'Party', icon: 'sparkles-outline' },
  { key: 'relax', label: 'Relax', icon: 'leaf-outline' },
];

export default function HomeScreen() {
  const { COLORS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const { history, playTrack, currentTrack, playAll } = usePlayer();
  const [recommendations, setRecommendations] = useState([]);
  const [basedSuggestions, setBasedSuggestions] = useState([]);
  const [trending, setTrending] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [moodTracks, setMoodTracks] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);

  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingMood, setLoadingMood] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [artistBasedTracks, setArtistBasedTracks] = useState([]);
  const [artistBasedName, setArtistBasedName] = useState('');

  const [sheetTrack, setSheetTrack] = useState(null);

  const openSheet = useCallback((track) => setSheetTrack(track), []);
  const closeSheet = useCallback(() => setSheetTrack(null), []);

  const getTimeMood = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'focus';
    if (hour >= 17 && hour < 21) return 'party';
    return 'night';
  }, []);

  const loadFeed = useCallback(async () => {
    try {
      setLoadingTrending(true);
      const [t, nr] = await Promise.all([getTrending(15), getNewReleases(10)]);
      setTrending(t || []);
      setNewReleases(nr || []);
      setLoadingTrending(false);

      const autoMood = getTimeMood();
      setSelectedMood(autoMood);
      setLoadingMood(true);
      const mt = await getMoodTracks(autoMood, 10);
      setMoodTracks(mt || []);
      setLoadingMood(false);
    } catch (e) {
      console.warn('loadFeed failed (non-fatal):', e);
      setLoadingTrending(false);
      setLoadingMood(false);
    }
  }, [getTimeMood]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    async function loadRecs() {
      try {
        if (history.length > 0) {
          setLoadingRecs(true);
          const ids = history.slice(0, 3).map(t => t.id).filter(Boolean);
          if (ids.length > 0) setRecommendations((await getRecommendations(ids)) || []);
          setBasedSuggestions((await getBasedSuggestions()) || []);
          setLoadingRecs(false);
        } else {
          setBasedSuggestions((await getBasedSuggestions()) || []);
        }
      } catch (e) {
        console.warn('loadRecs failed:', e);
        setLoadingRecs(false);
      }
    }
    loadRecs();
  }, [history.length]);

  useEffect(() => {
    async function loadArtistRecs() {
      try {
        if (history.length === 0) return;
        const topArtist = history[0]?.artist?.split(',')[0]?.trim();
        if (topArtist && topArtist !== artistBasedName) {
          setArtistBasedName(topArtist);
          const at = await getArtistTracks(topArtist, 8);
          const histIds = new Set(history.map(h => h.id));
          setArtistBasedTracks((at || []).filter(t => !histIds.has(t.id)).slice(0, 6));
        }
      } catch (e) {
        console.warn('loadArtistRecs failed:', e);
      }
    }
    loadArtistRecs();
  }, [history.length, artistBasedName]);

  const handleMoodSelect = useCallback(async (mood) => {
    try {
      setSelectedMood(mood);
      setLoadingMood(true);
      setMoodTracks((await getMoodTracks(mood, 10)) || []);
      setLoadingMood(false);
    } catch (e) {
      setLoadingMood(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const moodLabel = useMemo(
    () => MOOD_CARDS.find(m => m.key === selectedMood)?.label || 'For You',
    [selectedMood]
  );

  const lastPlayed = history.length > 0 ? history[0] : null;

  const renderTrackCard = useCallback(({ item }) => {
    const art = trackArt(item);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() => playTrack(item)}
        onLongPress={() => openSheet(item)}
        delayLongPress={280}
      >
        <View style={s.cardArtWrap}>
          {art ? (
            <Image source={{ uri: art }} style={s.cardArt} />
          ) : (
            <View style={[s.cardArt, s.cardArtPlaceholder]}>
              <Ionicons name="musical-notes" size={28} color={COLORS.textMuted} />
            </View>
          )}
          <TouchableOpacity
            style={s.cardMore}
            onPress={() => openSheet(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={15} color="#FFF" />
          </TouchableOpacity>
        </View>
        <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.cardArtist} numberOfLines={1}>{item.artist}</Text>
      </TouchableOpacity>
    );
  }, [COLORS.textMuted, playTrack, openSheet, s]);

  const SectionHeader = useCallback(({ title, tracks }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {tracks?.length > 0 && (
        <TouchableOpacity onPress={() => playAll(tracks)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.playAll}>Play all</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [playAll, s]);

  const Carousel = useCallback(({ data, prefix }) => (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, i) => `${prefix}_${item.id}_${i}`}
      contentContainerStyle={s.carousel}
      renderItem={renderTrackCard}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={3}
      removeClippedSubviews
    />
  ), [renderTrackCard, s]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* Wordmark only — the brand is the type, not a badge */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.wordmark}>T <Text style={s.wordmarkSlash}>\</Text> L T</Text>
            <Text style={s.greeting}>{greeting}</Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            style={s.themeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={themeName === 'Noir' ? 'moon' : 'water'}
              size={17}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Continue listening */}
        {lastPlayed && (
          <TouchableOpacity
            style={s.hero}
            activeOpacity={0.85}
            onPress={() => playTrack(lastPlayed)}
            onLongPress={() => openSheet(lastPlayed)}
            delayLongPress={280}
          >
            {trackArt(lastPlayed) ? (
              <Image source={{ uri: trackArt(lastPlayed) }} style={s.heroArt} />
            ) : (
              <View style={[s.heroArt, s.cardArtPlaceholder]}>
                <Ionicons name="musical-notes" size={26} color={COLORS.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel}>Continue listening</Text>
              <Text style={s.heroTitle} numberOfLines={1}>{lastPlayed.title}</Text>
              <Text style={s.heroArtist} numberOfLines={1}>{lastPlayed.artist}</Text>
            </View>
            <View style={s.heroPlay}>
              <Ionicons name="play" size={19} color={COLORS.background} style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        )}

        {/* Mood — monochrome chips, accent marks the selection */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { paddingHorizontal: SPACING.xl }]}>Your mood</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
            {MOOD_CARDS.map((mood) => {
              const active = selectedMood === mood.key;
              return (
                <TouchableOpacity
                  key={mood.key}
                  onPress={() => handleMoodSelect(mood.key)}
                  activeOpacity={0.7}
                  style={[s.moodChip, active && s.moodChipActive]}
                >
                  <Ionicons name={mood.icon} size={15} color={active ? COLORS.background : COLORS.textSecondary} />
                  <Text style={[s.moodText, active && s.moodTextActive]}>{mood.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedMood && (
          <View style={s.section}>
            <SectionHeader title={moodLabel} tracks={moodTracks} />
            {loadingMood
              ? <ActivityIndicator size="small" color={COLORS.primary} style={s.loader} />
              : <Carousel data={moodTracks.slice(0, 8)} prefix="mood" />}
          </View>
        )}

        {basedSuggestions.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Based on your activity" tracks={basedSuggestions} />
            <Carousel data={basedSuggestions} prefix="based" />
          </View>
        )}

        {/* Trending — a numbered list reads better than another carousel */}
        <View style={s.section}>
          <SectionHeader title="Trending now" tracks={trending} />
          {loadingTrending ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={s.loader} />
          ) : (
            trending.slice(0, 5).map((item, i) => (
              <TrackItem
                key={`trend_${item.id}_${i}`}
                track={item}
                onPress={playTrack}
                onMore={openSheet}
                isPlaying={currentTrack?.id === item.id}
                showIndex
                index={i}
              />
            ))
          )}
        </View>

        {recommendations.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Recommended for you" tracks={recommendations} />
            {loadingRecs ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={s.loader} />
            ) : (
              recommendations.slice(0, 5).map((item) => (
                <TrackItem
                  key={`rec_${item.id}`}
                  track={item}
                  onPress={playTrack}
                  onMore={openSheet}
                  isPlaying={currentTrack?.id === item.id}
                />
              ))
            )}
          </View>
        )}

        {history.length > 1 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { paddingHorizontal: SPACING.xl }]}>Recently played</Text>
            <Carousel data={history.slice(1, 10)} prefix="recent" />
          </View>
        )}

        {newReleases.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="New releases" tracks={newReleases} />
            <Carousel data={newReleases} prefix="new" />
          </View>
        )}

        {artistBasedTracks.length > 0 && (
          <View style={s.section}>
            <SectionHeader title={`More from ${artistBasedName}`} tracks={artistBasedTracks} />
            <Carousel data={artistBasedTracks} prefix="artist" />
          </View>
        )}
      </ScrollView>

      <TrackActionSheet track={sheetTrack} visible={!!sheetTrack} onClose={closeSheet} />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 190 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: 26,
  },
  themeBtn: {
    width: 38, height: 38, borderRadius: 19, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  wordmark: {
    color: COLORS.textPrimary, fontSize: 30, fontWeight: '800',
    letterSpacing: 7,
  },
  wordmarkSlash: { color: COLORS.primary },
  greeting: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, letterSpacing: 0.2 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: SPACING.xl, marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  heroArt: { width: 62, height: 62, borderRadius: 10 },
  heroLabel: {
    color: COLORS.primary, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5,
  },
  heroTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  heroArtist: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  heroPlay: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },

  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.textPrimary, fontSize: 19, fontWeight: '700', letterSpacing: -0.3,
    marginBottom: 14,
  },
  playAll: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  loader: { marginTop: 18 },

  carousel: { paddingHorizontal: SPACING.xl, gap: 16 },

  card: { width: 148 },
  cardArtWrap: { marginBottom: 10 },
  cardArt: { width: 148, height: 148, borderRadius: 12 },
  cardArtPlaceholder: {
    backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center',
  },
  cardMore: {
    position: 'absolute', right: 6, top: 6,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  cardArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },

  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  moodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  moodText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  moodTextActive: { color: COLORS.background, fontWeight: '700' },
});
