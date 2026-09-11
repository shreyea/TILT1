// src/services/PipedStreamService.js
// Resolves a YouTube videoId to direct, ad-free audio stream URLs.
// Ads never enter the picture here — we never load YouTube's player at all,
// we only ask Piped instances for the raw audio track's media URL (the same
// thing Piped/Invidious/NewPipe do to play audio without the YouTube app).
// Queries several public Piped instances in parallel and returns every
// working URL, ranked best-first, so the caller can fall through the list
// if one instance is down, rate-limited, or its URL has expired.

const PIPED_INSTANCES = [
  'https://pipedapi.wireway.ch',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.lunar.icu',
  'https://api.piped.privacydev.net',
];

const STREAM_TIMEOUT = 8000;

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

// Prefer MP4/AAC audio — plays reliably on both iOS and Android.
// WebM/Opus is fine on Android but iOS support is inconsistent.
function scoreStream(stream) {
  const isMp4 = stream.mimeType?.includes('mp4') || stream.codec === 'aac';
  return (isMp4 ? 100000 : 0) + (stream.bitrate || 0);
}

function pickBestAudioStream(audioStreams) {
  if (!audioStreams || audioStreams.length === 0) return null;
  return [...audioStreams]
    .filter((s) => s.url)
    .sort((a, b) => scoreStream(b) - scoreStream(a))[0] || null;
}

/**
 * Returns an array of candidate direct audio URLs for a YouTube videoId,
 * ranked best-first, gathered from every Piped instance that responded.
 * Never throws — returns [] if every instance failed.
 */
export async function getDirectAudioUrls(videoId) {
  const results = await Promise.allSettled(
    PIPED_INSTANCES.map((instance) =>
      fetchJSON(`${instance}/streams/${videoId}`, STREAM_TIMEOUT).then((data) => ({ instance, data }))
    )
  );

  const candidates = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { instance, data } = r.value;
    if (data.livestream) continue;
    const best = pickBestAudioStream(data.audioStreams);
    if (best?.url) {
      candidates.push({
        url: best.url,
        instance,
        mimeType: best.mimeType,
        bitrate: best.bitrate || 0,
      });
    }
  }

  candidates.sort((a, b) => scoreStream(b) - scoreStream(a));
  return candidates;
}
