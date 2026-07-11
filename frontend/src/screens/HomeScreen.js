import { useTheme } from '../context/ThemeContext';
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet,
  StatusBar, TouchableOpacity, ActivityIndicator, Platform, Image,
  RefreshControl, Modal, TextInput, Alert, ImageBackground
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import { getRecommendations, getBasedSuggestions, getTrending, getNewReleases, getMoodTracks, getArtistTracks, getPlaylists, addToPlaylist, createPlaylist } from '../api';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';
import * as Storage from '../services/StorageService';

const MOOD_CARDS = [
  { key: 'morning', label: 'Morning Chill', icon: 'sunny-outline', gradient: ['#F59E0B', '#D97706'] },
  { key: 'workout', label: 'Workout', icon: 'barbell-outline', gradient: ['#EF4444', '#DC2626'] },
  { key: 'night', label: 'Night Drive', icon: 'moon-outline', gradient: ['#6366F1', '#4F46E5'] },
  { key: 'focus', label: 'Deep Focus', icon: 'eye-outline', gradient: ['#06D6A0', '#059669'] },
  { key: 'party', label: 'Party Mode', icon: 'sparkles-outline', gradient: ['#EC4899', '#DB2777'] },
  { key: 'relax', label: 'Relax', icon: 'leaf-outline', gradient: ['#8B5CF6', '#7C3AED'] },
];

