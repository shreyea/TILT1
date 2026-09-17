import axios from 'axios';
import Constants from 'expo-constants';
import { getAudioStreamUrl } from './services/AudioStreamService';
import { getDirectAudioUrls } from './services/PipedStreamService';
import { resolveYouTubeStream } from './services/YouTubeStreamService';

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
// Identical GETs already in flight share one request. (Cancelling the second
// caller instead made it resolve empty — e.g. autoplay asking for
// recommendations at the same moment as the Home screen got nothing back.)
const inflight = new Map();
const rawGet = api.get.bind(api);

api.get = (url, config = {}) => {
  // Abortable calls (live search) must stay independent.
  if (config.signal) return rawGet(url, config);
  const key = `${url}?${new URLSearchParams(config.params || {}).toString()}`;
  if (inflight.has(key)) return inflight.get(key);
  const request = rawGet(url, config).finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isCancel(error) && error.name !== 'CanceledError') {
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

// ─── Audio Streaming ──────────────────────────────────────
// Sources are tried in order and we stop at the first that yields something,
// so a dead mirror costs nothing when an earlier source already worked:
//   1. YouTube's player API, resolved on the phone itself (native only)
//   2. Our backend's yt-dlp resolver + proxy (works when the backend runs on a
//      normal IP — e.g. locally for the web build; Render is bot-blocked)
//   3. Public Piped mirrors (community-run, frequently down)

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

async function resolveVideoId(title, artist, id) {
  if (id && YOUTUBE_ID.test(id)) return id;

  // Backend search (ytmusicapi) is the dependable way to map a title to a video.
  try {
    const res = await api.get('/search', { params: { q: `${title} ${artist}` }, timeout: 20000 });
    const hit = (res.data.results || []).find(t => YOUTUBE_ID.test(t.id || ''));
    if (hit) return hit.id;
  } catch (e) {
    console.warn('[api] backend search for videoId failed:', e.message);
  }

  const piped = await getAudioStreamUrl(title, artist);
  return piped.videoId;
}

async function resolveViaBackend(title, artist, videoId) {
  const res = await api.get('/stream', {
    params: { title, artist, id: videoId },
    timeout: 25000,
  });
  return res.data?.url ? { url: res.data.url, source: 'backend' } : null;
}

export const getStreamUrl = async (title, artist, id) => {
  const videoId = await resolveVideoId(title, artist, id);
  const audioUrls = [];

  try {
    const yt = await resolveYouTubeStream(videoId);
    if (yt) audioUrls.push(yt);
  } catch (e) {
    console.warn('[api] on-device YouTube resolve failed:', e.message);
  }

  if (audioUrls.length === 0) {
    try {
      const backend = await resolveViaBackend(title, artist, videoId);
      if (backend) audioUrls.push(backend);
    } catch (e) {
      console.warn('[api] backend stream resolve failed:', e.message);
    }
  }

  if (audioUrls.length === 0) {
    audioUrls.push(...(await getDirectAudioUrls(videoId)));
  }

  console.log(`[api] ${videoId}: ${audioUrls.map(c => c.source || 'piped').join(', ') || 'no sources'}`);
  return { videoId, url: videoId, audioUrls };
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
