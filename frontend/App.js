import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import YouTubePlayerBridge from './src/components/YouTubePlayerBridge';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import QueueScreen from './src/screens/QueueScreen';
import HomeScreen from './src/screens/HomeScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import IntroScreen from './src/screens/IntroScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { Ionicons } from '@expo/vector-icons';
import { PlayerProvider } from './src/context/PlayerContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import * as Storage from './src/services/StorageService';

const Tab = createBottomTabNavigator();

// ─── Error Boundary ─────────────────────────────────────────
// Catches ANY uncaught JS error in the component tree and shows
// a fallback screen instead of crashing the entire app to homescreen.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ color: '#E2B13C', fontSize: 28, fontWeight: '800', marginBottom: 12 }}>T \ L T</Text>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#E2B13C', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Tab Bar ────────────────────────────────────────────────
// Custom bar instead of the stock one: icon-only, with a short accent rule
// marking the active tab. Labels and a filled bar were adding weight the rest
// of the UI had already shed.

const TAB_ICONS = {
  Home: ['home-outline', 'home'],
  Search: ['search-outline', 'search'],
  Library: ['library-outline', 'library'],
  Queue: ['list-outline', 'list'],
};

function TabBar({ state, navigation }) {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0);

  return (
    <View style={[tabStyles.wrap, { paddingBottom: bottomPad, backgroundColor: COLORS.background }]}>
      <View style={[tabStyles.hairline, { backgroundColor: COLORS.divider }]} />
      <View style={tabStyles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [idle, active] = TAB_ICONS[route.name] || TAB_ICONS.Home;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={route.name}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={tabStyles.tab}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? active : idle}
                size={21}
                color={focused ? COLORS.primary : COLORS.textMuted}
              />
              <View
                style={[
                  tabStyles.marker,
                  focused && { backgroundColor: COLORS.primary },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  hairline: { height: 1, width: '100%' },
  row: { flexDirection: 'row', paddingTop: 11 },
  tab: { flex: 1, alignItems: 'center', gap: 7, paddingBottom: 6 },
  marker: { width: 14, height: 2, borderRadius: 1, backgroundColor: 'transparent' },
});

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Queue" component={QueueScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { COLORS } = useTheme();
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showIntro, setShowIntro] = useState(null); // null = loading, true/false = resolved
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const tabBarHeight = 56 + bottomPad;

  // Load intro shown state from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const introShown = await Storage.getIntroShown();
        setShowIntro(!introShown); // Show intro if NOT previously shown
      } catch (e) {
        setShowIntro(false); // On error, skip intro
      }
    })();
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    Storage.saveIntroShown(true); // Persist — never show again
  };
  
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    nowPlayingOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: COLORS.background, zIndex: 100, elevation: 100,
    },
  }), [COLORS]);

  return (
    <View style={styles.container}>
      <Tabs />
      {showIntro === true && <IntroScreen onComplete={handleIntroComplete} />}
      <MiniPlayer
        onPress={() => setShowNowPlaying(true)}
        tabBarHeight={tabBarHeight}
      />
      {showNowPlaying && (
        <Animated.View
          style={styles.nowPlayingOverlay}
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(200)}
        >
          <NowPlayingScreen onClose={() => setShowNowPlaying(false)} />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <PlayerProvider>
              <YouTubePlayerBridge />
              <NavigationContainer>
                <AppContent />
              </NavigationContainer>
            </PlayerProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
