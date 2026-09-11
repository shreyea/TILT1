// src/services/AudioStreamService.js
// Search-only service: iTunes for metadata + Piped for YouTube videoId
// NO streaming URLs needed — YouTube IFrame bridge handles playback directly
// This file ONLY finds the right videoId for a song

const PIPED_INSTANCES = [
  'https://pipedapi.wireway.ch',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
];

const SEARCH_TIMEOUT = 10000;

// ─── Simple fetch with timeout ────────────────────────────────

async function fetchJSON(url, timeoutMs = SEARCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Find YouTube Video ID via Piped search ───────────────────

async function findVideoId(title, artist) {
  const query = `${title} ${artist} audio`.trim();

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`[Search] Trying Piped search: ${instance}`);
      const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
      const data = await fetchJSON(url);
      const items = data.items || data;

      if (items && items.length > 0) {
        const videoUrl = items[0].url || '';
        const videoId = videoUrl.includes('v=')
          ? videoUrl.split('v=')[1]?.split('&')[0]
          : videoUrl.split('/').pop();

        if (videoId && videoId.length >= 8) {
          console.log(`[Search] ✓ Found videoId: ${videoId} via ${instance}`);
          return {
            videoId,
            title: items[0].title || title,
            duration: items[0].duration || 0,
            thumbnail: items[0].thumbnail || '',
          };
        }
      }
    } catch (err) {
      console.warn(`[Search] ✗ Piped search failed (${instance}):`, err.message);
    }
  }

  return null;
}

// ─── Main: Get videoId for a song ─────────────────────────────

/**
 * Find the YouTube videoId for a song.
 * Returns { videoId, title, duration } or throws.
 */
export async function getAudioStreamUrl(title, artist) {
  const result = await findVideoId(title, artist);

  if (result) {
    return {
      url: result.videoId,  // PlayerContext expects 'url' — we put videoId here
      videoId: result.videoId,
      title: result.title,
      duration: result.duration,
      thumbnail: result.thumbnail,
      source: 'piped-search',
    };
  }

  throw new Error(`Could not find "${title}" by ${artist} on YouTube.`);
}

/**
 * For a known videoId, just return it (no search needed).
 */
export async function getAudioStreamById(videoId) {
  return {
    url: videoId,
    videoId: videoId,
    title: '',
    duration: 0,
    source: 'direct-id',
  };
}
