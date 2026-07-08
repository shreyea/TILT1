import { useTheme } from '../context/ThemeContext';
import React, { useMemo,  useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, StatusBar, Keyboard, Alert, Platform,
  Modal, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  searchSongs, toggleLike, getPlaylists, addToPlaylist,
  createPlaylist, getArtistTracks
} from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';
export default function SearchScreen() {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);


  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [artistTracks, setArtistTracks] = useState([]);
  const [artistName, setArtistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const debounceRef = useRef(null);
  const { playTrack, addToQueue, currentTrack, playAll } = usePlayer();
  // ─── Live search suggestions as user types ───────────────
  const onQueryChange = useCallback((text) => {
    setQuery(text);
    
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchSongs(text.trim());
        setSuggestions(data.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  }, []);
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    setSuggestions([]);
    try {
      const data = await searchSongs(query.trim());
      setResults(data);
      // Also try to get artist-based results
      const firstArtist = data[0]?.artist?.split(',')[0]?.trim();
      if (firstArtist) {
        setArtistName(firstArtist);
        const at = await getArtistTracks(firstArtist, 10);
        // Filter out duplicates from main results
        const resultIds = new Set(data.map(d => d.id));
        setArtistTracks(at.filter(t => !resultIds.has(t.id)).slice(0, 6));
      } else {
        setArtistTracks([]);
      }
    } catch (err) {
      Alert.alert('Search Failed', 'Could not connect to the server. Make sure the backend is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);
  const handleSuggestionPress = (track) => {

    setSuggestions([]);
    setQuery(track.title + ' ' + track.artist);
    playTrack(track);
  };
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
  const handleLike = async () => {
    if (!selectedTrack) return;
    const liked = await toggleLike(selectedTrack);
    setShowActions(false);
    if (liked !== null) {
      Alert.alert(liked ? 'Liked' : 'Removed', liked
        ? `"${selectedTrack.title}" added to Liked Songs.`
        : `"${selectedTrack.title}" removed from Liked Songs.`
      );
    }
  };
  const clearSearch = () => {

    setQuery('');
    setResults([]);
    setSuggestions([]);
    setSearched(false);
    setArtistTracks([]);
    setArtistName('');
  };
  // ─── Render ──────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LinearGradient colors={[COLORS.primaryDark + '30', COLORS.background]} style={s.header}>
        <Text style={s.headerTitle}>Search</Text>
        <Text style={s.headerSub}>Find any song, ad-free</Text>
        <View style={s.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.input} value={query} onChangeText={onQueryChange}
            onSubmitEditing={handleSearch} placeholder="What do you want to listen to?"
            placeholderTextColor={COLORS.textMuted} returnKeyType="search"
          />
          {loadingSuggestions && (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
          )}
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
      {/* Live suggestions dropdown */}
      {suggestions.length > 0 && !searched && (
        <View style={s.suggestionsBox}>
          {suggestions.map((item, i) => (
            <TouchableOpacity
              key={item.id + '_sug_' + i}
              style={s.suggestionItem}
              onPress={() => handleSuggestionPress(item)}
            >
              {item.art_url_small ? (
                <Image source={{ uri: item.art_url_small }} style={s.suggestionArt} />
              ) : (
                <View style={[s.suggestionArt, s.suggestionArtPH]}>
                  <Ionicons name="musical-notes" size={14} color={COLORS.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.suggestionTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.suggestionArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          {/* Search all button */}
          <TouchableOpacity style={s.suggestionSearchAll} onPress={handleSearch}>
            <Ionicons name="search" size={16} color={COLORS.primary} />
            <Text style={s.suggestionSearchAllText}>See all results for "{query}"</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={s.loadingText}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          ListHeaderComponent={() => (
            <View style={s.resultsBar}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>{results.length} results</Text>
              <TouchableOpacity onPress={() => playAll(results)}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllBtn}>
                  <Ionicons name="play" size={14} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => (
            <TrackItem track={item} onPress={playTrack} isPlaying={currentTrack?.id === item.id}
              onLongPress={handleLongPress}
              rightAction={
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => handleLongPress(item)} style={s.queueBtn}>
                    <Ionicons name="list" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => addToQueue(item)} style={s.queueBtn}>
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              }
            />
          )}
          ListFooterComponent={() => (
            artistTracks.length > 0 ? (
              <View style={s.artistSection}>
                <Text style={s.artistSectionTitle}>More from {artistName}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.lg }}>
                  {artistTracks.map((item) => (
                    <TouchableOpacity key={'artist_' + item.id} style={s.artistCard}
                      activeOpacity={0.7} onPress={() => playTrack(item)}>
                      <View style={s.artistCardArtWrap}>
                        {item.art_url ? (
                          <Image source={{ uri: item.art_url }} style={s.artistCardArt} />
                        ) : (
                          <View style={[s.artistCardArt, s.artistCardArtPH]}>
                            <Ionicons name="musical-notes" size={28} color={COLORS.textMuted} />
                          </View>
                        )}
                      </View>
                      <Text style={s.artistCardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.artistCardArtist} numberOfLines={1}>{item.artist}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          )}
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={s.center}>
          <Ionicons name={searched ? "search" : "headset"} size={64} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
          <Text style={s.emptyTitle}>{searched ? 'No results found' : 'Search for music'}</Text>
          <Text style={s.emptySub}>{searched ? 'Try a different search' : 'Search any song and stream it instantly'}</Text>
        </View>
      )}
      {/* Track Actions Modal */}
      <Modal visible={showActions} transparent animationType="fade"
        onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={s.actionOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={s.actionSheet}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {selectedTrack && (
                <>
                  <Text style={s.actionTrackTitle} numberOfLines={1}>{selectedTrack.title}</Text>
                  <Text style={s.actionTrackArtist} numberOfLines={1}>{selectedTrack.artist}</Text>
                  <View style={s.actionDivider} />
                  <TouchableOpacity style={s.actionItem} onPress={handleLike}>
                    <Ionicons name="heart-outline" size={22} color="#EF4444" />
                    <Text style={s.actionText}>Like Song</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionItem} onPress={() => { addToQueue(selectedTrack); setShowActions(false); }}>
                    <Ionicons name="list" size={22} color={COLORS.primary} />
                    <Text style={s.actionText}>Add to Queue</Text>
                  </TouchableOpacity>
                  <View style={s.actionDivider} />
                  <Text style={s.actionSectionLabel}>Add to Playlist</Text>
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
                </>
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
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight,
    borderRadius: 14, paddingHorizontal: 16, height: 50,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  input: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500' },
  // Live suggestions
  suggestionsBox: {
    marginHorizontal: 16, backgroundColor: COLORS.surface,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder,
    overflow: 'hidden', marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  suggestionArt: { width: 36, height: 36, borderRadius: 6 },
  suggestionArtPH: { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  suggestionTitle: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  suggestionArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  suggestionSearchAll: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  suggestionSearchAllText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 12 },
  resultsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  queueBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  // Artist section
  artistSection: { marginTop: 24, marginBottom: 20 },
  artistSectionTitle: {
    color: '#FFF', fontSize: 20, fontWeight: '700',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },
  artistCard: { width: 130 },
  artistCardArtWrap: { width: 130, height: 130, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  artistCardArt: { width: '100%', height: '100%' },
  artistCardArtPH: { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  artistCardTitle: { color: '#FFF', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  artistCardArtist: { color: COLORS.textSecondary, fontSize: 11 },
  // Action sheet
  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1, borderColor: COLORS.cardBorder, borderBottomWidth: 0,
    maxHeight: '65%',
  },
  actionTrackTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  actionTrackArtist: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  actionDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 14 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4 },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  actionSectionLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  inlineCreate: {
    backgroundColor: COLORS.surfaceElevated, borderRadius: 12,
    padding: 14, marginTop: 8,
  },
  inlineInput: {
    backgroundColor: COLORS.surfaceLight, color: '#FFF', borderRadius: 8,
    paddingHorizontal: 14, height: 40, fontSize: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  inlineBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
});