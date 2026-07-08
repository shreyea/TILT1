import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Modal, Platform } from 'react-native';
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

const Tab = createBottomTabNavigator();

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
  const [showIntro, setShowIntro] = useState(true);
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const tabBarHeight = 56 + bottomPad;
  
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
  }), [COLORS]);

  return (
    <View style={styles.container}>
      <Tabs />
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
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
  );
}

