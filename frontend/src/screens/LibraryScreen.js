import { useTheme } from '../context/ThemeContext';
import React, { useMemo,  useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, TextInput, Alert, Modal, Platform, Image,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { 
  getPlaylists, getPlaylistTracks, createPlaylist, getLikedSongs, 
  deletePlaylist, getRecommendations, searchSongs, addToPlaylist,
  removeFromPlaylist, reorderPlaylistTracks, getTrending
} from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import SpotifyImportScreen from './SpotifyImportScreen';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';

export default function LibraryScreen() {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);



  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showLiked, setShowLiked] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSpotifyImport, setShowSpotifyImport] = useState(false);
  const { playTrack, currentTrack, playAll, addToQueue } = usePlayer();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, liked] = await Promise.all([getPlaylists(), getLikedSongs()]);
      setPlaylists(pl);
      setLikedSongs(liked);
    } catch (err) {
      Alert.alert('Error', 'Could not load library. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadTracks = useCallback(async (pl) => {
    setSelectedPlaylist(pl);
    try {
      const data = await getPlaylistTracks(pl.id);
      setTracks(data);
    } catch (err) {
      Alert.alert('Error', 'Could not load playlist tracks.');
      setTracks([]);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(true);
    try {
      if (!tracks || tracks.length === 0) {
        // If playlist is empty, recommend trending tracks
        const trending = await getTrending(10);
        setSuggestions(trending);
      } else {
        // Get up to 5 random seed tracks from the playlist
        const seeds = tracks.slice(0, 5).map(t => t.spotify_id);
        const recs = await getRecommendations(seeds);
        setSuggestions(recs);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSearching(false);
    }
  }, [tracks]);

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchSongs(text);
      setSearchResults(results);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrackToPlaylist = async (track) => {
    if (!selectedPlaylist) return;
    try {
      await addToPlaylist(selectedPlaylist.id, track);
      // Reload tracks
      const data = await getPlaylistTracks(selectedPlaylist.id);
      setTracks(data);
      Alert.alert('Added', `"${track.title}" added to playlist.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to add track.');
    }
  };

  const handleRemoveTrack = async (trackDbId) => {
    try {
      await removeFromPlaylist(trackDbId);
      setTracks(prev => prev.filter(t => t.id !== trackDbId));
    } catch (e) {
      Alert.alert('Error', 'Failed to remove track.');
    }
  };

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await createPlaylist(newName.trim());
      setNewName('');
      setShowCreate(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Could not create playlist. It may already exist.');
    }
  }, [newName, loadData]);

  const handleDeletePlaylist = useCallback(async (pl) => {
    Alert.alert('Delete Playlist', `Are you sure you want to delete "${pl.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePlaylist(pl.id);
          loadData();
        }
      },
    ]);
  }, [loadData]);

  // ─── Liked Songs View ──────────────────────────────────
  if (showLiked) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <LinearGradient colors={['#EF444460', COLORS.background]} style={s.plHeader}>
          <TouchableOpacity onPress={() => { setShowLiked(false); loadData(); }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={s.likedHeaderIcon}>
            <Ionicons name="heart" size={32} color="#EF4444" />
          </View>
          <Text style={s.plTitle}>Liked Songs</Text>
          <Text style={s.plSub}>{likedSongs.length} songs</Text>
          {likedSongs.length > 0 && (
            <TouchableOpacity onPress={() => playAll(likedSongs)} style={s.playAllBtn}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllGrad}>
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>Play All</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>
        <FlatList
          data={likedSongs} keyExtractor={i => String(i.id)}
          renderItem={({ item, index }) => (
            <TrackItem
              track={{ ...item, id: item.spotify_id }}
              onPress={() => playAll(likedSongs, index)}
              isPlaying={currentTrack?.id === item.spotify_id}
              showIndex={true} index={index}
            />
          )}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={s.emptyText}>No liked songs yet</Text>
              <Text style={s.emptySub}>Tap the heart on any song to save it here</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ─── Playlist Detail View ──────────────────────────────
  if (selectedPlaylist) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <LinearGradient colors={[COLORS.primary + '40', COLORS.background]} style={s.plHeader}>
          <TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          {/* Playlist cover */}
          <View style={s.plCoverWrap}>
            {selectedPlaylist.cover_url ? (
              <Image source={{ uri: selectedPlaylist.cover_url }} style={s.plCover} />
            ) : (
              <View style={[s.plCover, s.plCoverPlaceholder]}>
                <Ionicons name="musical-notes" size={40} color={COLORS.textSecondary} />
              </View>
            )}
          </View>
          <Text style={s.plTitle}>{selectedPlaylist.name}</Text>
          <Text style={s.plSub}>{tracks.length} tracks</Text>
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
            {tracks.length > 0 && (
              <TouchableOpacity onPress={() => playAll(tracks)} style={s.playAllBtn}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playAllGrad}>
                  <Ionicons name="play" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>Play All</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setShowAddModal(true); loadSuggestions(); }} style={[s.playAllBtn, { backgroundColor: COLORS.surfaceElevated }]}>
              <View style={s.playAllGrad}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>Add Songs</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <DraggableFlatList
          data={tracks}
          keyExtractor={i => String(i.id)}
          onDragEnd={async ({ data }) => {
            setTracks(data);
            try {
              const ids = data.map(t => t.id);
              await reorderPlaylistTracks(selectedPlaylist.id, ids);
            } catch (e) {
              console.warn('Reorder failed', e);
            }
          }}
          renderItem={({ item, drag, isActive, getIndex }) => (
            <ScaleDecorator>
              <TrackItem track={item} onPress={() => playAll(tracks, getIndex())}
                isPlaying={currentTrack?.id === item.spotify_id}
                drag={drag}
                isActive={isActive}
                rightAction={
                  <TouchableOpacity onPress={() => handleRemoveTrack(item.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                }
              />
            </ScaleDecorator>
          )}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="albums-outline" size={64} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={s.emptyText}>No tracks yet</Text>
              <Text style={s.emptySub}>Search and add songs to this playlist</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ─── Library Main View ────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LinearGradient colors={[COLORS.secondary + '20', COLORS.background]} style={s.header}>
        <Text style={s.headerTitle}>Your Library</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => setShowSpotifyImport(true)} style={[s.createBtn, { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1DB95420', borderWidth: 1, borderColor: '#1DB95440' }]}>
            <FontAwesome5 name="spotify" size={16} color="#1DB954" />
            <Text style={{ color: '#1DB954', fontSize: 12, fontWeight: '700' }}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={s.createBtn}>
            <Ionicons name="add" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={[{ type: 'liked' }, ...playlists.map(p => ({ type: 'playlist', ...p }))]}
        keyExtractor={(item, i) => item.type === 'liked' ? 'liked' : String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
        renderItem={({ item }) => {
          if (item.type === 'liked') {
            return (
              <TouchableOpacity style={s.plCard} onPress={() => setShowLiked(true)} activeOpacity={0.7}>
                <LinearGradient colors={['#EF444440', '#EF444420']} style={s.likedArt}>
                  <Ionicons name="heart" size={28} color="#EF4444" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.plName}>Liked Songs</Text>
                  <Text style={s.plCount}>{likedSongs.length} songs</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              style={s.plCard}
              onPress={() => loadTracks(item)} activeOpacity={0.7}
              onLongPress={() => handleDeletePlaylist(item)}
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={s.plArt} />
              ) : (
                <View style={[s.plArt, { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-notes" size={24} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.plName}>{item.name}</Text>
                <Text style={s.plCount}>{item.track_count || 0} tracks</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="library-outline" size={64} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
            <Text style={s.emptyText}>{loading ? 'Loading...' : 'No playlists yet'}</Text>
          </View>
        }
      />

      {/* Create Playlist Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>New Playlist</Text>
            <TextInput style={s.modalInput} value={newName} onChangeText={setNewName}
              placeholder="Playlist name" placeholderTextColor={COLORS.textMuted} autoFocus />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={[s.modalBtn, { backgroundColor: COLORS.surfaceElevated }]}>
                <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={[s.modalBtn, { backgroundColor: COLORS.primary }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Songs / Suggestions Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={s.addSongsModalOverlay}>
          <View style={s.addSongsModalContent}>
            <View style={s.addSongsHeader}>
              <Text style={s.addSongsTitle}>Add Songs</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={s.searchWrap}>
              <Ionicons name="search" size={20} color={COLORS.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search songs..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus={false}
              />
            </View>

            <FlatList
              data={searchQuery.length >= 2 ? searchResults : suggestions}
              keyExtractor={(item, index) => item.id + '_' + index}
              ListHeaderComponent={() => (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    {searchQuery.length >= 2 ? 'Search Results' : 'Suggested for you'}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TrackItem
                  track={item}
                  onPress={() => playTrack(item)}
                  rightAction={
                    <TouchableOpacity onPress={() => handleAddTrackToPlaylist(item)} style={s.addTrackBtn}>
                      <Ionicons name="add" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  }
                />
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={() => (
                <View style={s.center}>
                  {isSearching ? (
                    <Text style={s.emptySub}>Loading...</Text>
                  ) : (
                    <Text style={s.emptySub}>No results found</Text>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Spotify Import Modal */}
      <Modal visible={showSpotifyImport} animationType="slide" transparent={false}
        onRequestClose={() => setShowSpotifyImport(false)}>
        <SpotifyImportScreen
          onClose={() => setShowSpotifyImport(false)}
          onPlaylistCreated={async (playlist) => {
            setShowSpotifyImport(false);
            await loadData();
            // Navigate directly into the imported playlist
            loadTracks(playlist);
          }}
        />
      </Modal>
    </View>
  );
}

const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 20,
    paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: 34, fontWeight: '800', color: '#FFF' },
  createBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  plCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  plArt: { width: 56, height: 56, borderRadius: 12 },
  likedArt: {
    width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  plName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  plCount: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  plHeader: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { alignSelf: 'flex-start', paddingBottom: 12 },
  likedHeaderIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#EF444430',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  plCoverWrap: { marginBottom: 12 },
  plCover: { width: 100, height: 100, borderRadius: 16 },
  plCoverPlaceholder: { backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  plTitle: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  plSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  playAllBtn: { marginTop: 16, alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden' },
  playAllGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  emptySub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 24, width: '80%',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalInput: {
    backgroundColor: COLORS.surfaceLight, color: '#FFF', borderRadius: 10,
    paddingHorizontal: 16, height: 46, fontSize: 16, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addSongsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  addSongsModalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '80%' },
  addSongsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  addSongsTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, borderRadius: 12, paddingHorizontal: 16, height: 48, marginBottom: 16 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, marginLeft: 10 },
  addTrackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});
