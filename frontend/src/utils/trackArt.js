// src/utils/trackArt.js
// Resolves cover art for a track.
//
// The backend hands back YouTube *channel avatars* as `art_url`, which are
// often the artist's logo rather than the release, and are sometimes missing.
// Every track id here is a YouTube video id, and YouTube always generates a
// thumbnail for a video — so derive the art from the id and keep the
// backend-provided value only as a fallback.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function trackArt(track, { small = false } = {}) {
  if (!track) return null;

  if (VIDEO_ID.test(track.id || '')) {
    const quality = small ? 'mqdefault' : 'hqdefault';
    return `https://i.ytimg.com/vi/${track.id}/${quality}.jpg`;
  }

  return (small ? track.art_url_small : track.art_url) || track.art_url || track.art_url_small || null;
}
