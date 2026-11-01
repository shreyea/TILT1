// src/components/PlaylistEditModal.js
// Rename a playlist and change its cover — from a photo on the phone, or from
// the artwork of one of its own songs. Shown as a bottom sheet, no boxes.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, Image, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../context/ThemeContext';
import * as Storage from '../services/StorageService';
import { trackArt } from '../utils/trackArt';

// Picked photos live in the image picker's cache, which the OS may clear —
// copy them somewhere permanent first.
async function keepImage(uri) {
  if (Platform.OS === 'web') return uri;
  const ext = (uri.split('?')[0].split('.').pop() || 'jpg').slice(0, 4);
  const dest = `${FileSystem.documentDirectory}cover_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export default function PlaylistEditModal({ visible, playlist, onClose, onSaved, onDelete }) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const [name, setName] = useState('');
  const [cover, setCover] = useState(null);   // null = automatic (first song)
  const [custom, setCustom] = useState(false);
  const [songArt, setSongArt] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !playlist) return;
    setName(playlist.name || '');
    setCover(playlist.cover_url || null);
    setCustom(!!playlist.custom_cover);
    setBusy(false);
    Storage.getPlaylistTracks(playlist.id).then((tracks) => {
      const seen = new Set();
      const arts = [];
      for (const t of tracks || []) {
        const a = trackArt(t);
        if (a && !seen.has(a)) { seen.add(a); arts.push(a); }
        if (arts.length >= 14) break;
      }
      setSongArt(arts);
    }).catch(() => setSongArt([]));
  }, [visible, playlist?.id]);

  const pickPhoto = useCallback(async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setBusy(true);
      const saved = await keepImage(res.assets[0].uri);
      setCover(saved);
      setCustom(true);
    } catch (e) {
      console.warn('Cover pick failed:', e);
    } finally {
      setBusy(false);
    }
  }, []);

  const useSongArt = useCallback((uri) => {
    setCover(uri);
    setCustom(true);
  }, []);

  const useAutomatic = useCallback(async () => {
    const tracks = await Storage.getPlaylistTracks(playlist.id);
    setCover(tracks[0] ? trackArt(tracks[0]) : null);
    setCustom(false);
  }, [playlist?.id]);

  const save = useCallback(async () => {
    const clean = name.trim();
    if (!clean || !playlist) return;
    const all = await Storage.getPlaylists();
    const i = all.findIndex(p => p.id === playlist.id);
    if (i < 0) return;
    all[i] = { ...all[i], name: clean, cover_url: cover, custom_cover: custom };
    await Storage.savePlaylists(all);
    onSaved?.(all[i]);
    onClose?.();
  }, [name, cover, custom, playlist, onSaved, onClose]);

  if (!playlist) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.heading}>Edit playlist</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.coverRow}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={s.coverWrap}>
                {cover ? (
                  <Image source={{ uri: cover }} style={s.cover} />
                ) : (
                  <View style={[s.cover, s.coverEmpty]}>
                    <Ionicons name="musical-notes" size={34} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={s.coverBadge}>
                  {busy
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="camera" size={15} color="#FFF" />}
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={s.label}>Name</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Playlist name"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={60}
                  selectionColor={COLORS.primary}
                />
              </View>
            </View>

            <View style={s.actionsRow}>
              <TouchableOpacity onPress={pickPhoto} style={s.linkBtn}>
                <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                <Text style={s.linkText}>Choose photo</Text>
              </TouchableOpacity>
              {custom && (
                <TouchableOpacity onPress={useAutomatic} style={s.linkBtn}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={[s.linkText, { color: COLORS.textSecondary }]}>Use automatic cover</Text>
                </TouchableOpacity>
              )}
            </View>

            {songArt.length > 0 && (
              <>
                <Text style={s.label}>Or use a song's artwork</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.artRow}>
                  {songArt.map((uri) => (
                    <TouchableOpacity key={uri} onPress={() => useSongArt(uri)} activeOpacity={0.8}>
                      <Image
                        source={{ uri }}
                        style={[s.artThumb, cover === uri && { borderColor: COLORS.primary, borderWidth: 2 }]}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(playlist)} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={!name.trim()}
              style={[s.saveBtn, !name.trim() && { opacity: 0.4 }]}
            >
              <Text style={s.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 24, paddingBottom: 28, paddingTop: 10, maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.divider, marginBottom: 16,
  },
  heading: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 20 },

  coverRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18, marginBottom: 14 },
  coverWrap: {},
  cover: { width: 104, height: 104, borderRadius: 14 },
  coverEmpty: { backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  coverBadge: {
    position: 'absolute', right: -6, bottom: -6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.background,
  },
  label: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginTop: 6,
  },
  input: {
    color: COLORS.textPrimary, fontSize: 18, fontWeight: '600',
    paddingVertical: 8, paddingHorizontal: 0,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 18, marginTop: 6 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  linkText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },

  artRow: { gap: 10, paddingVertical: 6, paddingBottom: 14 },
  artThumb: { width: 62, height: 62, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  deleteBtn: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  cancelBtn: { flex: 1, height: 46, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1.4, height: 46, borderRadius: 23, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  saveText: { color: COLORS.background, fontSize: 15, fontWeight: '800' },
});
