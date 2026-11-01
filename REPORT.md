# TILT — Project Report

A personal, ad-free music app. It plays YouTube audio through its own player (no YouTube UI, so no ads),
with synced lyrics, autoplay, tilt gestures, two themes and a lock-screen/notification player.

---

## 1. Getting everything up to date

### A. Commit and push (you do this — nothing has been committed)

```bash
cd D:\projects\musicapp
git status
git add -A
git commit -m "Autoplay background handoff, lyrics fix, tilt rework, remove Pulse"
git push origin main
```

Pushing `main` redeploys the **backend on Render** automatically (if auto-deploy is on in the Render dashboard;
otherwise press *Manual Deploy → Deploy latest commit*).

### B. Backend (Render)

Render builds from `backend/` with `requirements.txt` and starts via `backend/Procfile`.
Check it is alive after the deploy:

```bash
curl https://tilt1.onrender.com/health
```

The free tier sleeps after ~15 min idle; the first request can take 30–60 s.

### C. Frontend — the Android APK (what runs on your phone)

JS changes (everything done recently) only reach the phone through a **new build**:

```bash
cd D:\projects\musicapp\frontend
npm install
npx expo-doctor
npx eas build --platform android --profile preview
```

`preview` produces an installable `.apk` and bakes in `EXPO_PUBLIC_API_URL=https://tilt1.onrender.com`
(see `frontend/eas.json`). Open the build link EAS prints on your phone and install over the old app.
Do **not** add `"distribution": "internal"` to `preview` — it produced a `.tar.gz` before.

### D. Run locally on web (for testing without a build)

Backend (local IP is not bot-blocked by YouTube, so it can stream):

```bash
cd D:\projects\musicapp\backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd D:\projects\musicapp\frontend
npm install
npx expo start --web
```

On web the API URL falls back to `http://localhost:8000`. Back button, tilt, lock-screen
controls and background playback cannot be tested on web.

### E. Keeping dependencies current (optional)

```bash
cd D:\projects\musicapp\frontend
npx expo install --check        # aligns Expo packages to SDK 54
cd ..\backend
pip install -U yt-dlp ytmusicapi   # yt-dlp breaks often when YouTube changes; bump the pin in requirements.txt
```

---

## 2. Architecture

```
Phone (Expo / React Native app)
 ├─ finds songs, charts, recommendations ─────────► Backend on Render (FastAPI + ytmusicapi)
 ├─ resolves the audio URL itself ─────────────────► YouTube player API (on the phone's own IP)
 │     fallback: backend /stream (yt-dlp) ─► Piped mirrors
 ├─ lyrics ────────────────────────────────────────► lrclib.net
 └─ plays the URL with expo-audio (ExoPlayer) + lock-screen service
```

**Why the phone resolves streams itself:** YouTube blocks Render's datacenter IP, and every public
Piped mirror is down. A phone on a home/mobile IP is not blocked.

### Stream resolution order (`frontend/src/api.js`)
1. **On-device YouTube** (`YouTubeStreamService.js`): calls `youtubei/v1/player` as the ANDROID client and picks
   **itag 18** (muxed mp4). Adaptive audio-only URLs return 403 after the first chunk without a PO token;
   itag 18 serves the whole file and allows seeking.
2. **Backend `/stream`** (yt-dlp, format `18/bestaudio/best`) — works when the backend runs on a normal IP.
3. **Piped mirrors** (`PipedStreamService.js`) — last resort.
4. If everything fails, the hidden YouTube embed (`YouTubePlayerBridge.js`) plays — this one can show ads.

---

## 3. Tech stack

### Frontend (`frontend/`)
| Piece | Used for |
|---|---|
| Expo SDK 54, React Native 0.81, React 19 | app framework |
| `expo-audio` | playback, lock-screen/notification controls, background play |
| `react-navigation` bottom tabs | navigation (custom icon-only tab bar, history back behaviour) |
| `react-native-reanimated` | animations |
| `expo-sensors` (Accelerometer) + `expo-haptics` | tilt gestures |
| `expo-linear-gradient`, `expo-blur` | artwork-tinted backgrounds |
| `react-native-draggable-flatlist` | reordering the queue |
| `axios` | backend calls, with shared in-flight GETs |
| `@react-native-async-storage` | persistence |
| `react-native-webview` | fallback YouTube embed |

