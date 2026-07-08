import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
  StatusBar, Platform, ActivityIndicator, Modal, ScrollView,
  TextInput, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayer } from '../context/PlayerContext';
import { toggleLike, checkLiked, getPlaylists, addToPlaylist, createPlaylist } from '../api';
import AudioSettingsScreen from './AudioSettingsScreen';
import { SPACING } from '../theme';
const { width: W, height: H } = Dimensions.get('window');
function fmt(ms) {
  if (!ms || ms < 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
// Parse "[mm:ss.xx] text" LRC format into [{time: ms, text: string}]
function parseSyncedLyrics(lrc) {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      let ms = parseInt(match[3], 10);
      if (match[3].length === 2) ms *= 10;
      const timeMs = min * 60000 + sec * 1000 + ms;
      const text = match[4].trim();
      if (text) parsed.push({ time: timeMs, text });
    }
  }
  return parsed;
}
export default function NowPlayingScreen({ onClose }) {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);


  const {
    currentTrack, isPlaying, isLoading, position, duration,
    volume, repeatMode, shuffleOn,
    togglePlay, seekTo, changeVolume, playNext, playPrevious,
    toggleShuffle, cycleRepeat, addToQueue,
  } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [syncedLines, setSyncedLines] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lyricsError, setLyricsError] = useState(null);
  // Playlist modal state
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const lyricsScrollRef = useRef(null);
  const lineRefs = useRef({});
  const lastScrolledLine = useRef(-1);
  useEffect(() => {
    if (currentTrack?.id) {
      checkLiked(currentTrack.id).then(setLiked);
    }
  }, [currentTrack?.id]);
  const handleLike = async () => {
    if (!currentTrack) return;
    const nowLiked = await toggleLike(currentTrack);
    if (nowLiked !== null) setLiked(nowLiked);
  };
  // Reset lyrics when track changes
  useEffect(() => {
    setShowLyrics(false);
    setSyncedLines([]);
    setPlainLyrics(null);
    setLyricsError(null);
    lastScrolledLine.current = -1;
  }, [currentTrack?.id]);
  // Fetch lyrics from lrclib
  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    setLoadingLyrics(true);
    setLyricsError(null);
    
    try {
      let data = null;
      const res = await fetch(
        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(currentTrack.artist)}&track_name=${encodeURIComponent(currentTrack.title)}`
      );
      
      if (res.ok) {
        data = await res.json();
      } else {
        const q = `${currentTrack.artist} ${currentTrack.title}`
          .replace(/\[.*?\]|\(.*?\)/g, '').trim();
        const searchRes = await fetch(
          `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData?.length > 0) data = searchData[0];
        }
      }
      if (!data) {
        setLyricsError('Lyrics not available');
        return;
      }
      
      if (data.syncedLyrics) {
        const parsed = parseSyncedLyrics(data.syncedLyrics);
        setSyncedLines(parsed);
        setPlainLyrics(null);
      } else if (data.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
        setSyncedLines([]);
      } else {
        setLyricsError('No lyrics found');
      }
    } catch (e) {
      setLyricsError('Failed to load lyrics');
    } finally {
      setLoadingLyrics(false);
    }
  }, [currentTrack]);
  const handleToggleLyrics = async () => {
    if (showLyrics) {
      setShowLyrics(false);
      return;
    }
    setShowLyrics(true);
    if (!syncedLines.length && !plainLyrics && !lyricsError) {
      await fetchLyrics();
    }
  };
  // Find the current active line based on position
  const activeLineIndex = useMemo(() => {
    if (!syncedLines.length) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (position >= syncedLines[i].time) idx = i;
      else break;
    }
    return idx;
  }, [position, syncedLines]);
  // Auto-scroll lyrics to current line
  useEffect(() => {
    if (!showLyrics || activeLineIndex < 0 || activeLineIndex === lastScrolledLine.current) return;
    lastScrolledLine.current = activeLineIndex;
    
    if (lyricsScrollRef.current) {
      // Scroll to put active line roughly in center. Each line ~52px, center offset ~ART_SIZE/2
      const yOffset = Math.max(0, activeLineIndex * 52 - ART_SIZE / 2 + 40);
      lyricsScrollRef.current.scrollTo({ y: yOffset, animated: true });
    }
  }, [activeLineIndex, showLyrics]);
  // Playlist modal handlers
  const handleOpenPlaylistModal = async () => {
    const pls = await getPlaylists();
    setPlaylists(pls);
    setShowPlaylist(true);
  };
  const handleAddToPlaylist = async (playlistId) => {
    if (!currentTrack) return;
    try {
      await addToPlaylist(playlistId, currentTrack);
      setShowPlaylist(false);
      Alert.alert('Added', `"${currentTrack.title}" added to playlist.`);
    } catch (e) {
      Alert.alert('Error', 'Could not add to playlist.');
    }
  };
  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim() || !currentTrack) return;
    try {
      const created = await createPlaylist(newPlaylistName.trim());
      await addToPlaylist(created.id, currentTrack);
      setNewPlaylistName('');
      setShowNewPlaylist(false);
      setShowPlaylist(false);
      Alert.alert('Done', `Created "${newPlaylistName}" and added the track.`);
    } catch {
      Alert.alert('Error', 'Could not create playlist.');
    }
  };
  if (!currentTrack) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="musical-notes-outline" size={64} color={COLORS.textMuted} />
        <Text style={{ color: COLORS.textSecondary, fontSize: 16, marginTop: 16 }}>No track playing</Text>
      </View>
    );
  }
  const getRepeatIcon = () => {

    if (repeatMode === 'off') return 'repeat-outline';
    if (repeatMode === 'one') return 'sync';
    return 'repeat';
  };
  const progress = duration > 0 ? position / duration : 0;
  // Render synced lyrics with highlight
  const renderSyncedLyrics = () => (
    <ScrollView
      ref={lyricsScrollRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ART_SIZE * 0.3, paddingHorizontal: 8 }}
    >
      {syncedLines.map((line, i) => {
        const isActive = i === activeLineIndex;
        const isPast = i < activeLineIndex;
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => seekTo(line.time)}
            style={{ paddingVertical: 10 }}
          >
            <Text style={[
              s.lyricsLine,
              isPast && s.lyricsLinePast,
              isActive && s.lyricsLineActive,
            ]}>
              {line.text}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Background: blurred album art */}
      {currentTrack.art_url && (
        <Image
          source={{ uri: currentTrack.art_url }}
          style={s.bgArt}
          blurRadius={60}
        />
      )}
      <View style={s.bgOverlay} />
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onClose} style={s.topBtn}>
          <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={s.topLabel}>Now Playing</Text>
        <TouchableOpacity onPress={() => setShowAudioSettings(true)} style={s.topBtn}>
          <Ionicons name="options-outline" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      {/* Album Art or Synced Lyrics */}
      <View style={s.artWrap}>
        {showLyrics ? (
          <View style={[s.art, s.lyricsContainer]}>
            {loadingLyrics ? (
              <View style={s.lyricsCentered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 12 }}>Loading lyrics…</Text>
              </View>
            ) : lyricsError ? (
              <View style={s.lyricsCentered}>
                <Ionicons name="document-text-outline" size={40} color={COLORS.textMuted} />
                <Text style={s.lyricsErrorText}>{lyricsError}</Text>
              </View>
            ) : syncedLines.length > 0 ? (
              renderSyncedLyrics()
            ) : plainLyrics ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20 }}
              >
                <Text style={s.lyricsPlainText}>{plainLyrics}</Text>
              </ScrollView>
            ) : null}
          </View>
        ) : currentTrack.art_url ? (
          <Image source={{ uri: currentTrack.art_url }} style={s.art} />
        ) : (
          <View style={[s.art, s.artPlaceholder]}>
            <Ionicons name="musical-notes" size={80} color={COLORS.primary} />
          </View>
        )}
      </View>
      {/* Track Info + Like */}
      <View style={s.infoRow}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={s.title} numberOfLines={2}>{currentTrack.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity onPress={handleLike} style={s.likeBtn}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? '#EF4444' : 'rgba(255,255,255,0.5)'}
          />
        </TouchableOpacity>
      </View>
      {/* Seek bar */}
      <View style={s.seekSection}>
        <Slider
          style={s.slider}
          minimumValue={0} maximumValue={duration || 1}
          value={position} onSlidingComplete={seekTo}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor="rgba(255,255,255,0.15)"
          thumbTintColor="#FFF"
        />
        <View style={s.timeRow}>
          <Text style={s.time}>{fmt(position)}</Text>
          <Text style={s.time}>{fmt(duration)}</Text>
        </View>
      </View>
      {/* Controls */}
      <View style={s.controlRow}>
        <TouchableOpacity onPress={toggleShuffle} style={s.sideBtn}>
          <Ionicons name="shuffle" size={24} color={shuffleOn ? COLORS.primary : 'rgba(255,255,255,0.4)'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={playPrevious} style={s.skipBtn}>
          <Ionicons name="play-skip-back" size={30} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={s.playBtn}>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.playGrad}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#FFF" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#FFF"
                style={{ marginLeft: isPlaying ? 0 : 3 }} />
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={playNext} style={s.skipBtn}>
          <Ionicons name="play-skip-forward" size={30} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat} style={s.sideBtn}>
          <Ionicons name={getRepeatIcon()} size={24}
            color={repeatMode !== 'off' ? COLORS.primary : 'rgba(255,255,255,0.4)'} />
        </TouchableOpacity>
      </View>
      {/* Volume */}
      <View style={s.volumeRow}>
        <Ionicons name="volume-low" size={16} color="rgba(255,255,255,0.3)" />
        <Slider
          style={{ flex: 1, marginHorizontal: 8 }}
          minimumValue={0} maximumValue={1} step={0.01}
          value={volume} onValueChange={changeVolume}
          minimumTrackTintColor="rgba(255,255,255,0.5)"
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="rgba(255,255,255,0.8)"
        />
        <Ionicons name="volume-high" size={16} color="rgba(255,255,255,0.3)" />
      </View>
      {/* Bottom actions */}
      <View style={s.bottomRow}>
        <TouchableOpacity onPress={handleOpenPlaylistModal} style={s.bottomBtn}>
          <Ionicons name="add-circle-outline" size={22} color="rgba(255,255,255,0.5)" />
          <Text style={s.bottomBtnText}>Playlist</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleToggleLyrics} style={s.bottomBtn}>
          <Ionicons name="document-text-outline" size={22} color={showLyrics ? COLORS.primary : 'rgba(255,255,255,0.5)'} />
          <Text style={[s.bottomBtnText, showLyrics && { color: COLORS.primary }]}>Lyrics</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => addToQueue(currentTrack)} style={s.bottomBtn}>
          <Ionicons name="list-outline" size={22} color="rgba(255,255,255,0.5)" />
          <Text style={s.bottomBtnText}>Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAudioSettings(true)} style={s.bottomBtn}>
          <Ionicons name="options-outline" size={22} color="rgba(255,255,255,0.5)" />
          <Text style={s.bottomBtnText}>Audio</Text>
        </TouchableOpacity>
      </View>
      {/* Audio Settings Modal */}
      <Modal visible={showAudioSettings} animationType="slide" transparent={false}
        onRequestClose={() => setShowAudioSettings(false)}>
        <AudioSettingsScreen onClose={() => setShowAudioSettings(false)} />
      </Modal>
      {/* Playlist Selection Modal */}
      <Modal visible={showPlaylist} transparent animationType="slide"
        onRequestClose={() => setShowPlaylist(false)}>
        <TouchableOpacity style={s.plOverlay} activeOpacity={1} onPress={() => setShowPlaylist(false)}>
          <View style={s.plSheet}>
            <View style={s.plHandle} />
            <Text style={s.plSheetTitle}>Add to Playlist</Text>
            
            <ScrollView style={{ maxHeight: H * 0.4 }}>
              {playlists.map(pl => (
                <TouchableOpacity key={pl.id} style={s.plItem} onPress={() => handleAddToPlaylist(pl.id)}>
                  <View style={s.plItemIcon}>
                    <Ionicons name="musical-notes" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={s.plItemText}>{pl.name}</Text>
                  <Ionicons name="add" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
              {showNewPlaylist ? (
                <View style={s.plNewWrap}>
                  <TextInput
                    style={s.plNewInput}
                    value={newPlaylistName}
                    onChangeText={setNewPlaylistName}
                    placeholder="Playlist name…"
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[s.plNewBtn, { backgroundColor: COLORS.surfaceElevated }]}
                      onPress={() => setShowNewPlaylist(false)}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.plNewBtn, { backgroundColor: COLORS.primary }]}
                      onPress={handleCreateAndAdd}>
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={s.plItem} onPress={() => setShowNewPlaylist(true)}>
                  <View style={[s.plItemIcon, { backgroundColor: COLORS.primary + '20' }]}>
                    <Ionicons name="add" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={[s.plItemText, { color: COLORS.primary }]}>New Playlist</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const ART_SIZE = W * 0.72;
const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  
  // Background
  bgArt: {
    ...StyleSheet.absoluteFillObject,
    width: W, height: H,
    opacity: 0.35,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,15,0.65)',
  },
  // Top bar
  topBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40,
    left: 20, right: 20, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  topBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  topLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  // Art
  artWrap: { borderRadius: 24, marginBottom: 28, overflow: 'hidden', ...SHADOWS.card },
  art: { width: ART_SIZE, height: ART_SIZE, borderRadius: 24 },
  artPlaceholder: {
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  // Info
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 36, marginBottom: 16, width: '100%',
  },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 15, marginTop: 3 },
  likeBtn: { padding: 10 },
  // Seek
  seekSection: { width: W - 64, marginBottom: 4 },
  slider: { width: '100%', height: 28 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '500' },
  // Controls
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  sideBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  skipBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  playBtn: { borderRadius: 36, ...SHADOWS.button },
  playGrad: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  // Volume
  volumeRow: { flexDirection: 'row', alignItems: 'center', width: W - 88, marginBottom: 8 },
  // Bottom
  bottomRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 28,
    position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20,
  },
  bottomBtn: { alignItems: 'center', gap: 3 },
  bottomBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600' },
  // Lyrics
  lyricsContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
  },
  lyricsCentered: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  lyricsErrorText: {
    color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center',
  },
  lyricsLine: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 18,
    lineHeight: 32,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  lyricsLinePast: {
    color: 'rgba(255,255,255,0.35)',
  },
  lyricsLineActive: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  lyricsPlainText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Playlist modal
  plOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  plSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  plHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 20,
  },
  plSheetTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  plItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  plItemIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  plItemText: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '500' },
  plNewWrap: {
    backgroundColor: COLORS.surfaceLight,
    padding: 16, borderRadius: 14, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  plNewInput: {
    backgroundColor: COLORS.surfaceElevated, color: '#FFF',
    borderRadius: 10, paddingHorizontal: 14, height: 42, fontSize: 14,
  },
  plNewBtn: { flex: 1, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});