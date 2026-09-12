// src/components/TrackActionSheet.js
// One sheet for every "what do I do with this song?" action, shared by Home,
// Search, Library and Queue.
//
// It replaces a pair of cramped icon buttons that sat inside a pressable row —
// those were ambiguous (a list glyph that meant "playlist", a plus that meant
// "queue") and their taps leaked through to the row and started playback.
// A single labelled sheet is unambiguous and gives every action a full-width
// target.
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '../context/PlayerContext';
import { useTheme } from '../context/ThemeContext';
import { trackArt } from '../utils/trackArt';
import * as Storage from '../services/StorageService';

export default function TrackActionSheet({ track, visible, onClose }) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);
  const { addToQueue, playTrack } = usePlayer();

  const [view, setView] = useState('actions'); // actions | playlists | newPlaylist
  const [playlists, setPlaylists] = useState([]);
  const [liked, setLiked] = useState(false);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!visible || !track) return;
    setView('actions');
    setNewName('');
    setToast(null);
    Storage.getLikedSongs()
      .then(songs => setLiked(songs.some(t => t.id === track.id)))
      .catch(() => {});
  }, [visible, track?.id]);

  const buzz = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const finish = useCallback((message) => {
    buzz();
    setToast(message);
    setTimeout(onClose, 450);
  }, [buzz, onClose]);

  const handleQueue = useCallback(() => {
    addToQueue(track);
    finish('Added to queue');
  }, [addToQueue, track, finish]);

  const handlePlayNow = useCallback(() => {
    playTrack(track);
    finish('Playing');
  }, [playTrack, track, finish]);

  const handleLike = useCallback(async () => {
    const songs = await Storage.getLikedSongs();
    const isLiked = songs.some(t => t.id === track.id);
    await Storage.saveLikedSongs(
      isLiked ? songs.filter(t => t.id !== track.id) : [track, ...songs]
    );
    setLiked(!isLiked);
    finish(isLiked ? 'Removed from Liked' : 'Added to Liked');
  }, [track, finish]);

  const openPlaylists = useCallback(async () => {
    buzz();
    setPlaylists(await Storage.getPlaylists());
    setView('playlists');
  }, [buzz]);

  const addToPlaylist = useCallback(async (playlistId) => {
    const existing = await Storage.getPlaylistTracks(playlistId);
    if (!existing.some(t => t.id === track.id)) {
      await Storage.savePlaylistTracks(playlistId, [...existing, track]);
      const all = await Storage.getPlaylists();
      const i = all.findIndex(p => p.id === playlistId);
      if (i >= 0) {
        all[i].track_count = existing.length + 1;
        if (!all[i].cover_url) all[i].cover_url = trackArt(track);
        await Storage.savePlaylists(all);
      }
      finish('Added to playlist');
    } else {
      finish('Already in playlist');
    }
  }, [track, finish]);

  const createAndAdd = useCallback(async () => {
    if (!newName.trim()) return;
    const id = 'local_' + Date.now();
    const all = await Storage.getPlaylists();
    await Storage.savePlaylists([
      ...all,
      { id, name: newName.trim(), track_count: 1, cover_url: trackArt(track) },
    ]);
    await Storage.savePlaylistTracks(id, [track]);
    finish(`Added to "${newName.trim()}"`);
  }, [newName, track, finish]);

  if (!track) return null;

  const art = trackArt(track, { small: true });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.grabber} />

          {/* Which song this is about */}
          <View style={s.header}>
            {art ? (
              <View style={s.artWrap}><Text style={s.artHidden} /></View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{track.title}</Text>
              <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
          </View>

          {toast ? (
            <View style={s.toast}>
              <Ionicons name="checkmark-circle" size={17} color={COLORS.primary} />
              <Text style={s.toastText}>{toast}</Text>
            </View>
          ) : view === 'actions' ? (
            <View>
              <Row icon="play" label="Play now" onPress={handlePlayNow} s={s} COLORS={COLORS} />
              <Row icon="albums-outline" label="Add to queue" onPress={handleQueue} s={s} COLORS={COLORS} />
              <Row icon="add-circle-outline" label="Add to playlist" onPress={openPlaylists} s={s} COLORS={COLORS} chevron />
              <Row
                icon={liked ? 'heart' : 'heart-outline'}
                label={liked ? 'Remove from Liked' : 'Add to Liked'}
                onPress={handleLike}
                tint={liked ? COLORS.liked : undefined}
                s={s}
                COLORS={COLORS}
              />
            </View>
          ) : view === 'playlists' ? (
            <View>
              <TouchableOpacity style={s.backRow} onPress={() => setView('actions')}>
                <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                <Text style={s.backText}>Add to playlist</Text>
              </TouchableOpacity>

              <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                <Row icon="add" label="New playlist" onPress={() => setView('newPlaylist')} tint={COLORS.primary} s={s} COLORS={COLORS} />
                {playlists.map(pl => (
                  <Row
                    key={pl.id}
                    icon="musical-notes-outline"
                    label={pl.name}
                    sublabel={`${pl.track_count || 0} tracks`}
                    onPress={() => addToPlaylist(pl.id)}
                    s={s}
                    COLORS={COLORS}
                  />
                ))}
                {playlists.length === 0 && (
                  <Text style={s.empty}>No playlists yet — create one above.</Text>
                )}
              </ScrollView>
            </View>
          ) : (
            <View>
              <TouchableOpacity style={s.backRow} onPress={() => setView('playlists')}>
                <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                <Text style={s.backText}>New playlist</Text>
              </TouchableOpacity>
              <TextInput
                style={s.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Playlist name"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createAndAdd}
              />
              <TouchableOpacity
                style={[s.createBtn, !newName.trim() && { opacity: 0.4 }]}
                onPress={createAndAdd}
                disabled={!newName.trim()}
              >
                <Text style={s.createBtnText}>Create and add</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Row({ icon, label, sublabel, onPress, tint, chevron, s, COLORS }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon} size={20} color={tint || COLORS.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, tint && { color: tint }]} numberOfLines={1}>{label}</Text>
        {!!sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 10,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 16, opacity: 0.5,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 14, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  artWrap: { width: 0, height: 0 },
  artHidden: { width: 0, height: 0 },
  title: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  artist: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  rowSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14 },
  backText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  empty: { color: COLORS.textMuted, fontSize: 13, paddingVertical: 18, textAlign: 'center' },

  input: {
    backgroundColor: COLORS.surfaceLight, color: COLORS.textPrimary,
    borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 15, marginTop: 4,
  },
  createBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 12,
  },
  createBtnText: { color: '#0A1A1E', fontSize: 15, fontWeight: '800' },

  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 26, justifyContent: 'center' },
  toastText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
});
