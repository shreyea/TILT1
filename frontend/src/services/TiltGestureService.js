// src/services/TiltGestureService.js
// Optional motion controls: tilt the phone to change volume or pause/resume,
// without touching the screen. Off by default — see AudioSettingsScreen.
//
// Axis convention (expo-sensors Accelerometer, phone held upright/portrait,
// screen facing you): tilting the top of the phone LEFT drives x negative,
// tilting it RIGHT drives x positive; tilting the top away from you (facing
// down/forward) drives y positive. Values are in G's, ~1.0 at a full tilt.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const SAMPLE_INTERVAL_MS = 100;
const TILT_THRESHOLD = 0.45;     // roll (left/right) needed to trigger a volume nudge
const FORWARD_THRESHOLD = 0.55;  // pitch (forward) needed to trigger play/pause
const NEUTRAL_ZONE = 0.2;        // must return near-flat before the next gesture can fire
const GESTURE_COOLDOWN_MS = 700;
const VOLUME_STEP = 0.08;

/**
 * Subscribes to the accelerometer while `enabled` and fires playback
 * gestures. Each tilt fires once — the phone has to come back near-flat
 * before another gesture can trigger, so it behaves like a discrete nudge
 * rather than a continuous stream of volume changes.
 */
export function useTiltGestures({ enabled, volume, changeVolume, togglePlay }) {
  const armedRef = useRef(true);
  const lastFireRef = useRef(0);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let subscription;
    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      subscription = Accelerometer.addListener(({ x, y }) => {
        const now = Date.now();
        const magnitude = Math.max(Math.abs(x), Math.abs(y));

        // Phone back near-flat — re-arm so the next tilt can fire.
        if (magnitude < NEUTRAL_ZONE) {
          armedRef.current = true;
          return;
        }
        if (!armedRef.current) return;
        if (now - lastFireRef.current < GESTURE_COOLDOWN_MS) return;

        if (Math.abs(x) > TILT_THRESHOLD && Math.abs(x) >= Math.abs(y)) {
          const next = x < 0
            ? Math.max(0, volumeRef.current - VOLUME_STEP)
            : Math.min(1, volumeRef.current + VOLUME_STEP);
          changeVolume(next);
          armedRef.current = false;
          lastFireRef.current = now;
        } else if (y > FORWARD_THRESHOLD) {
          togglePlay();
          armedRef.current = false;
          lastFireRef.current = now;
        }
      });
    } catch (e) {
      console.warn('TiltGestureService: accelerometer unavailable', e);
    }

    return () => {
      subscription?.remove();
    };
  }, [enabled, changeVolume, togglePlay]);
}
