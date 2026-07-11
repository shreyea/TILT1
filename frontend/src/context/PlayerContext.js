// src/context/PlayerContext.js
// Global audio player state — manages current track, queue, playback, repeat, shuffle
// Includes audio settings: crossfade, playback speed, bass boost (volume amplification)
// Includes lock screen / notification controls for background playback
// Persists: audio settings, history, queue, last track via StorageService
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getStreamUrl, logPlay } from '../api';
import * as Storage from '../services/StorageService';

const PlayerContext = createContext(null);

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
};

// Repeat modes: 'off' | 'all' | 'one'
const REPEAT_MODES = ['off', 'all', 'one'];

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

  const soundRef = useRef(null);
  const fullQueueRef = useRef([]); // For repeat-all
  const crossfadeTimerRef = useRef(null);
  const fadeInTimerRef = useRef(null);
  const currentTrackRef = useRef(null);
  const playLockRef = useRef(0); // Prevents double-play race conditions
  const isLoadingRef = useRef(false); // Prevents status callback from overriding isPlaying during load

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
      });
    }, 500);
    return () => clearTimeout(persistSettingsTimer.current);
  }, [volume, crossfadeDuration, playbackSpeed, bassBoostOn, fadeInEnabled]);

  // ─── Audio Setup ─────────────────────────────────────────

  useEffect(() => {
    // Use 'doNotMix' for lock screen controls to work properly
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch (e) {
        console.warn('setAudioModeAsync failed (non-fatal):', e);
      }
    })();

    return () => {
      if (soundRef.current) {
        try {
          soundRef.current.pause();
          soundRef.current.release();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      }
      if (crossfadeTimerRef.current && crossfadeTimerRef.current !== 'active') {
        clearInterval(crossfadeTimerRef.current);
      }
      if (fadeInTimerRef.current) clearInterval(fadeInTimerRef.current);
    };
  }, []);

  // ─── Lock Screen / Notification Controls ─────────────────

  const enableLockScreenControls = useCallback((player, track) => {
    if (!player || !track) return;
    try {
      player.setActiveForLockScreen(true, {
        title: track.title || 'Unknown',
        artist: track.artist || 'Unknown Artist',
        albumTitle: track.album || '',
        artworkUrl: track.art_url || '',
      });
    } catch (e) {
      console.warn('Lock screen controls error:', e);
    }
  }, []);

  // ─── Crossfade Logic ─────────────────────────────────────
  // When crossfade is enabled and a track is near its end,
  // gradually reduce volume and start the next track early.
  
  const startCrossfade = useCallback((oldSound) => {
    if (!oldSound || crossfadeRef.current <= 0) return;
    
    const fadeMs = crossfadeRef.current * 1000;
    const steps = 20;
    const stepMs = fadeMs / steps;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      const newVol = Math.max(0, 1 - (step / steps));
      try {
        oldSound.volume = newVol * volumeRef.current;
      } catch (e) {
        // Sound may already be released
      }
      
      if (step >= steps) {
        clearInterval(timer);
        try { oldSound.release(); } catch (e) {}
        crossfadeTimerRef.current = null;
      }
    }, stepMs);
  }, []);

  // Fade-in effect for new tracks
  const applyFadeIn = useCallback((newSound) => {
    if (!newSound) return;
    
    const fadeMs = 2000; // 2 second fade-in
    const steps = 20;
    const stepMs = fadeMs / steps;
    let step = 0;
    const targetVol = bassBoostRef.current ? Math.min(volumeRef.current * 1.3, 1.0) : volumeRef.current;
    
    newSound.volume = 0;
    
    fadeInTimerRef.current = setInterval(() => {
      step++;
      try {
        newSound.volume = (step / steps) * targetVol;
      } catch (e) {}
      
      if (step >= steps) {
        clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }
    }, stepMs);
  }, []);

  // ─── Play a Track ────────────────────────────────────────

  const playTrackInternal = async (track, isCrossfading = false) => {
    // Increment lock — any in-flight play calls with a stale lock will bail out
    const myLock = ++playLockRef.current;
    
    setError(null);
    setIsLoading(true);
    isLoadingRef.current = true;
    setCurrentTrack(track);
    currentTrackRef.current = track;

    try {
      if (fadeInTimerRef.current) {
        clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }

      // Reset crossfade marker for new track
      if (!isCrossfading) {
        crossfadeTimerRef.current = null;
      }

      // ALWAYS stop the old sound immediately to prevent double-audio
      if (soundRef.current) {
        try {
          soundRef.current.pause();
          if (!isCrossfading) {
            soundRef.current.release();
          }
        } catch (e) {
          console.warn('Failed to release previous sound:', e);
        }
        if (!isCrossfading) soundRef.current = null;
      }

      // Get fresh stream URL (they expire in ~6h)
      const streamData = await getStreamUrl(track.title, track.artist, track.id);
      
      // If another playTrack was called while we were fetching, bail out
      if (playLockRef.current !== myLock) return;
      
      if (!streamData || !streamData.url) {
        throw new Error('Could not get audio URL');
      }

      // Double-check: stop any sound that might have started during the async gap
      if (soundRef.current && !isCrossfading) {
        try { soundRef.current.pause(); soundRef.current.release(); } catch (e) {}
        soundRef.current = null;
      }

      // FIX: Use URL string directly for Expo SDK 51+
      const sound = createAudioPlayer(streamData.url, { updateInterval: 500 });
      
      // Apply audio settings
      const effectiveVol = bassBoostRef.current ? Math.min(volumeRef.current * 1.3, 1.0) : volumeRef.current;
      sound.volume = fadeInEnabled ? 0 : effectiveVol;
      
      // Apply playback speed
      if (playbackSpeed !== 1.0) {
        sound.playbackRate = playbackSpeed;
      }
      
      sound.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      sound.play();

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);
      isLoadingRef.current = false;

      // Enable notification / lock screen controls
      enableLockScreenControls(sound, track);

      // Apply fade-in
      if (fadeInEnabled) {
        applyFadeIn(sound);
      }

      // Add to history
      setHistory(prev => [track, ...prev.filter(t => t.id !== track.id)].slice(0, 50));
      
      // Log play to backend
      try {
        logPlay(track);
      } catch (e) {}
    } catch (e) {
      if (playLockRef.current !== myLock) return; // stale call, ignore error
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
      if (soundRef.current) {
        soundRef.current.seekTo(0);
        soundRef.current.play();
      }
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
  }, []);

  // ─── Playback Status Callback ────────────────────────────

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status) return;
    
    // expo-audio reports time in seconds — convert to ms for internal use
    const posMs = status.currentTime ? status.currentTime * 1000 : 0;
    const durMs = status.duration ? status.duration * 1000 : 0;
    
    setPosition(posMs);
    setDuration(durMs);
    
    // FIX: Don't let status updates override isPlaying while we're loading
    // This prevents the buffering false → true flicker that kills playback state
    if (typeof status.playing === 'boolean' && !isLoadingRef.current) {
      setIsPlaying(status.playing);
    }

    // Crossfade: start fading near the end
    if (
      crossfadeRef.current > 0 &&
      durMs > 0 &&
      posMs > 0 &&
      durMs - posMs <= crossfadeRef.current * 1000 &&
      !crossfadeTimerRef.current &&
      queueRef.current.length > 0
    ) {
      crossfadeTimerRef.current = 'active'; // Mark as started so it doesn't trigger multiple times
      startCrossfade(soundRef.current);
      // Start next track early
      const q = queueRef.current;
      const [next, ...rest] = q;
      setQueue(rest);
      playTrackRef.current(next, true);
    }

    // Handle track end (expo-audio does NOT auto-reset position)
    if (status.didJustFinish && !crossfadeTimerRef.current) {
      handleTrackEnd();
    }
  }, [handleTrackEnd, startCrossfade]);

  // ─── Controls ────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!soundRef.current) return;
    // Read playing state directly from the player to avoid stale closure
    if (soundRef.current.playing) {
      soundRef.current.pause();
    } else {
      soundRef.current.play();
    }
  }, []);

  const seekTo = useCallback(async (ms) => {
    if (!soundRef.current) return;
    soundRef.current.seekTo(ms / 1000);
  }, []);

  const changeVolume = useCallback(async (vol) => {
    setVolume(vol);
    if (soundRef.current) {
      const effectiveVol = bassBoostRef.current ? Math.min(vol * 1.3, 1.0) : vol;
      soundRef.current.volume = effectiveVol;
    }
  }, []);

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
    if (positionRef.current > 3000 && soundRef.current) {
      // If more than 3 seconds in, restart current track
      soundRef.current.seekTo(0);
      return;
    }
    const h = historyRef.current;
    if (h.length > 1) {
      const prev = h[1]; // [0] is current
      playTrackRef.current(prev);
    }
  }, []);

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
    if (soundRef.current) {
      soundRef.current.playbackRate = speed;
    }
  }, []);

  const toggleBassBoost = useCallback((enabled) => {
    setBassBoostOn(enabled);
    if (soundRef.current) {
      const effectiveVol = enabled ? Math.min(volumeRef.current * 1.3, 1.0) : volumeRef.current;
      soundRef.current.volume = effectiveVol;
    }
  }, []);

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
