// src/hooks/useBackHandler.js
// Lets a screen or overlay claim Android's hardware back button while it's
// open. Listeners registered later run first, so something opened on top
// (e.g. Ambient over Now Playing) closes before whatever is underneath it.
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

export default function useBackHandler(active, onBack) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handlerRef.current();
      return true;
    });
    return () => sub.remove();
  }, [active]);
}
