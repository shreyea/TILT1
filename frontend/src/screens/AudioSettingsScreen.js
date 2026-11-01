// src/screens/AudioSettingsScreen.js
// Flat, list-style settings: grouped by heading, separated by hairlines —
// no cards, no icon tiles. Controls sit at the right of each row.
import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import { TILT_ACTIONS, TILT_ACTION_LABELS, TILT_DIRECTIONS } from '../services/TiltGestureService';
import { SPACING } from '../theme';

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function AudioSettingsScreen({ onClose }) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const {
    crossfadeDuration, playbackSpeed, bassBoostOn, fadeInEnabled, tiltGesturesEnabled, tiltGestureMap, autoplayEnabled,
    updateCrossfade, updatePlaybackSpeed, toggleBassBoost, toggleFadeIn, toggleTiltGestures, updateTiltGesture, toggleAutoplay,
  } = usePlayer();

  const switchProps = (value, onChange) => ({
    value,
    onValueChange: onChange,
    trackColor: { false: COLORS.seekBarTrack, true: COLORS.primary + '70' },
    thumbColor: value ? COLORS.primary : COLORS.textMuted,
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Audio settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.group}>Playback</Text>

        <View style={s.row}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Autoplay</Text>
            <Text style={s.rowSub}>Keep playing similar songs when the queue ends</Text>
          </View>
          <Switch {...switchProps(autoplayEnabled, toggleAutoplay)} />
        </View>

        <View style={s.row}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Fade in</Text>
            <Text style={s.rowSub}>Ease each new song in over 2 seconds</Text>
          </View>
          <Switch {...switchProps(fadeInEnabled, toggleFadeIn)} />
        </View>

        <View style={[s.row, s.rowStack]}>
          <View style={s.rowLine}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Crossfade</Text>
              <Text style={s.rowSub}>Blend into the next song</Text>
            </View>
            <Text style={s.value}>{crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}s`}</Text>
          </View>
          <Slider
            style={s.slider}
            minimumValue={0} maximumValue={12} step={1}
            value={crossfadeDuration} onValueChange={updateCrossfade}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.seekBarTrack}
            thumbTintColor={COLORS.primary}
          />
        </View>

        <View style={[s.row, s.rowStack]}>
          <View style={s.rowLine}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>Speed</Text>
            </View>
            <Text style={s.value}>{playbackSpeed.toFixed(2).replace(/0$/, '')}x</Text>
          </View>
          <View style={s.speedRow}>
            {SPEEDS.map((speed) => {
              const active = playbackSpeed === speed;
              return (
                <TouchableOpacity key={speed} onPress={() => updatePlaybackSpeed(speed)} style={s.speedItem} activeOpacity={0.7}>
                  <Text style={[s.speedText, active && s.speedTextActive]}>{speed}x</Text>
                  <View style={[s.speedDot, active && { backgroundColor: COLORS.primary }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={s.group}>Sound</Text>

        <View style={s.row}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Bass boost</Text>
            <Text style={s.rowSub}>Raises volume 30% for a fuller low end</Text>
          </View>
          <Switch {...switchProps(bassBoostOn, toggleBassBoost)} />
        </View>

        <Text style={s.group}>Motion</Text>

        <View style={s.row}>
          <View style={s.rowText}>
            <Text style={s.rowTitle}>Tilt gestures</Text>
            <Text style={s.rowSub}>Control playback by tilting the phone</Text>
          </View>
          <Switch {...switchProps(tiltGesturesEnabled, toggleTiltGestures)} />
        </View>

        {tiltGesturesEnabled && (
          <View style={s.tiltWrap}>
            <Text style={s.hint}>Tap a direction to change what it does. Hold a volume tilt to keep adjusting.</Text>
            {TILT_DIRECTIONS.map((dir) => {
              const current = tiltGestureMap?.[dir.key] || 'none';
              return (
                <TouchableOpacity
                  key={dir.key}
                  style={s.tiltRow}
                  activeOpacity={0.6}
                  onPress={() => {
                    const i = TILT_ACTIONS.indexOf(current);
                    updateTiltGesture(dir.key, TILT_ACTIONS[(i + 1) % TILT_ACTIONS.length]);
                  }}
                >
                  <Ionicons name={dir.icon} size={16} color={COLORS.textMuted} />
                  <Text style={s.tiltDir}>{dir.label}</Text>
                  <Text style={[s.tiltAction, current === 'none' && { color: COLORS.textMuted }]}>
                    {TILT_ACTION_LABELS[current]}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={s.footnote}>Changes apply instantly.</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 60 },

  group: {
    color: COLORS.primary, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.6, textTransform: 'uppercase',
    marginTop: 30, marginBottom: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
  },
  rowStack: { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowText: { flex: 1 },
  rowTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  rowSub: { color: COLORS.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  value: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  slider: { width: '100%', height: 32, marginHorizontal: -4 },

  speedRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  speedItem: { alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4, gap: 7 },
  speedText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  speedTextActive: { color: COLORS.textPrimary, fontWeight: '800' },
  speedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },

  tiltWrap: { paddingTop: 12 },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  tiltRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
  },
  tiltDir: { color: COLORS.textSecondary, fontSize: 14.5, flex: 1 },
  tiltAction: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  footnote: { color: COLORS.textMuted, fontSize: 12, marginTop: 28, textAlign: 'center' },
});
