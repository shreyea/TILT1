// src/services/LyricsService.js
// Time-synced lyrics from lrclib.net (free, no API key).
//
// Titles come from YouTube, so they arrive noisy and in inconsistent shapes:
//   "Artist - SONG (Official Video)"   "SONG - Artist, Other"   "SONG | Label"
// lrclib's exact endpoint 404s on all of those. What reliably works is
// searching the bare song name, so we generate title candidates, strip the
// artist from whichever side it's on, and walk a ladder of queries.

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

const NOISE = /\b(?:official|lyric|lyrics?|video|audio|visuali[sz]er|hd|4k|mv|m\/v|remaster(?:ed)?|explicit|clean|full\s*song|color\s*coded)\b/i;

function stripNoise(raw) {
  let t = (raw || '').trim();
  // Bracketed/parenthesised junk — only when it actually contains noise words.
  t = t.replace(/\([^()]*\)/g, (m) => (NOISE.test(m) ? '' : m));
  t = t.replace(/\[[^\[\]]*\]/g, (m) => (NOISE.test(m) ? '' : m));
  t = t.split('|')[0];
  t = t.replace(/\b(?:ft\.?|feat\.?|featuring|con)\b.*$/i, '');
  t = t.replace(/["“”]/g, '');
  return t.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
}

export function cleanArtist(raw) {
  return (raw || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .split(/[,&]|\bft\.?\b|\bfeat\.?\b/i)[0]
    .trim();
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/gi, '');
}

/**
 * Candidate song names, best guess first. Handles the artist sitting on
 * either side of the dash, which is the case the old cleaner missed.
 */
export function titleVariants(rawTitle, rawArtist) {
  const artistKey = norm(cleanArtist(rawArtist));
  const base = stripNoise(rawTitle);
  const out = [];
  const add = (v) => {
    const s = (v || '').trim();
    if (s.length >= 2 && !out.some(e => norm(e) === norm(s))) out.push(s);
  };

  const parts = base.split(/\s+[-–—]\s+/).map(s => s.trim()).filter(Boolean);

  if (parts.length > 1 && artistKey) {
    // Drop whichever side is the artist — "Artist - Song" or "Song - Artist".
    const kept = parts.filter(p => {
      const k = norm(p);
      return k && !(k === artistKey || k.includes(artistKey) || artistKey.includes(k));
    });
    if (kept.length) add(kept.join(' - '));
  }

  // Individual segments are often the bare song name.
  for (const p of parts) {
    if (!artistKey || norm(p) !== artistKey) add(p);
  }

  add(base);
  return out;
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
 * Scores search hits: prefer synced, then a matching artist, then the
 * closest duration to what we're actually playing.
 */
function pickBest(results, { artist, durationMs }) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const artistKey = norm(artist);
  const targetSec = durationMs > 0 ? durationMs / 1000 : null;

  return results
    .map((r) => {
      let score = 0;
      if (r.syncedLyrics) score += 1000;
      if (artistKey && norm(r.artistName).includes(artistKey)) score += 300;
      if (targetSec && r.duration) score -= Math.min(200, Math.abs(r.duration - targetSec) * 4);
      return { r, score };
    })
    .sort((a, b) => b.score - a.score)[0].r;
}

/**
 * Looks up lyrics for a track. Returns { synced: [{time,text}], plain } or null.
 */
export async function fetchLyrics(track) {
  if (!track) return null;

  const artist = cleanArtist(track.artist);
  const variants = titleVariants(track.title, track.artist);
  const durationMs = track.duration_ms || 0;
  const ctx = { artist, durationMs };
  if (variants.length === 0) return null;

  // 1. Exact match on the strongest candidate.
  try {
    const data = await fetchJSON(
      `${BASE}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(variants[0])}`
    );
    const hit = toResult(data);
    if (hit) return hit;
  } catch (e) { /* fall through */ }

  // 2. Bare song name — empirically the highest-yield query for YouTube titles.
  for (const v of variants) {
    try {
      const hit = toResult(pickBest(await fetchJSON(`${BASE}/search?q=${encodeURIComponent(v)}`), ctx));
      if (hit) return hit;
    } catch (e) { /* try the next variant */ }
  }

  // 3. Artist + song, for titles too generic to find on their own.
  for (const v of variants) {
    try {
      const hit = toResult(pickBest(await fetchJSON(`${BASE}/search?q=${encodeURIComponent(`${artist} ${v}`)}`), ctx));
      if (hit) return hit;
    } catch (e) { /* give up after the last one */ }
  }

  return null;
}
