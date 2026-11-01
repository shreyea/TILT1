// src/screens/QueueScreen.js
// Up Next: drag to reorder, tap to jump, "..." to add a song to a playlist,
// and "Save" to turn the whole queue into a playlist.
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
  Modal, TextInput, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';
import TrackActionSheet from '../components/TrackActionSheet';
import EmptyState from '../components/EmptyState';
import * as Storage from '../services/StorageService';
import { trackArt } from '../utils/trackArt';

export default function QueueScreen() {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const {
    queue, currentTrack, playFromQueue, removeFromQueue, clearQueue, reorderQueue,
    shuffleOn, toggleShuffle, repeatMode, cycleRepeat, autoplayActive,
  } = usePlayer();

  const [sheetTrack, setSheetTrack] = useState(null);
  const [showSave, setShowSave] = useState(false);

  const rpt = repeatMode === 'one'
    ? { text: 'Repeat one', icon: 'sync' }
    : repeatMode === 'all'
      ? { text: 'Repeat all', icon: 'repeat' }
      : { text: 'Repeat off', icon: 'repeat-outline' };

  const renderItem = useCallback(({ item, drag, isActive, getIndex }) => {
    const index = getIndex?.() ?? 0;
    return (
      <ScaleDecorator>
        <TrackItem
          track={item}
          index={index}
          isActive={isActive}
          drag={drag}
          onPress={() => playFromQueue(index)}
          onMore={setSheetTrack}
          rightAction={
            <TouchableOpacity
              onPress={() => removeFromQueue(index)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={s.removeBtn}
            >
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          }
        />
      </ScaleDecorator>
    );
  }, [playFromQueue, removeFromQueue, s, COLORS.textMuted]);

  const header = (
    <View>
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.title}>Queue</Text>
          {(queue.length > 0 || currentTrack) && (
            <TouchableOpacity onPress={() => setShowSave(true)} style={s.saveBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={s.saveText}>Save as playlist</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.controls}>
          <Chip on={shuffleOn} icon="shuffle" label="Shuffle" onPress={toggleShuffle} s={s} COLORS={COLORS} />
          <Chip on={repeatMode !== 'off'} icon={rpt.icon} label={rpt.text} onPress={cycleRepeat} s={s} COLORS={COLORS} />
          {queue.length > 0 && (
            <TouchableOpacity onPress={clearQueue} style={s.chip} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={15} color={COLORS.error} />
              <Text style={[s.chipText, { color: COLORS.error }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {currentTrack && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Now playing</Text>
          <TrackItem track={currentTrack} isPlaying onPress={() => {}} onMore={setSheetTrack} />
        </View>
      )}

      <View style={[s.section, { marginBottom: 4 }]}>
        <Text style={s.sectionTitle}>
          Up next · {queue.length} {queue.length === 1 ? 'track' : 'tracks'}{autoplayActive ? ' · autoplay' : ''}
        </Text>
        {queue.length > 1 && <Text style={s.hint}>Hold the handle on the right and drag to reorder</Text>}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <DraggableFlatList
        data={queue}
        keyExtractor={(item, i) => `${item.id}_${i}`}
        renderItem={renderItem}
        onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
        onDragEnd={({ data }) => reorderQueue(data)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 150 }}
        ListEmptyComponent={
          <EmptyState
            compact
            icon="layers-outline"
            title="Nothing queued up"
            body="Tap the dots on any song and choose Add to queue to line up what plays next."
          />
        }
      />

      <TrackActionSheet track={sheetTrack} visible={!!sheetTrack} onClose={() => setSheetTrack(null)} />
      <SaveQueueModal
        visible={showSave}
        onClose={() => setShowSave(false)}
        tracks={[...(currentTrack ? [currentTrack] : []), ...queue]}
        s={s}
        COLORS={COLORS}
      />
    </View>
  );
}

function Chip({ on, icon, label, onPress, s, COLORS }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.chip, on && { borderColor: COLORS.primary }]}
    >
      <Ionicons name={icon} size={15} color={on ? COLORS.primary : COLORS.textSecondary} />
      <Text style={[s.chipText, on && { color: COLORS.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Saves the current song + everything queued, either as a new playlist or
// appended to an existing one.
function SaveQueueModal({ visible, onClose, tracks, s, COLORS }) {
  const [playlists, setPlaylists] = useState([]);
  const [name, setName] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setDone(null);
    Storage.getPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, [visible]);

  const unique = useMemo(() => {
    const seen = new Set();
    return tracks.filter(t => t?.id && !seen.has(t.id) && seen.add(t.id));
  }, [tracks]);

  const finish = (msg) => {
    setDone(msg);
    setTimeout(onClose, 700);
  };

  const createNew = async () => {
    const clean = name.trim();
    if (!clean || unique.length === 0) return;
    const id = 'local_' + Date.now();
    const all = await Storage.getPlaylists();
    await Storage.savePlaylists([
      ...all,
      { id, name: clean, track_count: unique.length, cover_url: trackArt(unique[0]) },
    ]);
    await Storage.savePlaylistTracks(id, unique);
    finish(`Saved ${unique.length} songs to "${clean}"`);
  };

  const addToExisting = async (pl) => {
    const existing = await Storage.getPlaylistTracks(pl.id);
    const have = new Set(existing.map(t => t.id));
    const fresh = unique.filter(t => !have.has(t.id));
    const merged = [...existing, ...fresh];
    await Storage.savePlaylistTracks(pl.id, merged);
    const all = await Storage.getPlaylists();
    const i = all.findIndex(p => p.id === pl.id);
    if (i >= 0) {
      all[i].track_count = merged.length;
      if (!all[i].cover_url && merged[0]) all[i].cover_url = trackArt(merged[0]);
      await Storage.savePlaylists(all);
    }
    finish(fresh.length ? `Added ${fresh.length} songs to "${pl.name}"` : 'Already in that playlist');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          {done ? (
            <View style={s.doneWrap}>
              <Ionicons name="checkmark-circle" size={34} color={COLORS.primary} />
              <Text style={s.doneText}>{done}</Text>
            </View>
          ) : (
            <>
              <Text style={s.sheetTitle}>Save queue</Text>
              <Text style={s.sheetSub}>{unique.length} songs, in this order</Text>

              <Text style={s.fieldLabel}>New playlist</Text>
              <View style={s.newRow}>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Playlist name"
                  placeholderTextColor={COLORS.textMuted}
                  selectionColor={COLORS.primary}
                  maxLength={60}
                />
                <TouchableOpacity
                  onPress={createNew}
                  disabled={!name.trim()}
                  style={[s.createBtn, !name.trim() && { opacity: 0.35 }]}
                >
                  <Text style={s.createText}>Create</Text>
                </TouchableOpacity>
              </View>

              {playlists.length > 0 && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 22 }]}>Or add to existing</Text>
                  <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                    {playlists.map(pl => (
                      <TouchableOpacity key={pl.id} onPress={() => addToExisting(pl)} style={s.plRow} activeOpacity={0.6}>
                        <Ionicons name="musical-notes-outline" size={18} color={COLORS.textSecondary} />
                        <Text style={s.plName} numberOfLines={1}>{pl.name}</Text>
                        <Text style={s.plCount}>{pl.track_count || 0}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 52, paddingHorizontal: 20, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.6 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  saveText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  controls: { flexDirection: 'row', marginTop: 14, gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.3, marginBottom: 6,
  },
  hint: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  removeBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.divider, marginBottom: 16 },
  sheetTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sheetSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 22 },
  fieldLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  input: {
    flex: 1, color: COLORS.textPrimary, fontSize: 17, fontWeight: '600',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  createBtn: { paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center' },
  createText: { color: COLORS.background, fontSize: 14, fontWeight: '800' },
  plRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
  },
  plName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  plCount: { color: COLORS.textMuted, fontSize: 13 },
  doneWrap: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  doneText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
