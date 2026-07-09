import axios from 'axios';
import Constants from 'expo-constants';

function getDevHost() {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoClient?.hostUri ||
      Constants.manifest?.debuggerHost;
    if (!hostUri) return null;
    return hostUri.split(':')[0];
  } catch (e) {
    return null;
  }
}

function getBaseUrl() {
  try {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    const host = getDevHost();
    return host ? `http://${host}:8000` : 'http://localhost:8000';
  } catch (e) {
    return 'http://localhost:8000';
  }
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 60000, // 60s — Render free tier cold starts can be slow
});

export const searchSongs = async (query) => {
  try {
    const res = await api.get('/search', { params: { q: query } });
    return res.data.results || [];
  } catch (error) {
    console.error('Search failed:', error.message);
    throw error;
  }
};

export const getStreamUrl = async (title, artist, id) => {
  try {
    const res = await api.get('/stream', {
      params: { title, artist, id },
      timeout: 45000, // Extra time for yt-dlp extraction
    });
    return res.data;
  } catch (error) {
    console.error('Stream URL failed:', error.message);
    throw error;
  }
};

// ─── Recommendations ───────────────────────────────────────

export const getRecommendations = async (trackIds) => {
  try {
    const res = await api.get('/recommendations', {
      params: { track_ids: trackIds.join(',') },
    });
    return res.data.results || [];
  } catch (error) {
    console.error('Recommendations failed:', error.message);
    return [];
  }
};

// ─── Discovery ────────────────────────────────────────────

export const getTrending = async (limit = 20) => {
  try {
    const res = await api.get('/trending', { params: { limit } });
    return res.data.results || [];
  } catch (error) {
    console.error('Trending failed:', error.message);
    return [];
  }
};

export const getNewReleases = async (limit = 15) => {
  try {
    const res = await api.get('/new-releases', { params: { limit } });
    return res.data.results || [];
  } catch (error) {
    console.error('New releases failed:', error.message);
    return [];
  }
};

export const getMoodTracks = async (mood, limit = 15) => {
  try {
    const res = await api.get(`/mood/${mood}`, { params: { limit } });
    return res.data.results || [];
  } catch (error) {
    console.error('Mood tracks failed:', error.message);
    return [];
  }
};

// ─── Liked Songs ──────────────────────────────────────────

export const getLikedSongs = async () => {
  try {
    const res = await api.get('/liked');
    return res.data.songs || [];
  } catch (error) {
    console.error('Get liked songs failed:', error.message);
    return [];
  }
};

export const toggleLike = async (track) => {
  try {
    const res = await api.post('/liked/toggle', track);
    return res.data.liked;
  } catch (error) {
    console.error('Toggle like failed:', error.message);
    return null;
  }
};

export const checkLiked = async (trackId) => {
  try {
    const res = await api.get(`/liked/check/${trackId}`);
    return res.data.liked;
  } catch (error) {
    return false;
  }
};

// ─── Health Check ──────────────────────────────────────────

export const healthCheck = async () => {
  try {
    const res = await api.get('/health');
    return res.data.status === 'ok';
  } catch {
    return false;
  }
};

// ─── Playlists ────────────────────────────────────────────

export const getPlaylists = async () => {
  try {
    const res = await api.get('/playlists');
    return res.data.playlists || [];
  } catch (error) {
    console.error('Get playlists failed:', error.message);
    return [];
  }
};

export const getPlaylistTracks = async (playlistId) => {
  try {
    const res = await api.get(`/playlists/${playlistId}/tracks`);
    return res.data.tracks || [];
  } catch (error) {
    console.error('Get playlist tracks failed:', error.message);
    return [];
  }
};

export const createPlaylist = async (name, description = '') => {
  const res = await api.post('/playlists', { name, description });
  return res.data;
};

export const addToPlaylist = async (playlistId, track) => {
  const res = await api.post(`/playlists/${playlistId}/tracks`, track);
  return res.data;
};

export const removeFromPlaylist = async (trackDbId) => {
  const res = await api.delete(`/playlists/tracks/${trackDbId}`);
  return res.data;
};

export const reorderPlaylistTracks = async (playlistId, trackIds) => {
  const res = await api.put(`/playlists/${playlistId}/tracks/reorder`, { track_ids: trackIds });
  return res.data;
};

export const importSpotifyPlaylist = async (url, enhanceWithRecommendations = false) => {
  const res = await api.post('/playlists/import/spotify', {
    url,
    enhance_with_recommendations: enhanceWithRecommendations,
  }, { timeout: 120000 }); // 2 min timeout — large playlists take time
  return res.data;
};

export const deletePlaylist = async (playlistId) => {
  const res = await api.delete(`/playlists/${playlistId}`);
  return res.data;
};

// ─── Artist Discovery ─────────────────────────────────────

export const getArtistTracks = async (artistName, limit = 15) => {
  try {
    const res = await api.get(`/artist/${encodeURIComponent(artistName)}`, { params: { limit } });
    return res.data.results || [];
  } catch (error) {
    console.error('Artist tracks failed:', error.message);
    return [];
  }
};

export default api;
