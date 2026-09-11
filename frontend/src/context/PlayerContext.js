// src/context/PlayerContext.js
// Global audio player state — manages current track, queue, playback, repeat, shuffle
// Includes audio settings: crossfade, playback speed, bass boost (volume amplification)
//
// Playback engine: expo-audio playing a direct audio stream resolved via Piped
// (ad-free — we never load YouTube's player, so its ad system never triggers).
// If every Piped instance is unreachable for a track, we fall back to the
// YouTube IFrame bridge (YTBridge) as a last resort so playback doesn't just
// fail outright — that path does show YouTube's ads.
//
// Persists: audio settings, history, queue, last track via StorageService
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { YTBridge } from '../components/YouTubePlayerBridge';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { getStreamUrl, logPlay } from '../api';
import * as Storage from '../services/StorageService';
import { useTiltGestures } from '../services/TiltGestureService';

const PlayerContext = createContext(null);

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
};

// Repeat modes: 'off' | 'all' | 'one'
const REPEAT_MODES = ['off', 'all', 'one'];

// Number of ranked direct-audio candidates to try before giving up and
// falling back to the YouTube embed.
const MAX_DIRECT_CANDIDATES = 3;
const DIRECT_CANDIDATE_TIMEOUT_MS = 5000;
const FADE_IN_DURATION_MS = 2000;

