// src/services/LyricsService.js
// Fetches time-synced lyrics from lrclib.net (free, no API key).
//
// Track titles here come from YouTube, so they're noisy — "SONG (Official
// Video)", "SONG - Artist, Other", "SONG | Label". lrclib's exact-match
// endpoint 404s on those, so we clean the metadata first and fall back to
// its fuzzy search, picking the best synced result.

const BASE = 'https://lrclib.net/api';
const TIMEOUT_MS = 12000;

async function fetchJSON(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// "BELLAKEO (Video Oficial) - Peso Pluma, Anitta" -> "BELLAKEO"
export function cleanTitle(raw, artist) {
  let t = (raw || '').trim();

  t = t.replace(/\((?:[^()]*\b(?:official|lyric|lyrics|video|audio|visualizer|hd|4k|mv|m\/v|from|remaster(?:ed)?)\b[^()]*)\)/gi, '');
  t = t.replace(/\[(?:[^\[\]]*\b(?:official|lyric|lyrics|video|audio|visualizer|hd|4k|mv|m\/v|remaster(?:ed)?)\b[^\[\]]*)\]/gi, '');
  t = t.split('|')[0];                       // "Song | Label"
  t = t.replace(/\b(?:ft\.?|feat\.?|featuring)\b.*$/i, '');

  // "Song - Artist" where the trailing part is just the artist again
  if (artist) {
    const a = artist.toLowerCase().trim();
    const dash = t.split(/\s+[-–—]\s+/);
    if (dash.length > 1 && dash[dash.length - 1].toLowerCase().includes(a.split(',')[0].trim())) {
      t = dash.slice(0, -1).join(' - ');
    }
  }

  return t.replace(/\s{2,}/g, ' ').trim();
}

export function cleanArtist(raw) {
  return (raw || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\bVEVO$/i, '')
    .split(',')[0]
    .trim();
}

function parseLrc(lrc) {
  if (!lrc) return [];
  const out = [];
  for (const line of lrc.split('\n')) {
    const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (!m) continue;
    let ms = parseInt(m[3], 10);
    if (m[3].length === 2) ms *= 10;
    const time = parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + ms;
    const text = m[4].trim();
    if (text) out.push({ time, text });
  }
  return out;
}

function pickBest(results, durationMs) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const synced = results.filter(r => r.syncedLyrics);
  const pool = synced.length ? synced : results;

  // Prefer the candidate whose duration is closest to the track we're playing.
  if (durationMs > 0) {
    const target = durationMs / 1000;
    return pool.slice().sort((a, b) =>
      Math.abs((a.duration || 0) - target) - Math.abs((b.duration || 0) - target)
    )[0];
  }
  return pool[0];
}

function toResult(entry) {
  if (!entry) return null;
  if (entry.syncedLyrics) {
    const lines = parseLrc(entry.syncedLyrics);
    if (lines.length) return { synced: lines, plain: null };
  }
  if (entry.plainLyrics) return { synced: [], plain: entry.plainLyrics };
  return null;
}

/**
 * Looks up lyrics for a track, trying progressively looser strategies.
 * Returns { synced: [{time, text}], plain: string|null } or null.
 */
export async function fetchLyrics(track) {
  if (!track) return null;

  const artist = cleanArtist(track.artist);
  const title = cleanTitle(track.title, track.artist);
  const durationMs = track.duration_ms || 0;

  // 1. Exact match on cleaned metadata.
  try {
    const data = await fetchJSON(
      `${BASE}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    );
    const hit = toResult(data);
    if (hit) return hit;
  } catch (e) {
    // fall through to search
  }

  // 2. Fuzzy search, artist + title.
  try {
    const results = await fetchJSON(`${BASE}/search?q=${encodeURIComponent(`${artist} ${title}`)}`);
    const hit = toResult(pickBest(results, durationMs));
    if (hit) return hit;
  } catch (e) {
    // fall through
  }

  // 3. Title only — covers wrong/channel-name artists.
  try {
    const results = await fetchJSON(`${BASE}/search?q=${encodeURIComponent(title)}`);
    const hit = toResult(pickBest(results, durationMs));
    if (hit) return hit;
  } catch (e) {
    // give up
  }

  return null;
}
