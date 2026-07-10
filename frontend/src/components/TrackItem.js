import { useTheme } from '../context/ThemeContext';
// src/components/TrackItem.js
// Reusable track row component used in search results, playlists, and queue
// Wrapped in React.memo with custom comparator for optimal re-render performance
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';

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
  isPlaying = false,
  showIndex,
  index,
  rightAction,
  compact = false,
  drag,
  isActive = false,
}) {
  const { COLORS, SHADOWS } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress?.(track)}
      onLongPress={() => onLongPress?.(track)}
      style={[
        s.container,
        isPlaying && s.containerActive,
        compact && s.containerCompact,
        isActive && s.containerDragging,
      ]}
    >
      {/* Index or Art */}
      {showIndex ? (
        <View style={s.indexContainer}>
          {isPlaying ? (
            <Ionicons name="stats-chart" size={16} color={COLORS.primary} />
          ) : (
            <Text style={s.index}>{index + 1}</Text>
          )}
        </View>
      ) : (
        <View style={s.artContainer}>
          {track.art_url || track.art_url_small ? (
            <Image
              source={{ uri: track.art_url_small || track.art_url }}
              style={[s.art, compact && s.artSmall]}
            />
          ) : (
            <View style={[s.art, s.artPlaceholder, compact && s.artSmall]}>
              <Ionicons name="musical-notes" size={24} color={COLORS.textMuted} />
            </View>
          )}
          {isPlaying && (
            <View style={s.playingOverlay}>
              <Ionicons name="stats-chart" size={20} color="#FFF" />
            </View>
          )}
        </View>
      )}

      {/* Track Info */}
      <View style={s.info}>
        <Text
          style={[s.title, isPlaying && s.titleActive]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text style={s.subtitle} numberOfLines={1}>
          {track.artist}
          {track.album ? ` · ${track.album}` : ''}
        </Text>
      </View>

      {/* Duration / Right Action / Drag */}
      <View style={s.rightSection}>
        {track.duration_ms && !drag ? (
          <Text style={s.duration}>{formatDuration(track.duration_ms)}</Text>
        ) : null}
        {rightAction}
        {drag && (
          <TouchableOpacity onLongPress={drag} delayLongPress={100} style={s.dragHandle}>
            <Ionicons name="reorder-three" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Custom comparator — only re-render when these specific props change
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

const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  containerActive: {
    backgroundColor: COLORS.cardGlow,
  },
  containerDragging: {
    backgroundColor: COLORS.surfaceElevated,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    transform: [{ scale: 1.02 }],
  },
  containerCompact: {
    paddingVertical: SPACING.sm,
  },
  indexContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  index: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  indexActive: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.lg,
  },
  artContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  art: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.sm,
  },
  artSmall: {
    width: 40,
    height: 40,
  },
  artPlaceholder: {
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 18,
  },
  playingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 92, 246, 0.6)',
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  titleActive: {
    color: COLORS.primary,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  duration: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
  dragHandle: {
    paddingLeft: 10,
    paddingRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
