// src/services/StorageService.js
// Centralized persistent local storage using AsyncStorage.
// Data lives in the app's native sandbox — survives app close, force-kill,
// and phone restart. Only wiped if the user uninstalls the app.
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ─────────────────────────────────────────────
const KEYS = {
  THEME: '@tilt_theme',
  AUDIO_SETTINGS: '@tilt_audio_settings',
  HISTORY: '@tilt_history',
  INTRO_SHOWN: '@tilt_intro_shown',
  LAST_TRACK: '@tilt_last_track',
  QUEUE: '@tilt_queue',
  LIKED_SONGS: '@tilt_liked_songs',
  PLAYLISTS: '@tilt_playlists',
  // Playlist tracks are keyed per-playlist: @tilt_pl_tracks_{id}
};

const PLAYLIST_TRACKS_PREFIX = '@tilt_pl_tracks_';

// ─── Helpers ──────────────────────────────────────────────────

async function getJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`StorageService: Failed to read ${key}`, e);
    return fallback;
  }
}

async function setJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`StorageService: Failed to write ${key}`, e);
  }
}

// ─── Theme ────────────────────────────────────────────────────

export async function getTheme() {
  return getJSON(KEYS.THEME, 'Teal');
}

export async function saveTheme(themeName) {
  return setJSON(KEYS.THEME, themeName);
}

// ─── Audio Settings ───────────────────────────────────────────
// { volume, crossfadeDuration, playbackSpeed, bassBoostOn, fadeInEnabled }

const DEFAULT_AUDIO_SETTINGS = {
  volume: 1.0,
  crossfadeDuration: 0,
  playbackSpeed: 1.0,
  bassBoostOn: false,
  fadeInEnabled: false,
};

export async function getAudioSettings() {
  return getJSON(KEYS.AUDIO_SETTINGS, DEFAULT_AUDIO_SETTINGS);
}

export async function saveAudioSettings(settings) {
  return setJSON(KEYS.AUDIO_SETTINGS, settings);
}

// ─── Listening History ────────────────────────────────────────

export async function getHistory() {
  return getJSON(KEYS.HISTORY, []);
}

export async function saveHistory(history) {
  // Cap at 50 entries
  return setJSON(KEYS.HISTORY, (history || []).slice(0, 50));
}

// ─── Intro Screen ─────────────────────────────────────────────

export async function getIntroShown() {
  return getJSON(KEYS.INTRO_SHOWN, false);
}

export async function saveIntroShown(shown) {
  return setJSON(KEYS.INTRO_SHOWN, shown);
}

// ─── Last Played Track (for resume) ──────────────────────────

export async function getLastTrack() {
  return getJSON(KEYS.LAST_TRACK, null);
}

export async function saveLastTrack(track) {
  return setJSON(KEYS.LAST_TRACK, track);
}

// ─── Queue ────────────────────────────────────────────────────

export async function getQueue() {
  return getJSON(KEYS.QUEUE, []);
}

export async function saveQueue(queue) {
  return setJSON(KEYS.QUEUE, queue || []);
}

// ─── Liked Songs Cache ───────────────────────────────────────

export async function getLikedSongs() {
  return getJSON(KEYS.LIKED_SONGS, []);
}

export async function saveLikedSongs(songs) {
  return setJSON(KEYS.LIKED_SONGS, songs || []);
}

// ─── Playlists ───────────────────────────────────────────────

export async function getPlaylists() {
  return getJSON(KEYS.PLAYLISTS, []);
}

export async function savePlaylists(playlists) {
  return setJSON(KEYS.PLAYLISTS, playlists || []);
}

// ─── Playlist Tracks (per-playlist) ─────────────────────────

export async function getPlaylistTracks(playlistId) {
  return getJSON(`${PLAYLIST_TRACKS_PREFIX}${playlistId}`, []);
}

export async function savePlaylistTracks(playlistId, tracks) {
  return setJSON(`${PLAYLIST_TRACKS_PREFIX}${playlistId}`, tracks || []);
}

export async function removePlaylistTracks(playlistId) {
  try {
    await AsyncStorage.removeItem(`${PLAYLIST_TRACKS_PREFIX}${playlistId}`);
  } catch (e) {
    console.warn(`StorageService: Failed to remove playlist tracks ${playlistId}`, e);
  }
}

// ─── Bulk Operations ─────────────────────────────────────────

/**
 * Clear ALL app data from local storage.
 * Use with caution — this is a full reset.
 */
export async function clearAll() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const tiltKeys = keys.filter(k => k.startsWith('@tilt_'));
    if (tiltKeys.length > 0) {
      await AsyncStorage.multiRemove(tiltKeys);
    }
  } catch (e) {
    console.warn('StorageService: Failed to clear all data', e);
  }
}
