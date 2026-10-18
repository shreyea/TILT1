// src/services/TiltGestureService.js
// Optional motion controls: tilt the phone to drive playback hands-free.
//
// Detection is *relative to how you're holding the phone*, not to absolute
// axis values. Holding a phone upright already pins gravity near y = ±1, so
// thresholding raw axes never returns to "neutral" and the gesture can only
// fire once. Instead we track roll/pitch angles against a slowly-adapting
// baseline, fire on deviation, and re-arm once you return toward that baseline.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

const RAD2DEG = 180 / Math.PI;

const SAMPLE_INTERVAL_MS = 80;
const TILT_DEG = 28;          // deviation from neutral that counts as a gesture
const RETURN_DEG = 14;        // must come back inside this before the next one
const COOLDOWN_MS = 700;
const BASELINE_ALPHA = 0.06;  // how fast "neutral" follows your resting grip
const VOLUME_STEP = 0.08;
const SMOOTHING = 0.35;       // 0..1, higher follows the raw reading faster
const SUSTAIN_SAMPLES = 3;    // consecutive samples past the threshold
const RECALIBRATE_MS = 2500;  // away from neutral this long => new neutral
const VOLUME_REPEAT_MS = 350;

export const TILT_ACTIONS = ['none', 'volumeUp', 'volumeDown', 'next', 'previous', 'playPause'];

export const TILT_ACTION_LABELS = {
  none: 'Nothing',
  volumeUp: 'Volume up',
  volumeDown: 'Volume down',
  next: 'Next track',
  previous: 'Previous track',
  playPause: 'Play / pause',
};

export const TILT_DIRECTIONS = [
  { key: 'left', label: 'Tilt left', icon: 'arrow-back' },
  { key: 'right', label: 'Tilt right', icon: 'arrow-forward' },
  { key: 'forward', label: 'Tilt forward', icon: 'arrow-down' },
  { key: 'back', label: 'Tilt back', icon: 'arrow-up' },
];

export const DEFAULT_TILT_MAP = {
  left: 'volumeUp',
  right: 'volumeDown',
  forward: 'next',
  back: 'previous',
};

/**
 * Runs tilt detection while `enabled`, dispatching the action mapped to each
 * direction in `gestureMap`.
 */
export function useTiltGestures({ enabled, gestureMap, volume, changeVolume, togglePlay, playNext, playPrevious }) {
  const baselineRoll = useRef(null);
  const baselinePitch = useRef(null);
  const armed = useRef(true);
  const smoothRoll = useRef(null);
  const smoothPitch = useRef(null);
  const held = useRef(0);
  const awaySince = useRef(0);
  const lastFire = useRef(0);

  // Keep the latest values without re-subscribing the sensor on every render.
  const latest = useRef({ gestureMap, volume, changeVolume, togglePlay, playNext, playPrevious });
  latest.current = { gestureMap, volume, changeVolume, togglePlay, playNext, playPrevious };

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    // A fresh session should calibrate to however the phone is being held now.
    baselineRoll.current = null;
    baselinePitch.current = null;
    armed.current = true;
    smoothRoll.current = null;
    smoothPitch.current = null;
    held.current = 0;
    awaySince.current = 0;

    const runAction = (action) => {
      const { volume: vol, changeVolume: setVol, togglePlay: toggle, playNext: next, playPrevious: prev } = latest.current;
      switch (action) {
        case 'volumeUp':
          setVol(Math.min(1, vol + VOLUME_STEP));
          return true;
        case 'volumeDown':
          setVol(Math.max(0, vol - VOLUME_STEP));
          return true;
        case 'next':
          next();
          return true;
        case 'previous':
          prev();
          return true;
        case 'playPause':
          toggle();
          return true;
        default:
          return false;
      }
    };

    let subscription;
    try {
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const norm = Math.sqrt(x * x + y * y + z * z) || 1;
        const nx = x / norm, ny = y / norm, nz = z / norm;

        const rawRoll = Math.atan2(nx, Math.sqrt(ny * ny + nz * nz)) * RAD2DEG;
        const rawPitch = Math.atan2(nz, Math.sqrt(nx * nx + ny * ny)) * RAD2DEG;

        // Low-pass filter so hand tremor and footsteps don't read as tilts.
        if (smoothRoll.current === null) {
          smoothRoll.current = rawRoll;
          smoothPitch.current = rawPitch;
        } else {
          smoothRoll.current += (rawRoll - smoothRoll.current) * SMOOTHING;
          smoothPitch.current += (rawPitch - smoothPitch.current) * SMOOTHING;
        }
        const roll = smoothRoll.current;
        const pitch = smoothPitch.current;
        const now = Date.now();

        if (baselineRoll.current === null) {
          baselineRoll.current = roll;
          baselinePitch.current = pitch;
          return;
        }

        const dRoll = roll - baselineRoll.current;
        const dPitch = pitch - baselinePitch.current;
        const inNeutral = Math.abs(dRoll) < RETURN_DEG && Math.abs(dPitch) < RETURN_DEG;

        // Back near neutral: re-arm, and let the baseline drift with your grip.
        if (inNeutral) {
          armed.current = true;
          held.current = 0;
          awaySince.current = 0;
          baselineRoll.current += dRoll * BASELINE_ALPHA;
          baselinePitch.current += dPitch * BASELINE_ALPHA;
          return;
        }

        // Stuck away from neutral for a while means the grip changed (lying
        // down, resting the phone) — adopt the new pose instead of locking up.
        if (!awaySince.current) awaySince.current = now;
        if (now - awaySince.current > RECALIBRATE_MS) {
          baselineRoll.current = roll;
          baselinePitch.current = pitch;
          awaySince.current = 0;
          held.current = 0;
          armed.current = false;
          lastFire.current = now;
          return;
        }

        // Whichever axis moved furthest wins, so a sloppy diagonal still reads cleanly.
        let direction = null;
        if (Math.abs(dRoll) >= Math.abs(dPitch) && Math.abs(dRoll) > TILT_DEG) {
          direction = dRoll < 0 ? 'left' : 'right';
        } else if (Math.abs(dPitch) > TILT_DEG) {
          direction = dPitch > 0 ? 'forward' : 'back';
        }
        if (!direction) { held.current = 0; return; }

        // Must stay tilted for a few samples — a flick in passing isn't a command.
        held.current += 1;
        if (held.current < SUSTAIN_SAMPLES) return;

        const action = (latest.current.gestureMap || DEFAULT_TILT_MAP)[direction] || 'none';
        const isVolume = action === 'volumeUp' || action === 'volumeDown';

        // Volume keeps ramping while the tilt is held; everything else fires once.
        if (isVolume) {
          if (now - lastFire.current < VOLUME_REPEAT_MS) return;
        } else {
          if (!armed.current || now - lastFire.current < COOLDOWN_MS) return;
        }

        if (runAction(action)) {
          if (!isVolume) armed.current = false;
          lastFire.current = now;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      });
    } catch (e) {
      console.warn('TiltGestureService: accelerometer unavailable', e);
    }

    return () => {
      subscription?.remove();
    };
  }, [enabled]);
}
