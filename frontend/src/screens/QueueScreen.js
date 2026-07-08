import { useTheme } from '../context/ThemeContext';
import React, { useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import TrackItem from '../components/TrackItem';

export default function QueueScreen() {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);


  const { queue, currentTrack, playTrack, removeFromQueue, clearQueue,
    shuffleOn, toggleShuffle, repeatMode, cycleRepeat } = usePlayer();
  const getRepeatLabel = () => {

    if (repeatMode === 'off') return { text: 'Repeat Off', icon: 'repeat-outline' };
    if (repeatMode === 'one') return { text: 'Repeat One', icon: 'sync' };
    return { text: 'Repeat All', icon: 'repeat' };
  };
  const rpt = getRepeatLabel();
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LinearGradient colors={[COLORS.gradientMid + '25', COLORS.background]} style={s.header}>
        <Text style={s.title}>Queue</Text>
        <View style={s.controls}>
          <TouchableOpacity onPress={toggleShuffle}
            style={[s.chip, shuffleOn && { backgroundColor: COLORS.primary + '30', borderColor: COLORS.primary }]}>
            <Ionicons name="shuffle" size={16} color={shuffleOn ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[s.chipText, shuffleOn && { color: COLORS.primary }]}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleRepeat}
            style={[s.chip, repeatMode !== 'off' && { backgroundColor: COLORS.primary + '30', borderColor: COLORS.primary }]}>
            <Ionicons name={rpt.icon} size={16} color={repeatMode !== 'off' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[s.chipText, repeatMode !== 'off' && { color: COLORS.primary }]}>{rpt.text}</Text>
          </TouchableOpacity>
          {queue.length > 0 && (
            <TouchableOpacity onPress={clearQueue} style={s.chip}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              <Text style={[s.chipText, { color: COLORS.error }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
      {currentTrack && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Now Playing</Text>
          <TrackItem track={currentTrack} isPlaying onPress={() => {}} />
        </View>
      )}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Up Next · {queue.length} tracks</Text>
      </View>
      <FlatList
        data={queue} keyExtractor={(item, i) => item.id + '_' + i}
        renderItem={({ item, index }) => (
          <TrackItem track={item} onPress={playTrack} showIndex={true} index={index}
            rightAction={
              <TouchableOpacity onPress={() => removeFromQueue(index)} style={s.removeBtn}>
                <Ionicons name="close" size={16} color={COLORS.error} />
              </TouchableOpacity>
            }
          />
        )}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="list" size={64} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
            <Text style={s.emptyText}>Queue is empty</Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Search and add songs to play next</Text>
          </View>
        }
      />
    </View>
  );
}
const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 34, fontWeight: '800', color: '#FFF' },
  controls: { flexDirection: 'row', marginTop: 14, gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.cardBorder },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error + '20', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  center: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});