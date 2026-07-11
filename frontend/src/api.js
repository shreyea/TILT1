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

// ─── Request Deduplication ────────────────────────────────
const pendingRequests = new Map();

api.interceptors.request.use((config) => {
  // Only deduplicate GET requests
  if (config.method === 'get') {
    const requestKey = `${config.method}:${config.url}?${new URLSearchParams(config.params).toString()}`;
    if (pendingRequests.has(requestKey)) {
      // If we already have this exact request in flight, abort this new one
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      source.cancel(`Request canceled: Duplicate request to ${requestKey}`);
    } else {
      pendingRequests.set(requestKey, true);
      config.requestKey = requestKey; // Attach key for removal on response
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.requestKey) {
      pendingRequests.delete(response.config.requestKey);
    }
    return response;
  },
  (error) => {
    if (error.config?.requestKey) {
      pendingRequests.delete(error.config.requestKey);
    }
    
    // Format error message nicely
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message);
    } else {
      console.error(`API Error [${error.config?.url}]:`, error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

// ─── API Methods ──────────────────────────────────────────

export const searchSongs = async (query, abortSignal) => {
  try {
    const res = await api.get('/search', { 
      params: { q: query },
      signal: abortSignal
    });
    return res.data.results || [];
  } catch (error) {
    if (!axios.isCancel(error) && error.name !== 'CanceledError') {
      console.error('Search failed:', error.message);
    }
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

export const getBasedSuggestions = async () => {
  try {
    const res = await api.get('/based-suggestions');
    return res.data.results || [];
  } catch (error) {
    console.error('Based suggestions failed:', error.message);
    return [];
  }
};

// ─── Play Counts ──────────────────────────────────────────

export const logPlay = async (track) => {
  try {
    await api.post('/play', track);
  } catch (error) {
    // Silently fail
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
// Note: Liked songs are now primarily managed locally via StorageService.
// These backend endpoints are kept for backwards compatibility or syncing if needed.

export const getLikedSongs = async () => {
  try {
    const res = await api.get('/liked');
    return res.data.songs || [];
  } catch (error) {
    return [];
  }
};

export const toggleLike = async (track) => {
  try {
    const res = await api.post('/liked/toggle', track);
    return res.data.liked;
  } catch (error) {
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
// Note: Playlists are now primarily managed locally via StorageService.
// These backend endpoints are kept for the Spotify Import feature.

export const getPlaylists = async () => {
  try {
    const res = await api.get('/playlists');
    return res.data.playlists || [];
  } catch (error) {
    return [];
  }
};

export const getPlaylistTracks = async (playlistId) => {
  try {
    const res = await api.get(`/playlists/${playlistId}/tracks`);
    return res.data.tracks || [];
  } catch (error) {
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
