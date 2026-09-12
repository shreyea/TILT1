// src/screens/SearchScreen.js
// Search reads as one continuous surface: a hairline field, suggestions that
// drop straight under it, then results as full-bleed rows. No cards, no pills —
// the shared action sheet owns every per-track action.
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, StatusBar, Keyboard, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import { searchSongs, getArtistTracks } from '../api';
import TrackItem from '../components/TrackItem';
import TrackActionSheet from '../components/TrackActionSheet';
import EmptyState from '../components/EmptyState';
import { SPACING } from '../theme';
import { trackArt } from '../utils/trackArt';

export default function SearchScreen() {
  const { COLORS } = useTheme();
  const s = useMemo(() => createStyles(COLORS), [COLORS]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [artistTracks, setArtistTracks] = useState([]);
  const [artistName, setArtistName] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sheetTrack, setSheetTrack] = useState(null);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const { playTrack, currentTrack, playAll } = usePlayer();

  useEffect(() => () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const onQueryChange = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      try {
        const data = await searchSongs(text.trim(), abortRef.current.signal);
        setSuggestions(data.slice(0, 5));
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);
  }, []);

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    Keyboard.dismiss();
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setSearched(true);
    setFailed(false);
    setSuggestions([]);

    try {
      const data = await searchSongs(query.trim(), abortRef.current.signal);
      setResults(data);

      const firstArtist = data[0]?.artist?.split(',')[0]?.trim();
      if (firstArtist) {
        setArtistName(firstArtist);
        const at = await getArtistTracks(firstArtist, 10);
        const ids = new Set(data.map(d => d.id));
        setArtistTracks(at.filter(t => !ids.has(t.id)).slice(0, 6));
      } else {
        setArtistTracks([]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setFailed(true);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSuggestionPress = useCallback((track) => {
    setSuggestions([]);
    setQuery(`${track.title} ${track.artist}`);
    playTrack(track);
  }, [playTrack]);

  const clearSearch = useCallback(() => {
    abortRef.current?.abort();
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setSearched(false);
    setFailed(false);
    setArtistTracks([]);
    setArtistName('');
  }, []);

  const renderTrackItem = useCallback(({ item }) => (
    <TrackItem
      track={item}
      onPress={playTrack}
      isPlaying={currentTrack?.id === item.id}
      onMore={setSheetTrack}
    />
  ), [currentTrack?.id, playTrack]);

  const showSuggestions = focused && suggestions.length > 0 && !loading;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={s.header}>
        <Text style={s.title}>Search</Text>

        <View style={[s.field, focused && { borderBottomColor: COLORS.primary }]}>
          <Ionicons name="search" size={18} color={focused ? COLORS.primary : COLORS.textMuted} />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onSubmitEditing={handleSearch}
            placeholder="Songs, artists, albums"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loadingSuggestions && <ActivityIndicator size="small" color={COLORS.textMuted} />}
          {query.length > 0 && !loadingSuggestions && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={17} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Suggestions hang off the field rather than floating in a card */}
      {showSuggestions && (
        <View style={s.suggestions}>
          {suggestions.map((item) => {
            const art = trackArt(item, { small: true });
            return (
              <TouchableOpacity
                key={`sug_${item.id}`}
                style={s.suggestionRow}
                onPress={() => handleSuggestionPress(item)}
                activeOpacity={0.6}
              >
                {art ? (
                  <Image source={{ uri: art }} style={s.suggestionArt} />
                ) : (
                  <View style={[s.suggestionArt, s.artPlaceholder]}>
                    <Ionicons name="musical-notes" size={14} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.suggestionTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.suggestionArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
                <Ionicons name="play" size={13} color={COLORS.textMuted} />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={s.seeAll} onPress={handleSearch}>
            <Text style={s.seeAllText}>See all results for "{query.trim()}"</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : failed ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Can't reach the server"
          body="Search needs the backend awake. It may just be waking up — give it a moment."
          actionLabel="Try again"
          onAction={handleSearch}
        />
      ) : !searched ? (
        <EmptyState
          icon="search-outline"
          title="What are you in the mood for?"
          body="Search any song or artist. It streams straight through — no ads, no interruptions."
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon="telescope-outline"
          title={`Nothing for "${query.trim()}"`}
          body="Try a different spelling, or search just the artist's name."
          actionLabel="Clear search"
          onAction={clearSearch}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `res_${item.id}_${i}`}
          renderItem={renderTrackItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 190 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={s.resultsBar}>
              <Text style={s.resultsCount}>{results.length} results</Text>
              <TouchableOpacity onPress={() => playAll(results)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.playAll}>Play all</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            artistTracks.length > 0 ? (
              <View style={s.artistSection}>
                <View style={s.resultsBar}>
                  <Text style={s.sectionTitle}>More from {artistName}</Text>
                  <TouchableOpacity onPress={() => playAll(artistTracks)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={s.playAll}>Play all</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel}>
                  {artistTracks.map((item) => {
                    const art = trackArt(item);
                    return (
                      <TouchableOpacity
                        key={`art_${item.id}`}
                        style={s.card}
                        activeOpacity={0.75}
                        onPress={() => playTrack(item)}
                        onLongPress={() => setSheetTrack(item)}
                        delayLongPress={280}
                      >
                        {art ? (
                          <Image source={{ uri: art }} style={s.cardArt} />
                        ) : (
                          <View style={[s.cardArt, s.artPlaceholder]}>
                            <Ionicons name="musical-notes" size={24} color={COLORS.textMuted} />
                          </View>
                        )}
                        <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={s.cardArtist} numberOfLines={1}>{item.artist}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null
          }
        />
      )}

      <TrackActionSheet track={sheetTrack} visible={!!sheetTrack} onClose={() => setSheetTrack(null)} />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingTop: Platform.OS === 'ios' ? 62 : 50,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 4,
  },
  title: { fontSize: 30, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.6 },

  // A rule, not a box — the field belongs to the page.
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginTop: 18, paddingBottom: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '500', paddingVertical: 2 },

  suggestions: { paddingHorizontal: SPACING.xl, paddingTop: 6 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  suggestionArt: { width: 38, height: 38, borderRadius: 6 },
  artPlaceholder: {
    backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center',
  },
  suggestionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  suggestionArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  seeAll: { paddingVertical: 12, marginTop: 2 },
  seeAllText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  resultsBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: SPACING.xl, paddingTop: 20, paddingBottom: 10,
  },
  resultsCount: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  playAll: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  artistSection: { marginTop: 22 },
  carousel: { paddingHorizontal: SPACING.xl, gap: 16 },
  card: { width: 132 },
  cardArt: { width: 132, height: 132, borderRadius: 11, marginBottom: 9 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  cardArtist: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
});
