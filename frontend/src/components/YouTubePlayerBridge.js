// src/components/YouTubePlayerBridge.js
// Hidden WebView that runs YouTube's official IFrame Player API
// Singleton pattern — one bridge controls all playback
// React Native communicates via postMessage ↔ onMessage

import React, { useRef, useEffect, useCallback } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

// ─── Singleton Event System ───────────────────────────────────
// Lets PlayerContext send commands without holding a ref to this component

const listeners = {};
const commandQueue = [];
let webViewReady = false;
let webViewRef = null;

export const YTBridge = {
  // Send a command to the YouTube player
  send(command) {
    const msg = JSON.stringify(command);
    if (webViewReady && webViewRef) {
      webViewRef.injectJavaScript(`handleCommand(${msg}); true;`);
    } else {
      commandQueue.push(msg);
    }
  },

  play(videoId) {
    this.send({ command: 'play', videoId });
  },

  pause() {
    this.send({ command: 'pause' });
  },

  resume() {
    this.send({ command: 'resume' });
  },

  seekTo(seconds) {
    this.send({ command: 'seekTo', time: seconds });
  },

  setVolume(vol) {
    // YouTube volume is 0-100, our app uses 0-1
    this.send({ command: 'setVolume', volume: Math.round(vol * 100) });
  },

  setPlaybackRate(rate) {
    this.send({ command: 'setPlaybackRate', rate });
  },

  stop() {
    this.send({ command: 'stop' });
  },

  // Event listeners
  on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  },

  off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.warn('[YTBridge] Listener error:', e); }
      });
    }
  },

  isReady() {
    return webViewReady;
  },
};

// ─── HTML for the YouTube IFrame Player ───────────────────────

const PLAYER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; overflow: hidden; }
    #player { width: 1px; height: 1px; position: absolute; top: -10px; left: -10px; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    // Load YouTube IFrame API
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    var player = null;
    var timeUpdateInterval = null;
    var currentVideoId = null;

    function send(obj) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      } catch(e) {}
    }

    // YouTube API calls this when ready
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: 'https://www.youtube.com'
        },
        events: {
          onReady: function(e) {
            send({ event: 'ready' });
          },
          onStateChange: function(e) {
            var state = e.data;
            // YT.PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
            var stateMap = {
              '-1': 'unstarted',
              '0': 'ended',
              '1': 'playing',
              '2': 'paused',
              '3': 'buffering',
              '5': 'cued'
            };
            send({ event: 'stateChange', state: stateMap[state] || 'unknown', code: state });

            if (state === 1) {
              // Start time updates when playing
              startTimeUpdates();
            } else if (state === 0) {
              // Track ended
              stopTimeUpdates();
              send({ event: 'ended' });
            } else if (state === 2) {
              stopTimeUpdates();
            }
          },
          onError: function(e) {
            send({ event: 'error', code: e.data });
          }
        }
      });
    }

    function startTimeUpdates() {
      stopTimeUpdates();
      timeUpdateInterval = setInterval(function() {
        if (player && player.getCurrentTime) {
          try {
            send({
              event: 'timeUpdate',
              currentTime: player.getCurrentTime(),
              duration: player.getDuration(),
              volume: player.getVolume ? player.getVolume() / 100 : 1
            });
          } catch(e) {}
        }
      }, 500);
    }

    function stopTimeUpdates() {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
      }
    }

    // Handle commands from React Native
    function handleCommand(cmd) {
      if (!player) return;

      switch (cmd.command) {
        case 'play':
          currentVideoId = cmd.videoId;
          try {
            player.loadVideoById(cmd.videoId);
          } catch(e) {
            send({ event: 'error', code: -1, message: e.message });
          }
          break;

        case 'pause':
          try { player.pauseVideo(); } catch(e) {}
          break;

        case 'resume':
          try { player.playVideo(); } catch(e) {}
          break;

        case 'seekTo':
          try { player.seekTo(cmd.time, true); } catch(e) {}
          break;

        case 'setVolume':
          try { player.setVolume(cmd.volume); } catch(e) {}
          break;

        case 'setPlaybackRate':
          try { player.setPlaybackRate(cmd.rate); } catch(e) {}
          break;

        case 'stop':
          stopTimeUpdates();
          try { player.stopVideo(); } catch(e) {}
          break;
      }
    }
  </script>
</body>
</html>
`;

// ─── React Component ──────────────────────────────────────────

export default function YouTubePlayerBridge() {
  const ref = useRef(null);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.event === 'ready') {
        webViewReady = true;
        // Flush any queued commands
        while (commandQueue.length > 0) {
          const cmd = commandQueue.shift();
          if (ref.current) {
            ref.current.injectJavaScript(`handleCommand(${cmd}); true;`);
          }
        }
      }

      // Emit to all listeners
      YTBridge.emit(data.event, data);
    } catch (e) {
      console.warn('[YTBridge] Parse error:', e);
    }
  }, []);

  useEffect(() => {
    webViewRef = ref.current;
    return () => {
      webViewReady = false;
      webViewRef = null;
    };
  });

  return (
    <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute', top: -100 }}
          pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: PLAYER_HTML, baseUrl: 'https://www.youtube.com' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        scrollEnabled={false}
        style={{ height: 1, width: 1 }}
        // Allow background audio on iOS
        {...(Platform.OS === 'ios' ? { allowsBackForwardNavigationGestures: false } : {})}
      />
    </View>
  );
}
