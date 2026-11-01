// src/services/PlaylistImportService.js
// Imports a public YouTube playlist. Every entry already carries a videoId,
// which is exactly what the player streams from, so imported tracks play
// without any extra matching step. Sources, in order:
//   1. YouTube's own browse API, called from the phone (native only)
//   2. our backend (ytmusicapi) - also what the web build uses
//   3. Piped mirrors (usually down)
import { Platform } from 'react-native';
import api from '../api';

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

// ─── 1. YouTube browse API (on-device) ──────────────────────

const BROWSE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false';
const WEB_CLIENT = { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' };
const MAX_TRACKS = 500;

async function postBrowse(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BROWSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      },
      body: JSON.stringify({ context: { client: WEB_CLIENT }, ...body }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const runsText = (node) => node?.simpleText || (node?.runs || []).map(r => r.text).join('') || '';

function renderersToTracks(items, tracks) {
  let token = null;
  for (const item of items || []) {
    const r = item.playlistVideoRenderer;
    if (r) {
      if (!r.videoId || r.isPlayable === false) continue;
      const thumbs = r.thumbnail?.thumbnails || [];
      const art = thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`;
      tracks.push({
        id: r.videoId,
        title: cleanTitle(runsText(r.title)) || runsText(r.title) || 'Unknown',
        artist: runsText(r.shortBylineText).replace(/\s*-\s*Topic$/i, '') || 'Unknown',
        art_url: art,
        art_url_small: thumbs[0]?.url || art,
        duration_ms: r.lengthSeconds ? Number(r.lengthSeconds) * 1000 : 0,
      });
    }
    const c = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (c) token = c;
  }
  return token;
}

async function importViaYouTube(playlistId) {
  const first = await postBrowse({ browseId: `VL${playlistId}` });
  const tabs = first?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const section = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
  const list = section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer;
  if (!list) throw new Error('Playlist not available');

  const tracks = [];
  let token = renderersToTracks(list.contents, tracks);
  while (token && tracks.length < MAX_TRACKS) {
    const more = await postBrowse({ continuation: token });
    const items = more?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems;
    token = renderersToTracks(items, tracks);
  }

  const header = first?.header?.playlistHeaderRenderer;
  return {
    name: runsText(header?.title) || first?.metadata?.playlistMetadataRenderer?.title || 'Imported Playlist',
    uploader: runsText(header?.ownerText),
    coverUrl: tracks[0]?.art_url || null,
    tracks,
    skipped: 0,
  };
}

// ─── 2. Backend ─────────────────────────────────────────────

async function importViaBackend(playlistId) {
  const res = await api.get('/yt-playlist', { params: { list: playlistId }, timeout: 90000 });
  const d = res.data;
  return {
    name: d.name,
    uploader: d.uploader || '',
    coverUrl: d.cover || d.tracks?.[0]?.art_url || null,
    tracks: d.tracks || [],
    skipped: 0,
  };
}

// ─── 3. Piped ───────────────────────────────────────────────

async function importViaPiped(playlistId) {
  let lastError = null;
  for (const instance of PIPED_INSTANCES) {
    try {
      const data = await fetchJSON(`${instance}/playlists/${playlistId}`, TIMEOUT_MS);
      const tracks = [];
      let skipped = 0;
      for (const stream of data.relatedStreams || []) {
        const track = toTrack(stream);
        if (track) tracks.push(track);
        else skipped++;
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
    }
  }
  throw lastError || new Error('Piped unavailable');
}

/**
 * Fetches a public YouTube playlist and returns
 * { name, uploader, coverUrl, tracks, skipped }.
 */
export async function importYouTubePlaylist(input) {
  const playlistId = extractPlaylistId(input);
  if (!playlistId) {
    throw new Error("That doesn't look like a YouTube playlist link.");
  }

  const sources = [
    ...(Platform.OS === 'web' ? [] : [['YouTube', importViaYouTube]]),
    ['backend', importViaBackend],
    ['Piped', importViaPiped],
  ];

  for (const [name, run] of sources) {
    try {
      const data = await run(playlistId);
      if (data.tracks.length > 0) return data;
    } catch (err) {
      console.warn(`[PlaylistImport] ${name} failed:`, err.message);
    }
  }

  throw new Error('Could not read that playlist. Make sure it is public (or unlisted) and try again.');
}
