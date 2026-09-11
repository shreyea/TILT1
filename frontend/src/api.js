import axios from 'axios';
import Constants from 'expo-constants';
import { getAudioStreamUrl, getAudioStreamById } from './services/AudioStreamService';
import { getDirectAudioUrls } from './services/PipedStreamService';

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

// ─── Audio Streaming (Piped/Cobalt — no backend needed) ────

export const getStreamUrl = async (title, artist, id) => {
  try {
    let streamData;

    // If we have a YouTube video ID (11 chars, not a Spotify ID), stream it directly
    if (id && id.length === 11 && !id.startsWith('spotify')) {
      console.log(`[api] Streaming by videoId: ${id}`);
      streamData = await getAudioStreamById(id);
    } else {
      // Otherwise search by title + artist across Piped → Invidious instances
      console.log(`[api] Streaming by search: "${title}" by ${artist}`);
      streamData = await getAudioStreamUrl(title, artist);
    }

    // Resolve direct, ad-free audio URLs for this videoId (ranked best-first).
    // We never load YouTube's player, so its ad system never triggers.
    const audioUrls = await getDirectAudioUrls(streamData.videoId);

    return { ...streamData, audioUrls };
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
