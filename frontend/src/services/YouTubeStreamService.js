// src/services/YouTubeStreamService.js
// Resolves a playable stream straight from YouTube's player API, on the phone.
//
// Why this and not a server: the public Piped mirrors we used went down, and
// YouTube blocks datacenter IPs (our Render backend gets "confirm you're not a
// bot"). The phone has an ordinary residential/mobile IP, and stream URLs are
// bound to the IP that requested them — so the phone resolving its own URL is
// both the most reliable and the only one that needs no middleman.
//
// Why format 18: the audio-only (adaptive) URLs serve the first chunk and then
// 403 every later range request unless the client supplies a proof-of-origin
// token — which is exactly "plays for a few seconds, then stops". Format 18 is
// the legacy muxed mp4 (360p + AAC) and serves the whole file, including
// seeks. It's only a few MB per song.
import { Platform } from 'react-native';

const PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const TIMEOUT_MS = 10000;

const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 30,
  osName: 'Android',
  osVersion: '11',
  hl: 'en',
  gl: 'US',
};

export const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';

async function postJSON(url, body, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a stream candidate `{ url, headers, source }` or null.
 * Web is skipped — browsers can't call this endpoint (CORS), and the web build
 * gets its streams from the backend instead.
 */
export async function resolveYouTubeStream(videoId) {
  if (Platform.OS === 'web' || !videoId) return null;

  const data = await postJSON(
    PLAYER_ENDPOINT,
    { context: { client: ANDROID_CLIENT }, videoId, contentCheckOk: true, racyCheckOk: true },
    {
      'User-Agent': ANDROID_USER_AGENT,
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': ANDROID_CLIENT.clientVersion,
    }
  );

  const status = data?.playabilityStatus?.status;
  if (status !== 'OK') {
    console.warn(`[YouTubeStream] ${videoId} not playable: ${status} ${data?.playabilityStatus?.reason || ''}`);
    return null;
  }

  const progressive = (data?.streamingData?.formats || []).filter(f => f.url);
  const pick = progressive.find(f => f.itag === 18) || progressive[0];
  if (!pick) return null;

  return {
    url: pick.url,
    headers: { 'User-Agent': ANDROID_USER_AGENT },
    source: 'youtube',
    durationMs: pick.approxDurationMs ? Number(pick.approxDurationMs) : 0,
  };
}
