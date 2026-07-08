import { useTheme } from '../context/ThemeContext';
// src/components/MiniPlayer.js
// Persistent mini player shown at bottom of all screens above the tab bar
import React, { useMemo,  useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { toggleLike, checkLiked } from '../api';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../theme';

const { width: W } = Dimensions.get('window');

export default function MiniPlayer({ onPress, tabBarHeight = 68 }) {
  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();
  const s = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);



  const { currentTrack, isPlaying, isLoading, togglePlay, playNext, position, duration } = usePlayer();
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (currentTrack?.id) {
      checkLiked(currentTrack.id).then(setLiked);
    }
  }, [currentTrack?.id]);

  const handleLike = async () => {
    if (!currentTrack) return;
    const nowLiked = await toggleLike(currentTrack);
    if (nowLiked !== null) setLiked(nowLiked);
  };

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={[s.container, { bottom: tabBarHeight + 6 }]}
    >
      <View style={s.inner}>
        {/* Subtle progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={s.content}>
          {/* Album Art */}
          <View style={s.artContainer}>
            {currentTrack.art_url ? (
              <Image source={{ uri: currentTrack.art_url }} style={s.art} />
            ) : (
              <View style={[s.art, s.artPlaceholder]}>
                <Ionicons name="musical-notes" size={20} color={COLORS.textMuted} />
              </View>
            )}
          </View>

          {/* Track Info */}
          <View style={s.info}>
            <Text style={s.title} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity onPress={handleLike} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={19}
                color={liked ? '#EF4444' : 'rgba(255,255,255,0.4)'}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlay} style={s.playBtn}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name={isPlaying ? "pause" : "play"} size={17} color="#FFF"
                  style={{ marginLeft: isPlaying ? 0 : 2 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={playNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="play-skip-forward" size={17} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS, SHADOWS) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  inner: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressFill: {
    height: 2.5,
    backgroundColor: COLORS.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  artContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  art: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  artPlaceholder: {
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
