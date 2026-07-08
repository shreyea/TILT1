# Tilt Music App

Tilt is a premium, full-stack music streaming application designed to offer a seamless, Spotify-like experience. The platform features robust playlist management, Spotify imports, real-time audio effects, and an incredibly smooth user interface.

##  Key Features

###  Premium Audio Experience
- **High-Performance Playback:** Smooth, interruption-free audio streaming built on top of `expo-audio`.
- **Advanced Audio Effects:** Real-time customizable equalizer settings including Bass Boost, Crossfade, and Playback Speed adjustments.
- **Synchronized Lyrics:** View real-time, time-synced lyrics that automatically scroll as the track plays.

###  Intelligent Library & Queue Management
- **Spotify Integration:** Directly import your favorite Spotify playlists into Tilt with a single tap.
- **Persistent Queue System:** Your current queue and playback state are saved between sessions.
- **Drag-and-Drop Reordering:** Easily organize your queue with smooth drag-and-drop gestures.
- **Dynamic Mini-Player:** Keep track of what's playing while navigating anywhere in the app.

###  Stunning UI/UX
- **Modern, Responsive Design:** Glassmorphism, smooth gradients, and micro-animations tailored for a premium feel.
- **Haptic Feedback:** Tactile responses across the app for button presses, scrubbing, and dragging items.
- **Seamless Navigation:** Fluid transitions and tab routing for a frictionless user experience.

##  Tech Stack  

### Frontend (Mobile App)
- **Framework:** React Native & Expo
- **Navigation:** React Navigation (Native & Bottom Tabs)
- **Audio Engine:** `expo-audio`
- **Animations:** React Native Reanimated & Gesture Handler
- **Styling:** Linear Gradients, Blur Views (Glassmorphism), Safe Area Context

### Backend (Server)
- **Framework:** Python (FastAPI / Flask)
- **Audio Processing:** Custom Python audio processing engine.
- **Integrations:** Spotify Web API for playlist and track metadata imports.

##  Project Structure

- `/frontend` - The React Native (Expo) mobile application.
- `/backend` - The Python-based API server handling audio, metadata, and Spotify integration.

##  Getting Started Locally

Please refer to the [INSTALL.md](./INSTALL.md) file for comprehensive instructions on how to install, build, and share this application.
