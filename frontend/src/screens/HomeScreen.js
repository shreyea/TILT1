import { useTheme } from '../context/ThemeContext';
import React, { useMemo,  useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet,
  StatusBar, TouchableOpacity, ActivityIndicator, Platform, Image,
  RefreshControl, Modal, TextInput, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import { getRecommendations, getTrending, getNewReleases, getMoodTracks, getArtistTracks, getPlaylists, addToPlaylist, createPlaylist } from '../api';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';
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
  const handleLongPress = async (track) => {
    setSelectedTrack(track);
    const pls = await getPlaylists();
    setPlaylists(pls);
    setShowActions(true);
  };
  const handleAddToPlaylist = async (playlistId) => {
    if (!selectedTrack) return;
    await addToPlaylist(playlistId, selectedTrack);
    setShowActions(false);
    Alert.alert('Added', `"${selectedTrack.title}" added to playlist.`);
  };
  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim() || !selectedTrack) return;
    try {
      const created = await createPlaylist(newPlaylistName.trim());
      await addToPlaylist(created.id, selectedTrack);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
      setShowActions(false);
      Alert.alert('Done', `Created "${newPlaylistName}" and added the track.`);
    } catch {
      Alert.alert('Error', 'Could not create playlist.');
    }
  };
  const getTimeMood = () => {

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 17) return 'focus';
    if (hour >= 17 && hour < 21) return 'happy';
    return 'night';
  };
  const loadFeed = useCallback(async () => {
    setLoadingTrending(true);
    setLoadingReleases(true);
    const [t, nr] = await Promise.all([
      getTrending(15),
      getNewReleases(10),
    ]);
    setTrending(t);
    setNewReleases(nr);
    setLoadingTrending(false);
    setLoadingReleases(false);
    // Auto-load time-appropriate mood
    const autoMood = getTimeMood();
    setSelectedMood(autoMood);
    setLoadingMood(true);
    const mt = await getMoodTracks(autoMood, 10);
    setMoodTracks(mt);
    setLoadingMood(false);
  }, []);
  useEffect(() => { loadFeed(); }, [loadFeed]);
  useEffect(() => {
    async function loadRecs() {
      if (history.length > 0) {
        setLoadingRecs(true);
        const ids = history.slice(0, 3).map(t => t.id).filter(Boolean);
        if (ids.length > 0) {
          const recs = await getRecommendations(ids);
          setRecommendations(recs);
        }
        setLoadingRecs(false);
      }
    }
    loadRecs();
  }, [history.length]);
  // Load artist-based recommendations from listening history
  useEffect(() => {
    async function loadArtistRecs() {
      if (history.length > 0) {
        const topArtist = history[0]?.artist?.split(',')[0]?.trim();
        if (topArtist && topArtist !== artistBasedName) {
          setArtistBasedName(topArtist);
          const at = await getArtistTracks(topArtist, 8);
          // Filter out tracks already in history
          const histIds = new Set(history.map(h => h.id));
          setArtistBasedTracks(at.filter(t => !histIds.has(t.id)).slice(0, 6));
        }
      }
    }
    loadArtistRecs();
  }, [history.length]);
  const handleMoodSelect = async (mood) => {
    setSelectedMood(mood);
    setLoadingMood(true);
    const mt = await getMoodTracks(mood, 10);
    setMoodTracks(mt);
    setLoadingMood(false);
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };
  const getGreeting = () => {

    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const moodLabel = MOOD_CARDS.find(m => m.key === selectedMood)?.label || 'For You';
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
        {/* Mood Chips */}
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
        {/* Mood Tracks */}
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
                renderItem={({ item }) => (
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
                )}
              />
            )}
          </View>
        )}
        {/* Recently Played */}
        {history.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recently Played</Text>
            <FlatList
              data={history.slice(0, 10)}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item, i) => 'recent_' + item.id + '_' + i}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={({ item }) => (
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
              )}
            />
          </View>
        )}
        {/* Trending */}
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
            trending.slice(0, 5).map((item, i) => (
              <TrackItem
                key={'trend_' + item.id + '_' + i}
                track={item}
                onPress={playTrack}
                isPlaying={currentTrack?.id === item.id}
                showIndex={true} index={i}
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
            ))
          )}
        </View>
        {/* New Releases */}
        {newReleases.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>New Releases</Text>
            <FlatList
              data={newReleases}
              horizontal showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => 'new_' + item.id}
              contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.trackCard} activeOpacity={0.7} onPress={() => playTrack(item)}>
                  <View style={s.trackCardArtWrap}>
                    {item.art_url ? (
                      <Image source={{ uri: item.art_url }} style={s.trackCardArt} />
                    ) : (
                      <View style={[s.trackCardArt, s.trackCardArtPlaceholder]}>
                        <Ionicons name="disc-outline" size={36} color={COLORS.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text style={s.trackCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.trackCardArtist} numberOfLines={1}>{item.artist}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
        {/* Recommended For You */}
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
              recommendations.slice(0, 5).map((item) => (
                <TrackItem
                  key={'rec_' + item.id}
                  track={item}
                  onPress={playTrack}
                  isPlaying={currentTrack?.id === item.id}
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
              ))
            )}
          </View>
        )}
        {/* Based on Your Artists */}
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
              renderItem={({ item }) => (
                <TouchableOpacity style={s.trackCard} activeOpacity={0.7} onPress={() => playTrack(item)}>
                  <View style={s.trackCardArtWrap}>
                    {item.art_url ? (
                      <Image source={{ uri: item.art_url }} style={s.trackCardArt} />
                    ) : (
                      <View style={[s.trackCardArt, s.trackCardArtPlaceholder]}>
                        <Ionicons name="person" size={36} color={COLORS.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text style={s.trackCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.trackCardArtist} numberOfLines={1}>{item.artist}</Text>
                </TouchableOpacity>
              )}
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
  greeting: { fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
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
});