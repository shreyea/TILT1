import { useTheme } from '../context/ThemeContext';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, TextInput, Alert, Modal, Platform, Image,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { getRecommendations, searchSongs, getTrending } from '../api';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import SpotifyImportScreen from './SpotifyImportScreen';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';
import * as Storage from '../services/StorageService';

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
  const searchAbortControllerRef = useRef(null);

  // Load from Local Storage
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, liked] = await Promise.all([
        Storage.getPlaylists(),
        Storage.getLikedSongs()
      ]);
      setPlaylists(pl || []);
      setLikedSongs(liked || []);
    } catch (err) {
      console.warn('Failed to load local library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  
  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const loadTracks = useCallback(async (pl) => {
    setSelectedPlaylist(pl);
    try {
      const data = await Storage.getPlaylistTracks(pl.id);
      setTracks(data || []);
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
        const trending = await getTrending(10);
        setSuggestions(trending || []);
      } else {
        const seeds = tracks.slice(0, 5).map(t => t.id || t.spotify_id).filter(Boolean);
        if (seeds.length > 0) {
          const recs = await getRecommendations(seeds);
          setSuggestions(recs || []);
        } else {
          setSuggestions([]);
        }
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSearching(false);
    }
  }, [tracks]);

  const handleSearch = useCallback(async (text) => {
    setSearchQuery(text);
    
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchAbortControllerRef.current = new AbortController();
    
    try {
      const results = await searchSongs(text, searchAbortControllerRef.current.signal);
      setSearchResults(results || []);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn(e);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddTrackToPlaylist = useCallback(async (track) => {
    if (!selectedPlaylist) return;
    try {
      const existing = await Storage.getPlaylistTracks(selectedPlaylist.id);
      if (!existing.find(t => t.id === track.id)) {
        const updated = [...existing, track];
        await Storage.savePlaylistTracks(selectedPlaylist.id, updated);
        
        // Update playlist track count
        const allPls = await Storage.getPlaylists();
        const plIndex = allPls.findIndex(p => p.id === selectedPlaylist.id);
        if (plIndex >= 0) {
          allPls[plIndex].track_count = updated.length;
          // Set cover art if it's the first track
          if (updated.length === 1) {
             allPls[plIndex].cover_url = track.art_url_small || track.art_url;
          }
          await Storage.savePlaylists(allPls);
          setPlaylists(allPls);
        }
        
        setTracks(updated);
        Alert.alert('Added', `"${track.title}" added to playlist.`);
      } else {
        Alert.alert('Already Added', `"${track.title}" is already in this playlist.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to add track.');
    }
  }, [selectedPlaylist]);

  const handleRemoveTrack = useCallback(async (trackId) => {
    if (!selectedPlaylist) return;
    try {
      const existing = await Storage.getPlaylistTracks(selectedPlaylist.id);
      const updated = existing.filter(t => t.id !== trackId);
      await Storage.savePlaylistTracks(selectedPlaylist.id, updated);
      
      const allPls = await Storage.getPlaylists();
      const plIndex = allPls.findIndex(p => p.id === selectedPlaylist.id);
      if (plIndex >= 0) {
        allPls[plIndex].track_count = updated.length;
        if (updated.length === 0) {
           allPls[plIndex].cover_url = null;
        } else if (allPls[plIndex].cover_url === existing.find(t=>t.id===trackId)?.art_url_small) {
           allPls[plIndex].cover_url = updated[0].art_url_small || updated[0].art_url;
        }
        await Storage.savePlaylists(allPls);
        setPlaylists(allPls);
      }
      
      setTracks(updated);
    } catch (e) {
      Alert.alert('Error', 'Failed to remove track.');
    }
  }, [selectedPlaylist]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      const id = 'local_' + Date.now();
      const newPlaylist = { id, name: newName.trim(), track_count: 0 };
      
      const pls = await Storage.getPlaylists();
      await Storage.savePlaylists([...pls, newPlaylist]);
      
      setNewName('');
      setShowCreate(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Could not create playlist.');
    }
  }, [newName, loadData]);

  const handleDeletePlaylist = useCallback(async (pl) => {
    Alert.alert('Delete Playlist', `Are you sure you want to delete "${pl.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const pls = await Storage.getPlaylists();
          await Storage.savePlaylists(pls.filter(p => p.id !== pl.id));
          await Storage.removePlaylistTracks(pl.id);
          loadData();
        }
      },
    ]);
  }, [loadData]);
  
  // Memoized render items
  const renderLikedSong = useCallback(({ item, index }) => (
    <TrackItem
      track={item}
      onPress={() => playAll(likedSongs, index)}
      isPlaying={currentTrack?.id === item.id}
      showIndex={true} index={index}
    />
  ), [likedSongs, currentTrack?.id, playAll]);
  
  const renderSearchItem = useCallback(({ item }) => (
    <TrackItem
      track={item}
      onPress={() => playTrack(item)}
      rightAction={
        <TouchableOpacity onPress={() => handleAddTrackToPlaylist(item)} style={s.addTrackBtn}>
          <Ionicons name="add" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      }
    />
  ), [playTrack, handleAddTrackToPlaylist, COLORS.primary, s.addTrackBtn]);

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
          initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
          renderItem={renderLikedSong}
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
          <TouchableOpacity onPress={() => { setSelectedPlaylist(null); loadData(); }} style={s.backBtn}>
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
              await Storage.savePlaylistTracks(selectedPlaylist.id, data);
            } catch (e) {
              console.warn('Reorder failed', e);
            }
          }}
          renderItem={({ item, drag, isActive, getIndex }) => (
            <ScaleDecorator>
              <TrackItem track={item} onPress={() => playAll(tracks, getIndex())}
                isPlaying={currentTrack?.id === item.id}
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
        keyExtractor={(item) => item.type === 'liked' ? 'liked' : String(item.id)}
        initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
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
              initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={true}
              ListHeaderComponent={() => (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>
                    {searchQuery.length >= 2 ? 'Search Results' : 'Suggested for you'}
                  </Text>
                </View>
              )}
              renderItem={renderSearchItem}
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