// Waits for a just-replaced source on `player` to actually start loading
// real audio. Resolves true once we see a non-zero duration, false on timeout.
function waitForPlayableOrTimeout(player, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try { player.removeListener('playbackStatusUpdate', onStatus); } catch (e) {}
      clearTimeout(timer);
      resolve(result);
    };
    const onStatus = (s) => {
      if (s?.isLoaded && s.duration > 0) finish(true);
    };
    player.addListener('playbackStatusUpdate', onStatus);
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [repeatMode, setRepeatMode] = useState('off');
  const [shuffleOn, setShuffle] = useState(false);
  const [error, setError] = useState(null);

  // ─── Audio Settings ──────────────────────────────────────
  const [crossfadeDuration, setCrossfadeDuration] = useState(0); // seconds, 0 = off
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [bassBoostOn, setBassBoostOn] = useState(false);
  const [fadeInEnabled, setFadeInEnabled] = useState(false);
  const [tiltGesturesEnabled, setTiltGesturesEnabled] = useState(false);

  // ─── Playback Engine ─────────────────────────────────────
  // 'native' = expo-audio playing a direct, ad-free stream (normal case)
  // 'bridge' = YouTube IFrame fallback (only when Piped is fully unreachable)
  const playbackModeRef = useRef('native');
  const [playbackMode, setPlaybackMode] = useState('native');
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const soundRef = useRef(null);
  const fullQueueRef = useRef([]); // For repeat-all
  const crossfadeTimerRef = useRef(null);
  const fadeInTimerRef = useRef(null);
  const currentTrackRef = useRef(null);
  const playLockRef = useRef(0); // Prevents double-play race conditions
  const isLoadingRef = useRef(false); // Prevents status callback from overriding isPlaying during load
  const endHandledRef = useRef(false); // Prevents double-firing track-end for native status updates

  // Use refs to avoid stale closures in callbacks
  const queueRef = useRef(queue);
  const repeatModeRef = useRef(repeatMode);
  const shuffleOnRef = useRef(shuffleOn);
  const crossfadeRef = useRef(crossfadeDuration);
  const volumeRef = useRef(volume);
  const bassBoostRef = useRef(bassBoostOn);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { shuffleOnRef.current = shuffleOn; }, [shuffleOn]);
  useEffect(() => { crossfadeRef.current = crossfadeDuration; }, [crossfadeDuration]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { bassBoostRef.current = bassBoostOn; }, [bassBoostOn]);

  // Refs to avoid stale closures
  const positionRef = useRef(position);
  const historyRef = useRef(history);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // ─── Audio Session Setup ─────────────────────────────────

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch((e) => console.warn('Failed to set audio mode:', e));
  }, []);

  // ─── Restore Persisted State ────────────────────────────
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        const [savedSettings, savedHistory, savedQueue, savedLastTrack] = await Promise.all([
          Storage.getAudioSettings(),
          Storage.getHistory(),
          Storage.getQueue(),
          Storage.getLastTrack(),
        ]);

        if (savedSettings) {
          setVolume(savedSettings.volume ?? 1.0);
          setCrossfadeDuration(savedSettings.crossfadeDuration ?? 0);
          setPlaybackSpeed(savedSettings.playbackSpeed ?? 1.0);
          setBassBoostOn(savedSettings.bassBoostOn ?? false);
          setFadeInEnabled(savedSettings.fadeInEnabled ?? false);
          setTiltGesturesEnabled(savedSettings.tiltGesturesEnabled ?? false);
        }

        if (savedHistory?.length > 0) {
          setHistory(savedHistory);
        }

        if (savedQueue?.length > 0) {
          setQueue(savedQueue);
          fullQueueRef.current = savedQueue;
        }

        if (savedLastTrack) {
          setCurrentTrack(savedLastTrack);
          currentTrackRef.current = savedLastTrack;
        }
      } catch (e) {
        console.warn('Failed to restore persisted state:', e);
      }
    })();
  }, []);

  // ─── Persist on Change ──────────────────────────────────

  // Debounce timer refs for persistence
  const persistHistoryTimer = useRef(null);
  const persistQueueTimer = useRef(null);
  const persistSettingsTimer = useRef(null);

  // Persist history (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(persistHistoryTimer.current);
    persistHistoryTimer.current = setTimeout(() => {
      Storage.saveHistory(history);
    }, 1000);
    return () => clearTimeout(persistHistoryTimer.current);
  }, [history]);

  // Persist queue (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(persistQueueTimer.current);
    persistQueueTimer.current = setTimeout(() => {
      Storage.saveQueue(queue);
    }, 1000);
    return () => clearTimeout(persistQueueTimer.current);
  }, [queue]);

  // Persist current track
  useEffect(() => {
    if (!initializedRef.current || !currentTrack) return;
    Storage.saveLastTrack(currentTrack);
  }, [currentTrack]);

  // Persist audio settings (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(persistSettingsTimer.current);
    persistSettingsTimer.current = setTimeout(() => {
      Storage.saveAudioSettings({
        volume,
        crossfadeDuration,
        playbackSpeed,
        bassBoostOn,
        fadeInEnabled,
        tiltGesturesEnabled,
      });
    }, 500);
    return () => clearTimeout(persistSettingsTimer.current);
  }, [volume, crossfadeDuration, playbackSpeed, bassBoostOn, fadeInEnabled, tiltGesturesEnabled]);

  // ─── Native (expo-audio) Status → App State ──────────────

  useEffect(() => {
    if (playbackModeRef.current !== 'native' || !status) return;

    const posMs = (status.currentTime || 0) * 1000;
    const durMs = (status.duration || 0) * 1000;
    setPosition(posMs);
    positionRef.current = posMs;
    setDuration(durMs);

    if (!isLoadingRef.current) {
      setIsPlaying(status.playing);
    }

    // Crossfade near end
    if (
      crossfadeRef.current > 0 &&
      durMs > 0 && posMs > 0 &&
      durMs - posMs <= crossfadeRef.current * 1000 &&
      !crossfadeTimerRef.current &&
      queueRef.current.length > 0
    ) {
      crossfadeTimerRef.current = 'active';
      const q = queueRef.current;
      const [next, ...rest] = q;
      setQueue(rest);
      playTrackRef.current(next, true);
    }

    if (status.didJustFinish && !crossfadeTimerRef.current && !endHandledRef.current) {
      endHandledRef.current = true;
      handleTrackEndRef.current();
    }
  }, [status]);

  // ─── YouTube Bridge Setup (fallback path only) ───────────

  useEffect(() => {
    const onTimeUpdate = (data) => {
      if (playbackModeRef.current !== 'bridge' || !data) return;
      const posMs = data.currentTime ? data.currentTime * 1000 : 0;
      const durMs = data.duration ? data.duration * 1000 : 0;
      setPosition(posMs);
      positionRef.current = posMs;
      setDuration(durMs);

      if (
        crossfadeRef.current > 0 &&
        durMs > 0 && posMs > 0 &&
        durMs - posMs <= crossfadeRef.current * 1000 &&
        !crossfadeTimerRef.current &&
        queueRef.current.length > 0
      ) {
        crossfadeTimerRef.current = 'active';
        const q = queueRef.current;
        const [next, ...rest] = q;
        setQueue(rest);
        playTrackRef.current(next, true);
      }
    };

    const onStateChange = (data) => {
      if (playbackModeRef.current !== 'bridge' || !data) return;
      if (data.state === 'playing' && !isLoadingRef.current) {
        setIsPlaying(true);
      } else if (data.state === 'paused' && !isLoadingRef.current) {
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      if (playbackModeRef.current !== 'bridge') return;
      if (!crossfadeTimerRef.current) {
        handleTrackEndRef.current();
      }
    };

    const onError = (data) => {
      if (playbackModeRef.current !== 'bridge') return;
      console.error('[YTBridge] Playback error:', data?.code);
      setError('Playback error. Trying next track...');
      setIsLoading(false);
      isLoadingRef.current = false;
      setTimeout(() => handleTrackEndRef.current(), 1000);
    };

    YTBridge.on('timeUpdate', onTimeUpdate);
    YTBridge.on('stateChange', onStateChange);
    YTBridge.on('ended', onEnded);
    YTBridge.on('error', onError);

    return () => {
      YTBridge.off('timeUpdate', onTimeUpdate);
      YTBridge.off('stateChange', onStateChange);
      YTBridge.off('ended', onEnded);
      YTBridge.off('error', onError);
      YTBridge.stop();
      if (crossfadeTimerRef.current && crossfadeTimerRef.current !== 'active') {
        clearInterval(crossfadeTimerRef.current);
      }
      if (fadeInTimerRef.current) clearInterval(fadeInTimerRef.current);
    };
  }, []);

  // Ramps volume 0 → target so a new track eases in instead of starting abruptly.
  const applyFadeIn = useCallback((targetVolume) => {
    if (fadeInTimerRef.current) clearInterval(fadeInTimerRef.current);

    const steps = 20;
    let step = 0;
    try { player.volume = 0; } catch (e) { return; }

    fadeInTimerRef.current = setInterval(() => {
      step++;
      try {
        player.volume = Math.min(targetVolume, (step / steps) * targetVolume);
      } catch (e) {}
      if (step >= steps) {
        clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }
    }, FADE_IN_DURATION_MS / steps);
  }, [player]);

  // ─── Play a Track ────────────────────────────────────────

  const playTrackInternal = async (track, isCrossfading = false) => {
    // Increment lock — any in-flight play calls with a stale lock will bail out
    const myLock = ++playLockRef.current;

    setError(null);
    setIsLoading(true);
    isLoadingRef.current = true;
    setCurrentTrack(track);
    currentTrackRef.current = track;
    endHandledRef.current = false;

    try {
      if (fadeInTimerRef.current) {
        clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }

      // Reset crossfade marker for new track
      if (!isCrossfading) {
        crossfadeTimerRef.current = null;
      }

      // Stop whatever was playing on either engine
      try { player.pause(); } catch (e) {}
      YTBridge.stop();

      // Resolve the video + ranked direct (ad-free) audio URLs for this track
      console.log(`[PlayerContext] Resolving stream for: ${track.title} by ${track.artist}`);
      const streamData = await getStreamUrl(track.title, track.artist, track.id);
      console.log(`[PlayerContext] videoId: ${streamData?.videoId}, ${streamData?.audioUrls?.length || 0} direct candidate(s)`);

      // If another playTrack was called while we were fetching, bail out
      if (playLockRef.current !== myLock) return;

      const videoId = streamData?.videoId || streamData?.url;
      if (!videoId) {
        throw new Error('Could not find video for this song');
      }

      const candidates = (streamData?.audioUrls || []).slice(0, MAX_DIRECT_CANDIDATES);
      let played = false;

      // Try direct, ad-free audio streams first — no YouTube player is ever
      // loaded on this path, so there's no ad system to trigger.
      for (const candidate of candidates) {
        if (playLockRef.current !== myLock) return;
        try {
          player.replace({ uri: candidate.url });
          player.play();
          const ok = await waitForPlayableOrTimeout(player, DIRECT_CANDIDATE_TIMEOUT_MS);
          if (playLockRef.current !== myLock) return;
          if (ok) {
            played = true;
            break;
          }
        } catch (e) {
          console.warn('[PlayerContext] Direct stream candidate failed:', e.message);
        }
      }

      if (playLockRef.current !== myLock) return;

      if (played) {
        playbackModeRef.current = 'native';
        setPlaybackMode('native');
        soundRef.current = { playing: true, mode: 'native', videoId };
      } else {
        // Every Piped instance was unreachable/rate-limited for this track —
        // fall back to the official YouTube embed so playback doesn't just
        // fail. This path does show YouTube's ads.
        console.warn('[PlayerContext] All direct audio sources failed — falling back to YouTube embed (ads)');
        try { player.pause(); player.clearLockScreenControls(); } catch (e) {}
        playbackModeRef.current = 'bridge';
        setPlaybackMode('bridge');
        YTBridge.play(videoId);
        soundRef.current = { playing: true, mode: 'bridge', videoId };
      }

      setIsPlaying(true);
      setIsLoading(false);
      isLoadingRef.current = false;

      // Apply volume + speed on whichever engine is active
      const effectiveVol = bassBoostRef.current ? Math.min(volumeRef.current * 1.3, 1.0) : volumeRef.current;
      if (playbackModeRef.current === 'native') {
        if (fadeInEnabled) {
          applyFadeIn(effectiveVol);
        } else {
          player.volume = effectiveVol;
        }
        if (playbackSpeed !== 1.0) player.setPlaybackRate(playbackSpeed);
        try {
          player.setActiveForLockScreen(true, {
            title: track.title,
            artist: track.artist,
            albumTitle: track.album || '',
            artworkUrl: track.coverUrl || track.thumbnail || '',
          });
        } catch (e) {}
      } else {
        YTBridge.setVolume(effectiveVol);
        if (playbackSpeed !== 1.0) YTBridge.setPlaybackRate(playbackSpeed);
      }

      // Add to history
      setHistory(prev => [track, ...prev.filter(t => t.id !== track.id)].slice(0, 50));

      // Log play to backend
      try {
        logPlay(track);
      } catch (e) {}
    } catch (e) {
      if (playLockRef.current !== myLock) return;
      console.error('Play failed:', e);
      setError(`Failed to play "${track.title}"`);
      setIsLoading(false);
      isLoadingRef.current = false;
      setIsPlaying(false);
    }
  };

  // Stable ref for playTrackInternal
  const playTrackRef = useRef(playTrackInternal);
  playTrackRef.current = playTrackInternal;

  const playTrack = useCallback((track) => {
    return playTrackRef.current(track);
  }, []);

  // ─── Track End Handler ───────────────────────────────────

  const handleTrackEnd = useCallback(() => {
    const rm = repeatModeRef.current;
    const q = queueRef.current;
    const sh = shuffleOnRef.current;

    if (rm === 'one') {
      // Replay current track on whichever engine is active
      if (playbackModeRef.current === 'native') {
        player.seekTo(0);
        player.play();
      } else {
        YTBridge.seekTo(0);
        YTBridge.resume();
      }
      endHandledRef.current = false;
      return;
    }

    if (q.length > 0) {
      const [next, ...rest] = q;
      setQueue(rest);
      playTrackRef.current(next);
    } else if (rm === 'all' && fullQueueRef.current.length > 0) {
      const reloaded = sh
        ? shuffleArray([...fullQueueRef.current])
        : [...fullQueueRef.current];
      setQueue(reloaded.slice(1));
      playTrackRef.current(reloaded[0]);
    } else {
      setIsPlaying(false);
    }
  }, [player]);

  // ─── handleTrackEnd ref for the bridge/native event listeners ────
  const handleTrackEndRef = useRef(handleTrackEnd);
  handleTrackEndRef.current = handleTrackEnd;

  // ─── Controls ────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!soundRef.current) return;
    if (playbackModeRef.current === 'native') {
      if (soundRef.current.playing) {
        player.pause();
        soundRef.current.playing = false;
      } else {
        player.play();
        soundRef.current.playing = true;
      }
    } else {
      if (soundRef.current.playing) {
        YTBridge.pause();
        soundRef.current.playing = false;
      } else {
        YTBridge.resume();
        soundRef.current.playing = true;
      }
    }
  }, [player]);

  const seekTo = useCallback(async (ms) => {
    if (playbackModeRef.current === 'native') {
      await player.seekTo(ms / 1000);
    } else {
      YTBridge.seekTo(ms / 1000);
    }
  }, [player]);

  const changeVolume = useCallback(async (vol) => {
    setVolume(vol);
    // A manual change wins over an in-progress fade-in ramp.
    if (fadeInTimerRef.current) {
      clearInterval(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }
    const effectiveVol = bassBoostRef.current ? Math.min(vol * 1.3, 1.0) : vol;
    if (playbackModeRef.current === 'native') {
      player.volume = effectiveVol;
    } else {
      YTBridge.setVolume(effectiveVol);
    }
  }, [player]);

  // ─── Tilt Gestures (optional motion controls) ────────────
  const toggleTiltGestures = useCallback((enabled) => {
    setTiltGesturesEnabled(enabled);
  }, []);

  useTiltGestures({ enabled: tiltGesturesEnabled, volume, changeVolume, togglePlay });

  const playNext = useCallback(() => {
    const q = queueRef.current;
    const rm = repeatModeRef.current;
    const sh = shuffleOnRef.current;

    if (q.length === 0) {
      if (rm === 'all' && fullQueueRef.current.length > 0) {
        const reloaded = sh
          ? shuffleArray([...fullQueueRef.current])
          : [...fullQueueRef.current];
        setQueue(reloaded.slice(1));
        playTrackRef.current(reloaded[0]);
      }
      return;
    }
    const [next, ...rest] = q;
    setQueue(rest);
    playTrackRef.current(next);
  }, []);

  const playPrevious = useCallback(() => {
    // Use refs to avoid stale closures
    if (positionRef.current > 3000) {
      // If more than 3 seconds in, restart current track
      if (playbackModeRef.current === 'native') {
        player.seekTo(0);
      } else {
        YTBridge.seekTo(0);
      }
      return;
    }
    const h = historyRef.current;
    if (h.length > 1) {
      const prev = h[1]; // [0] is current
      playTrackRef.current(prev);
    }
  }, [player]);

  // ─── Queue Management ───────────────────────────────────

  const addToQueue = useCallback((track) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const addMultipleToQueue = useCallback((tracks) => {
    setQueue(prev => [...prev, ...tracks]);
    fullQueueRef.current = tracks;
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Shuffle & Repeat ───────────────────────────────────

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      if (!prev) {
        // Turning shuffle ON — randomize current queue
        setQueue(q => shuffleArray([...q]));
      }
      return !prev;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const idx = REPEAT_MODES.indexOf(prev);
      return REPEAT_MODES[(idx + 1) % REPEAT_MODES.length];
    });
  }, []);

  // ─── Audio Settings Actions ─────────────────────────────

  const updateCrossfade = useCallback((seconds) => {
    setCrossfadeDuration(seconds);
  }, []);

  const updatePlaybackSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
    if (playbackModeRef.current === 'native') {
      player.setPlaybackRate(speed);
    } else {
      YTBridge.setPlaybackRate(speed);
    }
  }, [player]);

  const toggleBassBoost = useCallback((enabled) => {
    setBassBoostOn(enabled);
    const effectiveVol = enabled ? Math.min(volumeRef.current * 1.3, 1.0) : volumeRef.current;
    if (playbackModeRef.current === 'native') {
      player.volume = effectiveVol;
    } else {
      YTBridge.setVolume(effectiveVol);
    }
  }, [player]);

  const toggleFadeIn = useCallback((enabled) => {
    setFadeInEnabled(enabled);
  }, []);

  // ─── Play All (playlist or search results) ──────────────

  const playAll = useCallback((tracks, startIndex = 0) => {
    if (!tracks || tracks.length === 0) return;
    const sh = shuffleOnRef.current;

    // The first track must be the one clicked (or index 0)
    const first = tracks[startIndex] || tracks[0];

    // The rest of the tracks
    let rest = tracks.filter((_, i) => i !== startIndex);

    if (sh) {
      rest = shuffleArray([...rest]);
    }

    setQueue(rest);
    fullQueueRef.current = tracks;
    playTrackRef.current(first);
  }, []);

  const value = {
    // State
    currentTrack,
    queue,
    history,
    isPlaying,
    isLoading,
    duration,
    position,
    volume,
    repeatMode,
    shuffleOn,
    error,
    // Audio settings state
    crossfadeDuration,
    playbackSpeed,
    bassBoostOn,
    fadeInEnabled,
    tiltGesturesEnabled,
    // Playback engine (for the audio visualizer — real sample data is only
    // available in 'native' mode; 'bridge' means the YouTube embed fallback
    // is active and has no sampling access)
    player,
    playbackMode,
    // Actions
    playTrack,
    togglePlay,
    seekTo,
    changeVolume,
    playNext,
    playPrevious,
    addToQueue,
    addMultipleToQueue,
    clearQueue,
    removeFromQueue,
    toggleShuffle,
    cycleRepeat,
    playAll,
    setError,
    // Audio settings actions
    updateCrossfade,
    updatePlaybackSpeed,
    toggleBassBoost,
    toggleFadeIn,
    toggleTiltGestures,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

// ─── Utility ─────────────────────────────────────────────────

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