export default function HomeScreen({ navigation }) {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);

  const { history, playTrack, addToQueue, currentTrack, playAll } = usePlayer();
  const [recommendations, setRecommendations] = useState([]);
  const [basedSuggestions, setBasedSuggestions] = useState([]);
  const [trending, setTrending] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [moodTracks, setMoodTracks] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [loadingMood, setLoadingMood] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [artistBasedTracks, setArtistBasedTracks] = useState([]);
  const [artistBasedName, setArtistBasedName] = useState('');
  
  // Playlist Modal State
  const [showActions, setShowActions] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleLongPress = useCallback(async (track) => {
    setSelectedTrack(track);
    const pls = await Storage.getPlaylists();
    setPlaylists(pls);
    setShowActions(true);
  }, []);

  const handleAddToPlaylist = useCallback(async (playlistId) => {
    if (!selectedTrack) return;
    
    // Get existing tracks
    const existingTracks = await Storage.getPlaylistTracks(playlistId);
    // Check if already in playlist
    if (!existingTracks.find(t => t.id === selectedTrack.id)) {
        const updatedTracks = [...existingTracks, selectedTrack];
        await Storage.savePlaylistTracks(playlistId, updatedTracks);
    }
    
    // Also update backend if still using it for some sync, but we use Storage primarily now as per requirement
    try {
        await addToPlaylist(playlistId, selectedTrack);
    } catch (e) {
        // Silently fail backend sync
    }

    setShowActions(false);
    Alert.alert('Added', `"${selectedTrack.title}" added to playlist.`);
  }, [selectedTrack]);

  const handleCreateAndAdd = useCallback(async () => {
    if (!newPlaylistName.trim() || !selectedTrack) return;
    try {
      // Create locally
      let createdId;
      try {
        // Try backend first to get a real ID if possible
        const created = await createPlaylist(newPlaylistName.trim());
        createdId = created.id;
      } catch (e) {
        // Fallback to local only ID
        createdId = 'local_' + Date.now();
      }

      const newPlaylist = { id: createdId, name: newPlaylistName.trim(), track_count: 1 };
      const pls = await Storage.getPlaylists();
      await Storage.savePlaylists([...pls, newPlaylist]);
      await Storage.savePlaylistTracks(createdId, [selectedTrack]);

      setNewPlaylistName('');
      setShowNewPlaylist(false);
      setShowActions(false);
      Alert.alert('Done', `Created "${newPlaylistName}" and added the track.`);
    } catch {
      Alert.alert('Error', 'Could not create playlist.');
    }
  }, [newPlaylistName, selectedTrack]);

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
      setLoadingReleases(true);
      const [t, nr] = await Promise.all([
        getTrending(15),
        getNewReleases(10),
      ]);
      setTrending(t || []);
      setNewReleases(nr || []);
      setLoadingTrending(false);
      setLoadingReleases(false);
      
      // Auto-load time-appropriate mood
      const autoMood = getTimeMood();
      setSelectedMood(autoMood);
      setLoadingMood(true);
      const mt = await getMoodTracks(autoMood, 10);
      setMoodTracks(mt || []);
      setLoadingMood(false);
    } catch (e) {
      console.warn('loadFeed failed (non-fatal):', e);
      setLoadingTrending(false);
      setLoadingReleases(false);
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
          if (ids.length > 0) {
            const recs = await getRecommendations(ids);
            setRecommendations(recs || []);
          }
          const based = await getBasedSuggestions();
          setBasedSuggestions(based || []);
          setLoadingRecs(false);
        } else {
          // even if no history, they might have liked songs
          const based = await getBasedSuggestions();
          setBasedSuggestions(based || []);
        }
      } catch (e) {
        console.warn('loadRecs failed:', e);
        setLoadingRecs(false);
      }
    }
    loadRecs();
  }, [history.length]);

  // Load artist-based recommendations from listening history
  useEffect(() => {
    async function loadArtistRecs() {
      try {
        if (history.length > 0) {
          const topArtist = history[0]?.artist?.split(',')[0]?.trim();
          if (topArtist && topArtist !== artistBasedName) {
            setArtistBasedName(topArtist);
            const at = await getArtistTracks(topArtist, 8);
            // Filter out tracks already in history
            const histIds = new Set(history.map(h => h.id));
            setArtistBasedTracks((at || []).filter(t => !histIds.has(t.id)).slice(0, 6));
          }
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
      const mt = await getMoodTracks(mood, 10);
      setMoodTracks(mt || []);
      setLoadingMood(false);
    } catch (e) {
      console.warn('handleMoodSelect failed:', e);
      setLoadingMood(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadFeed();
    } catch (e) {
      console.warn('onRefresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed]);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const moodLabel = useMemo(() => MOOD_CARDS.find(m => m.key === selectedMood)?.label || 'For You', [selectedMood]);

  // Memoized Render Items
  const lastPlayed = history.length > 0 ? history[0] : null;

  const renderTrackCard = useCallback(({ item }) => (
    <TouchableOpacity style={s.trackCard} activeOpacity={0.7} onPress={() => playTrack(item)}>
      <View style={s.trackCardArtWrap}>
        {item.art_url ? (
          <Image source={{ uri: item.art_url }} style={s.trackCardArt} />
        ) : (
          <View style={[s.trackCardArt, s.trackCardArtPlaceholder]}>
            <Ionicons name="musical-notes" size={36} color={COLORS.textMuted} />
          </View>
        )}
      </View>
      <Text style={s.trackCardTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={s.trackCardArtist} numberOfLines={1}>{item.artist}</Text>
    </TouchableOpacity>
  ), [COLORS.textMuted, playTrack, s]);

  const renderTrendingTrack = useCallback((item, i) => (
    <TrackItem
      key={'trend_' + item.id + '_' + i}
      track={item}
      onPress={playTrack}
      isPlaying={currentTrack?.id === item.id}
      showIndex={true} index={i}
      onLongPress={handleLongPress}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => handleLongPress(item)} style={s.addBtn}>
            <Ionicons name="list" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addToQueue(item)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      }
    />
  ), [COLORS.primary, currentTrack?.id, handleLongPress, playTrack, addToQueue, s]);

  const renderRecommendationTrack = useCallback((item) => (
    <TrackItem
      key={'rec_' + item.id}
      track={item}
      onPress={playTrack}
      isPlaying={currentTrack?.id === item.id}
      onLongPress={handleLongPress}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => handleLongPress(item)} style={s.addBtn}>
            <Ionicons name="list" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addToQueue(item)} style={s.addBtn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      }
    />
  ), [COLORS.primary, currentTrack?.id, handleLongPress, playTrack, addToQueue, s]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* Header */}
        <LinearGradient colors={[COLORS.primary + '30', COLORS.background]} style={s.headerGradient}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={s.logoWrap}>
              <Text style={s.logoSlash}>\</Text>
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.brandName}>T \ L T</Text>
              <Text style={s.subGreeting}>{getGreeting()}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={toggleTheme}>
            <Ionicons name="color-palette-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </LinearGradient>

        {/* 1. Jump Back In / Last Played Banner */}
        {lastPlayed && (
          <View style={[s.section, { paddingHorizontal: SPACING.xl }]}>
            <Text style={s.sectionTitleInline}>Jump Back In</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => playTrack(lastPlayed)} style={{ marginTop: 12 }}>
              <View style={s.jumpBanner}>
                {lastPlayed.art_url ? (
                  <Image source={{ uri: lastPlayed.art_url }} style={StyleSheet.absoluteFillObject} />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.surfaceElevated }]} />
                )}
                <BlurView intensity={80} tint={themeName === 'Dawn' ? 'light' : 'dark'} style={s.jumpBlur}>
                  <LinearGradient
                    colors={['transparent', COLORS.background + '80']}
                    style={s.jumpGradient}
                  />
                  <View style={s.jumpContent}>
                    <View style={s.jumpArtWrap}>
                      {lastPlayed.art_url ? (
                        <Image source={{ uri: lastPlayed.art_url }} style={s.jumpArt} />
                      ) : (
                        <Ionicons name="musical-notes" size={24} color={COLORS.textMuted} />
                      )}
                    </View>
                    <View style={s.jumpTextWrap}>
                      <Text style={s.jumpTitle} numberOfLines={1}>{lastPlayed.title}</Text>
                      <Text style={s.jumpArtist} numberOfLines={1}>{lastPlayed.artist}</Text>
                    </View>
                    <View style={s.jumpPlayBtn}>
                      <Ionicons name="play" size={20} color="#FFF" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                </BlurView>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. Based on your activity */}
        {basedSuggestions.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitleInline}>Based on your activity</Text>
              <TouchableOpacity onPress={() => playAll(basedSuggestions)}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllChip}>
                  <Ionicons name="play" size={12} color="#FFF" />
                  <Text style={s.playAllText}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <FlatList
              data={basedSuggestions}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => 'based_' + (item.id || item.spotify_id)}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={renderTrackCard}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={true}
            />
          </View>
        )}

        {/* 3. Recommended For You */}
        {recommendations.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitleInline}>Recommended For You</Text>
              <TouchableOpacity onPress={() => playAll(recommendations)}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllChip}>
                  <Ionicons name="play" size={12} color="#FFF" />
                  <Text style={s.playAllText}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            {loadingRecs ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              recommendations.slice(0, 5).map((item) => renderRecommendationTrack(item))
            )}
          </View>
        )}

        {/* 4. Mood Chips & Tracks */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Mood</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: 10 }}>
            {MOOD_CARDS.map((mood) => (
              <TouchableOpacity key={mood.key} onPress={() => handleMoodSelect(mood.key)} activeOpacity={0.8}>
                <LinearGradient
                  colors={selectedMood === mood.key ? mood.gradient : [COLORS.surfaceLight, COLORS.surfaceLight]}
                  style={[s.moodChip, selectedMood === mood.key && s.moodChipActive]}
                >
                  <Ionicons name={mood.icon} size={18}
                    color={selectedMood === mood.key ? '#FFF' : COLORS.textSecondary} />
                  <Text style={[s.moodChipText, selectedMood === mood.key && { color: '#FFF' }]}>
                    {mood.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {selectedMood && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitleInline}>{moodLabel}</Text>
              {moodTracks.length > 0 && (
                <TouchableOpacity onPress={() => playAll(moodTracks)}>
                  <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllChip}>
                    <Ionicons name="play" size={12} color="#FFF" />
                    <Text style={s.playAllText}>Play All</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            {loadingMood ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />
            ) : (
              <FlatList
                data={moodTracks.slice(0, 6)}
                horizontal showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => 'mood_' + item.id}
                contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
                renderItem={renderTrackCard}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={3}
                removeClippedSubviews={true}
              />
            )}
          </View>
        )}

        {/* 5. Recently Played (Skip the first one since it is in Jump Back In) */}
        {history.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recently Played</Text>
            <FlatList
              data={history.slice(1, 10)}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item, i) => 'recent_' + item.id + '_' + i}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={renderTrackCard}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={true}
            />
          </View>
        )}

        {/* 6. Trending Now */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitleInline}>Trending Now</Text>
            {trending.length > 0 && (
              <TouchableOpacity onPress={() => playAll(trending)}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllChip}>
                  <Ionicons name="play" size={12} color="#FFF" />
                  <Text style={s.playAllText}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          {loadingTrending ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            trending.slice(0, 5).map((item, i) => renderTrendingTrack(item, i))
          )}
        </View>

        {/* 7. New Releases */}
        {newReleases.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>New Releases</Text>
            <FlatList
              data={newReleases}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => 'new_' + item.id}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={renderTrackCard}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={true}
            />
          </View>
        )}

        {/* 8. Based on Your Artists */}
        {artistBasedTracks.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitleInline}>Based on {artistBasedName}</Text>
              <TouchableOpacity onPress={() => playAll(artistBasedTracks)}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllChip}>
                  <Ionicons name="play" size={12} color="#FFF" />
                  <Text style={s.playAllText}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <FlatList
              data={artistBasedTracks}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => 'artist_' + item.id}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={renderTrackCard}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={true}
            />
          </View>
        )}

        {/* Empty State */}
        {history.length === 0 && trending.length === 0 && !loadingTrending && (
          <View style={s.emptyState}>
            <Ionicons name="headset-outline" size={64} color={COLORS.textMuted} />
            <Text style={s.emptyTitle}>Start Listening</Text>
            <Text style={s.emptySub}>Search for a song and start your session.</Text>
          </View>
        )}
      </ScrollView>

      {/* Playlist Action Sheet Modal */}
      <Modal visible={showActions} transparent animationType="slide" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={s.actionSheet}>
            <View style={s.actionHeader}>
              <Text style={s.actionTitle}>Add to Playlist</Text>
              <TouchableOpacity onPress={() => setShowActions(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {playlists.map(pl => (
                <TouchableOpacity key={pl.id} style={s.actionItem} onPress={() => handleAddToPlaylist(pl.id)}>
                  <Ionicons name="musical-notes" size={20} color={COLORS.textSecondary} />
                  <Text style={s.actionText}>{pl.name}</Text>
                </TouchableOpacity>
              ))}
              {/* Create new playlist inline */}
              {showNewPlaylist ? (
                <View style={s.inlineCreate}>
                  <TextInput
                    style={s.inlineInput}
                    value={newPlaylistName}
                    onChangeText={setNewPlaylistName}
                    placeholder="Playlist name..."
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[s.inlineBtn, { backgroundColor: COLORS.surfaceElevated }]}
                      onPress={() => setShowNewPlaylist(false)}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.inlineBtn, { backgroundColor: COLORS.primary }]}
                      onPress={handleCreateAndAdd}>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={s.actionItem} onPress={() => setShowNewPlaylist(true)}>
                  <Ionicons name="add-circle-outline" size={22} color={COLORS.secondary} />
                  <Text style={[s.actionText, { color: COLORS.secondary }]}>Create New Playlist</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 160 },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 70 : 54,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  logoSlash: {
    fontSize: 28, fontWeight: '900', color: '#FFF',
    marginTop: -2,
  },
  brandName: {
    fontSize: 26, fontWeight: '900', color: '#FFF',
    letterSpacing: 1.5,
  },
  subGreeting: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  settingsBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: '#FFF', fontSize: 20, fontWeight: '700',
    marginBottom: SPACING.lg, paddingHorizontal: SPACING.xl,
  },
  sectionTitleInline: {
    color: '#FFF', fontSize: 20, fontWeight: '700',
    marginBottom: 0, paddingHorizontal: 0,
  },
  playAllChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
  },
  playAllText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  moodChipActive: { borderColor: 'transparent' },
  moodChipText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  trackCard: { width: 140 },
  trackCardArtWrap: {
    width: 140, height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 10,
  },
  trackCardArt: { width: '100%', height: '100%' },
  trackCardArtPlaceholder: {
    backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center',
  },
  trackCardTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 3 },
  trackCardArtist: { color: COLORS.textSecondary, fontSize: 12 },
  addBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center', marginLeft: 6,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  // Action sheet for playlists
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  actionTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  inlineCreate: { backgroundColor: COLORS.surfaceLight, padding: 16, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  inlineInput: { backgroundColor: COLORS.surfaceElevated, color: '#FFF', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 14 },
  inlineBtn: { flex: 1, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  
  // Jump Back In Banner
  jumpBanner: { height: 90, borderRadius: 18, overflow: 'hidden', ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  jumpBlur: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  jumpGradient: { ...StyleSheet.absoluteFillObject },
  jumpContent: { flexDirection: 'row', alignItems: 'center', padding: 12, flex: 1 },
  jumpArtWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  jumpArt: { width: '100%', height: '100%' },
  jumpTextWrap: { flex: 1, marginLeft: 16, marginRight: 12 },
  jumpTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  jumpArtist: { color: COLORS.textPrimary, fontSize: 13, opacity: 0.8 },
  jumpPlayBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', ...SHADOWS.button },
});