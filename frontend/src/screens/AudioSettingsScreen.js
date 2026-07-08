import { useTheme } from '../context/ThemeContext';
import React, { useMemo,  useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Platform, Switch
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayer } from '../context/PlayerContext';
import { SPACING, BORDER_RADIUS } from '../theme';
const EQ_BANDS = [
  { label: '60', freq: '60Hz' },
  { label: '230', freq: '230Hz' },
  { label: '910', freq: '910Hz' },
  { label: '3.6k', freq: '3.6kHz' },
  { label: '14k', freq: '14kHz' },
];
const EQ_PRESETS = [
  { name: 'Flat', values: [0, 0, 0, 0, 0] },
  { name: 'Bass Boost', values: [6, 4, 0, 0, 0] },
  { name: 'Treble Boost', values: [0, 0, 0, 3, 6] },
  { name: 'Rock', values: [4, 2, -1, 3, 5] },
  { name: 'Pop', values: [-1, 2, 4, 2, -1] },
  { name: 'Jazz', values: [3, 0, 1, 3, 4] },
  { name: 'Classical', values: [4, 2, -1, 2, 4] },
  { name: 'Hip Hop', values: [5, 3, 0, 1, 3] },
  { name: 'Electronic', values: [4, 2, 0, 2, 5] },
];
export default function AudioSettingsScreen({ onClose }) {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);


  const {
    crossfadeDuration, playbackSpeed, bassBoostOn, fadeInEnabled,
    updateCrossfade, updatePlaybackSpeed, toggleBassBoost, toggleFadeIn,
  } = usePlayer();
  const [spatialAudio, setSpatialAudio] = useState(false);
  const [eqEnabled, setEqEnabled] = useState(false);
  const [eqValues, setEqValues] = useState([0, 0, 0, 0, 0]);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const applyPreset = (preset) => {

    setSelectedPreset(preset.name);
    setEqValues([...preset.values]);
  };
  const updateBand = (index, value) => {

    const newVals = [...eqValues];
    newVals[index] = Math.round(value);
    setEqValues(newVals);
    setSelectedPreset('Custom');
  };
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LinearGradient colors={[COLORS.primary + '30', COLORS.background]}
        style={StyleSheet.absoluteFill} locations={[0, 0.3]} />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Audio Settings</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active indicator */}
        <View style={s.activeBar}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.secondary} />
          <Text style={s.activeText}>Changes apply in real-time</Text>
        </View>
        {/* Crossfade — FUNCTIONAL */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="git-compare-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Crossfade</Text>
              <Text style={s.cardSub}>Smooth transition between tracks</Text>
            </View>
            <Text style={s.valueLabel}>
              {crossfadeDuration === 0 ? 'Off' : `${crossfadeDuration}s`}
            </Text>
          </View>
          <Slider
            style={s.slider}
            minimumValue={0} maximumValue={12} step={1}
            value={crossfadeDuration} onValueChange={updateCrossfade}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.seekBarTrack}
            thumbTintColor={COLORS.primary}
          />
          <View style={s.sliderLabels}>
            <Text style={s.sliderLabel}>Off</Text>
            <Text style={s.sliderLabel}>12s</Text>
          </View>
        </View>
        {/* Bass Boost — FUNCTIONAL */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="volume-high" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Bass Boost</Text>
              <Text style={s.cardSub}>Amplifies volume by 30% for richer bass</Text>
            </View>
            <Switch
              value={bassBoostOn} onValueChange={toggleBassBoost}
              trackColor={{ false: COLORS.seekBarTrack, true: COLORS.primary + '60' }}
              thumbColor={bassBoostOn ? COLORS.primary : COLORS.textMuted}
            />
          </View>
          {bassBoostOn && (
            <View style={s.activeIndicator}>
              <Ionicons name="radio" size={14} color={COLORS.secondary} />
              <Text style={s.activeIndicatorText}>Active -- Volume amplified</Text>
            </View>
          )}
        </View>
        {/* Spatial Audio — Visual */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="headset" size={22} color="#06D6A0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Spatial Audio</Text>
              <Text style={s.cardSub}>Immersive 3D sound experience</Text>
            </View>
            <Switch
              value={spatialAudio} onValueChange={setSpatialAudio}
              trackColor={{ false: COLORS.seekBarTrack, true: COLORS.primary + '60' }}
              thumbColor={spatialAudio ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        </View>
        {/* Fade In/Out — FUNCTIONAL */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="pulse" size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Fade In / Out</Text>
              <Text style={s.cardSub}>Gradually fade volume when starting tracks</Text>
            </View>
            <Switch
              value={fadeInEnabled} onValueChange={toggleFadeIn}
              trackColor={{ false: COLORS.seekBarTrack, true: COLORS.primary + '60' }}
              thumbColor={fadeInEnabled ? COLORS.primary : COLORS.textMuted}
            />
          </View>
          {fadeInEnabled && (
            <View style={s.activeIndicator}>
              <Ionicons name="radio" size={14} color={COLORS.secondary} />
              <Text style={s.activeIndicatorText}>Active -- 2s fade on each new track</Text>
            </View>
          )}
        </View>
        {/* Playback Speed — FUNCTIONAL */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="speedometer-outline" size={22} color="#EC4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Playback Speed</Text>
              <Text style={s.cardSub}>Changes apply immediately</Text>
            </View>
            <Text style={s.valueLabel}>{playbackSpeed.toFixed(1)}x</Text>
          </View>
          <View style={s.speedRow}>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
              <TouchableOpacity
                key={speed}
                style={[s.speedChip, playbackSpeed === speed && s.speedChipActive]}
                onPress={() => updatePlaybackSpeed(speed)}
              >
                <Text style={[s.speedChipText, playbackSpeed === speed && { color: '#FFF' }]}>
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* Equalizer — Visual with presets */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="options" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Equalizer</Text>
              <Text style={s.cardSub}>{selectedPreset} preset</Text>
            </View>
            <Switch
              value={eqEnabled} onValueChange={setEqEnabled}
              trackColor={{ false: COLORS.seekBarTrack, true: COLORS.primary + '60' }}
              thumbColor={eqEnabled ? COLORS.primary : COLORS.textMuted}
            />
          </View>
          {eqEnabled && (
            <>
              {/* Preset chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.presetRow}>
                {EQ_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.name}
                    style={[s.presetChip, selectedPreset === preset.name && s.presetChipActive]}
                    onPress={() => applyPreset(preset)}
                  >
                    <Text style={[s.presetText, selectedPreset === preset.name && { color: '#FFF' }]}>
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* EQ Bands */}
              <View style={s.eqContainer}>
                {EQ_BANDS.map((band, i) => (
                  <View key={band.label} style={s.eqBand}>
                    <Text style={s.eqDbLabel}>{eqValues[i] > 0 ? '+' : ''}{eqValues[i]}dB</Text>
                    <View style={s.eqSliderWrap}>
                      <Slider
                        style={s.eqSlider}
                        minimumValue={-8} maximumValue={8} step={1}
                        value={eqValues[i]}
                        onValueChange={(v) => updateBand(i, v)}
                        minimumTrackTintColor={COLORS.primary}
                        maximumTrackTintColor={COLORS.seekBarTrack}
                        thumbTintColor={COLORS.primary}
                      />
                    </View>
                    <Text style={s.eqFreqLabel}>{band.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
        {/* Info note */}
        <View style={s.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={s.infoNoteText}>
            Crossfade, Bass Boost, Playback Speed, and Fade In apply to the audio engine in real-time. 
            Equalizer bands and Spatial Audio are visual presets for future native module integration.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  activeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary + '15', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.secondary + '25',
  },
  activeText: { color: COLORS.secondary, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl, padding: 18,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cardSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  valueLabel: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  slider: { width: '100%', marginTop: 14, height: 32 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  sliderLabel: { color: COLORS.textMuted, fontSize: 11 },
  activeIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  activeIndicatorText: { color: COLORS.secondary, fontSize: 12, fontWeight: '500' },
  speedRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  speedChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  speedChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  speedChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  presetRow: { gap: 8, marginTop: 16 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  eqContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 20, paddingHorizontal: 8,
  },
  eqBand: { alignItems: 'center', flex: 1 },
  eqDbLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 8 },
  eqSliderWrap: { height: 120, justifyContent: 'center' },
  eqSlider: { width: 120, height: 32, transform: [{ rotate: '-90deg' }] },
  eqFreqLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 8 },
  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 4, paddingTop: 8,
  },
  infoNoteText: { color: COLORS.textMuted, fontSize: 11, flex: 1, lineHeight: 16 },
});