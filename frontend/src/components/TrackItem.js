// src/components/TrackItem.js
// Shared track row. Takes an `onMore` handler and renders a single overflow
// button for it — callers used to inject their own icon buttons here, which
// gave tiny targets nested inside a pressable row, so taps fell through to
// playback. One button, one owner, 44pt target.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';
import { trackArt } from '../utils/trackArt';

function formatDuration(ms) {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function TrackItem({
  track,
  onPress,
  onLongPress,
  onMore,
  isPlaying = false,
  showIndex,
  index,
  rightAction,
  compact = false,
  drag,
  isActive = false,
}) {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);
  const art = trackArt(track, { small: true });

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress?.(track)}
      onLongPress={() => (onMore || onLongPress)?.(track)}
      delayLongPress={280}
      style={[s.container, compact && s.containerCompact, isActive && s.containerDragging]}
    >
      {/* A hairline marks the playing row instead of a filled block */}
      {isPlaying && <View style={s.activeBar} />}

      {showIndex ? (
        <View style={s.indexContainer}>
          {isPlaying ? (
            <Ionicons name="volume-medium" size={15} color={COLORS.primary} />
          ) : (
            <Text style={s.index}>{index + 1}</Text>
          )}
        </View>
      ) : (
        <View style={s.artContainer}>
          {art ? (
            <Image source={{ uri: art }} style={[s.art, compact && s.artSmall]} />
          ) : (
            <View style={[s.art, s.artPlaceholder, compact && s.artSmall]}>
              <Ionicons name="musical-notes" size={20} color={COLORS.textMuted} />
            </View>
          )}
        </View>
      )}

      <View style={s.info}>
        <Text style={[s.title, isPlaying && s.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={s.subtitle} numberOfLines={1}>{track.artist}</Text>
      </View>

      <View style={s.rightSection}>
        {track.duration_ms && !drag ? (
          <Text style={s.duration}>{formatDuration(track.duration_ms)}</Text>
        ) : null}

        {rightAction}

        {onMore && !drag && (
          <TouchableOpacity
            onPress={() => onMore(track)}
            style={s.moreBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {drag && (
          <TouchableOpacity onLongPress={drag} delayLongPress={100} style={s.dragHandle}>
            <Ionicons name="reorder-three" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function areEqual(prev, next) {
  return (
    prev.track?.id === next.track?.id &&
    prev.isPlaying === next.isPlaying &&
    prev.isActive === next.isActive &&
    prev.index === next.index &&
    prev.compact === next.compact &&
    prev.showIndex === next.showIndex
  );
}

export default React.memo(TrackItem, areEqual);

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: SPACING.xl,
  },
  containerCompact: { paddingVertical: SPACING.sm },
  containerDragging: {
    backgroundColor: COLORS.surfaceLight,
    transform: [{ scale: 1.01 }],
  },
  activeBar: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 2, borderRadius: 1, backgroundColor: COLORS.primary,
  },
  indexContainer: { width: 26, alignItems: 'center', marginRight: SPACING.md },
  index: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontWeight: '500' },
  artContainer: { marginRight: SPACING.md },
  art: { width: 48, height: 48, borderRadius: BORDER_RADIUS.sm },
  artSmall: { width: 40, height: 40 },
  artPlaceholder: {
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, marginRight: SPACING.sm },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  titleActive: { color: COLORS.primary },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 2 },
  rightSection: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  duration: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontVariant: ['tabular-nums'] },
  moreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  dragHandle: { paddingLeft: 8, justifyContent: 'center', alignItems: 'center' },
});
