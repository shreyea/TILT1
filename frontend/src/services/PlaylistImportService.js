// src/services/PlaylistImportService.js
// Imports a public YouTube playlist via Piped — no API key, no backend.
// Each entry already carries a videoId, which is exactly what the player
// streams from, so imported tracks play without any extra matching step.

const PIPED_INSTANCES = [
  'https://pipedapi.wireway.ch',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.lunar.icu',
  'https://api.piped.privacydev.net',
];

const TIMEOUT_MS = 15000;

async function fetchJSON(url, timeoutMs) {
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

/**
 * Pulls the playlist id out of any common YouTube/Piped URL form,
 * or accepts a bare id.
 */
export function extractPlaylistId(input) {
  const raw = (input || '').trim();
  if (!raw) return null;

  const match = raw.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  // Bare id (PL…, OLAK5uy…, RD…, etc.)
  if (/^[A-Za-z0-9_-]{12,}$/.test(raw)) return raw;

  return null;
}

// YouTube music titles carry a lot of noise — "(Official Video)", "[4K]", …
// Stripping it makes the library readable and helps lyrics lookups match.
function cleanTitle(title) {
  return (title || '')
    .replace(/\((?:[^()]*\b(?:official|lyric|lyrics|video|audio|visualizer|hd|4k|mv|m\/v)\b[^()]*)\)/gi, '')
    .replace(/\[(?:[^\[\]]*\b(?:official|lyric|lyrics|video|audio|visualizer|hd|4k|mv|m\/v)\b[^\[\]]*)\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function toTrack(stream) {
  const url = stream.url || '';
  const videoId = url.includes('v=')
    ? url.split('v=')[1]?.split('&')[0]
    : url.split('/').pop();

  if (!videoId || videoId.length !== 11) return null;

  return {
    id: videoId,
    title: cleanTitle(stream.title) || stream.title || 'Unknown',
    artist: (stream.uploaderName || 'Unknown').replace(/\s*-\s*Topic$/i, ''),
    art_url: stream.thumbnail || null,
    art_url_small: stream.thumbnail || null,
    duration_ms: stream.duration ? stream.duration * 1000 : 0,
  };
}

/**
 * Fetches a public YouTube playlist and returns
 * { name, uploader, coverUrl, tracks, skipped }.
 * Tries each Piped instance until one responds.
 */
export async function importYouTubePlaylist(input) {
  const playlistId = extractPlaylistId(input);
  if (!playlistId) {
    throw new Error('That doesn\'t look like a YouTube playlist link.');
  }

  let lastError = null;
  for (const instance of PIPED_INSTANCES) {
    try {
      const data = await fetchJSON(`${instance}/playlists/${playlistId}`, TIMEOUT_MS);
      const streams = data.relatedStreams || [];

      const tracks = [];
      let skipped = 0;
      for (const stream of streams) {
        const track = toTrack(stream);
        if (track) tracks.push(track);
        else skipped++;
      }

      if (tracks.length === 0) {
        throw new Error('This playlist has no playable tracks.');
      }

      return {
        name: data.name || 'Imported Playlist',
        uploader: data.uploader || '',
        coverUrl: data.thumbnailUrl || tracks[0]?.art_url || null,
        tracks,
        skipped,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[PlaylistImport] ${instance} failed:`, err.message);
    }
  }

  throw new Error(
    lastError?.message === 'This playlist has no playable tracks.'
      ? lastError.message
      : 'Could not reach any playlist server. Check the link or try again.'
  );
}
