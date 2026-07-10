import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import { BlurView } from 'expo-blur';
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

// ─── Tab Icon ───────────────────────────────────────────────

function TabIcon({ label, focused }) {
  const { COLORS } = useTheme();
  const icons = { 
    Home: focused ? 'home' : 'home-outline',
    Search: focused ? 'search' : 'search-outline', 
    Library: focused ? 'library' : 'library-outline', 
    Queue: focused ? 'list' : 'list-outline' 
  };
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Ionicons name={icons[label]} size={22} color={focused ? COLORS.primary : COLORS.textMuted} />
    </View>
  );
}

function Tabs() {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  // Properly account for the system navigation bar on Android
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const tabBarHeight = 56 + bottomPad;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background, opacity: 0.95 }]} />
          )
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
      })}
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
  }), [COLORS]);

  return (
    <View style={styles.container}>
      <Tabs />
      {showIntro === true && <IntroScreen onComplete={handleIntroComplete} />}
      <MiniPlayer
        onPress={() => setShowNowPlaying(true)}
        tabBarHeight={tabBarHeight}
      />
      <Modal
        visible={showNowPlaying}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNowPlaying(false)}
      >
        <NowPlayingScreen onClose={() => setShowNowPlaying(false)} />
      </Modal>
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