### Backend (`backend/`)
| Piece | Used for |
|---|---|
| FastAPI + uvicorn | HTTP API |
| `ytmusicapi` | search, trending, new releases, moods, artist tracks, recommendations |
| `yt-dlp` | stream resolution fallback and `/proxy-stream` |
| SQLite (`playlists.db`) | playlists, liked songs, play counts |
| `httpx`, `requests`, `pydantic`, `python-dotenv` | helpers |

### Endpoints
`/search`, `/track/{id}`, `/recommendations`, `/based-suggestions`, `/trending`, `/new-releases`,
`/mood/{mood}`, `/artist/{name}`, `/stream`, `/proxy-stream`, `/playlists` (+ tracks), `/liked`
(+ toggle/check), `/play`, `/health`, `/`.

---

## 4. Key files

| File | Role |
|---|---|
| `frontend/App.js` | providers, tab bar, Now Playing overlay |
| `frontend/src/context/PlayerContext.js` | the player: queue, autoplay, prefetch, watchdog, tilt wiring, audio settings |
| `frontend/src/api.js` | API client and layered stream resolution |
| `frontend/src/services/YouTubeStreamService.js` | on-device YouTube stream lookup |
| `frontend/src/services/LyricsService.js` | lrclib lookup with title-cleaning ladder |
| `frontend/src/services/TiltGestureService.js` | tilt detection |
| `frontend/src/services/StorageService.js` | settings, search history, liked songs, playlists |
| `frontend/src/screens/*` | Home, Search, Library, Now Playing, Queue, Audio Settings, Playlist Import, Intro |
| `frontend/src/components/AmbientPulse.js` | full-screen Ambient view |
| `frontend/src/theme.js`, `context/ThemeContext.js` | Teal and Noir themes |
| `backend/main.py`, `audio.py` | API routes and yt-dlp resolver |

---

## 5. How the main features work

**Autoplay.** When a song starts with nothing queued after it, ~10 similar songs are fetched (recommendations →
same artist → trending, minus recent history) and shown in Up Next, tagged `auto`. Songs you add by hand are tagged
`manual` and always play before auto picks. Tapping a new song replaces the old list but keeps manual items.
Works only with repeat off. Toggle in Audio Settings.

**Background handoff.** About 60 s before a song ends, the next song's stream URL is resolved and cached
(20-min lifetime). When the song ends, playback switches immediately with no network wait, which matters when the
screen is off. A watchdog restarts stalled streams and treats finished or system-paused songs correctly.

**Lyrics.** Fetched from lrclib as soon as a song starts. Titles are cleaned (noise words, artist on either side
of the dash). Synced lyrics show the current line centred; plain lyrics scroll. Opening the tab retries a failed lookup.

**Tilt gestures (optional).** Roll/pitch measured against your resting grip, smoothed, and must be held for a few
samples. Volume tilts repeat while held; others fire once. If you change your grip the baseline re-calibrates after
~2.5 s. Each direction is mappable in Audio Settings. The motion sensor stops when the screen is off.

**Other.** Search history (last 10), two themes (Teal, Noir), Ambient view, crossfade, fade-in, playback speed,
bass boost, playlist import, Android back button navigation, media notification with artwork.

---

## 6. Known limits

- Spotify ad removal is not possible (DRM); the app plays YouTube audio instead.
- YouTube can change its player API at any time; the on-device resolver may then need an update, and `yt-dlp` needs bumping.
- Render's free tier sleeps; the first search/recommendation after idle can be slow.
- Tilt does not work with the screen off.
- The fallback YouTube embed can show ads (only used if every direct source fails).
- Android back button, tilt, notification and background playback have only been verified by reasoning and on the earlier
  builds — test them on the next APK.
- Leftover scratch files in the repo root (`fix.js`, `fix_styles.js`, `refactor*.js`, `revert_theme.js`, `piped_test.json`,
  `errors/`) and in `backend/` (`res*.json`, `embed.*`, `playlist.html`, `test_*.py`) are safe to delete.
