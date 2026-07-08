import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  interpolate,
  runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

const { height, width } = Dimensions.get('window');

// A single metallic letter that can be safely animated by a wrapping Animated.View
const GoldLetter = ({ text, isSlash }) => (
  <MaskedView
    style={s.singleMask}
    maskElement={
      <View style={s.singleMaskWrapper}>
        <Text style={isSlash ? s.slash : s.letter}>{text}</Text>
      </View>
    }
  >
    <LinearGradient
      colors={['#F5E1C3', '#E2B13C', '#F3C556', '#C99827', '#F5E1C3']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </MaskedView>
);

export default function IntroScreen({ onComplete }) {
  const pT1 = useSharedValue(0);
  const pSlash = useSharedValue(0);
  const pL = useSharedValue(0);
  const pT2 = useSharedValue(0);
  
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Cinematic timing: heavy, smooth easing
    const timingConfig = { duration: 1100, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };
    
    // The sequence captures them bending and falling from left to right
    pT1.value = withDelay(400, withTiming(1, timingConfig));
    pSlash.value = withDelay(550, withTiming(1, timingConfig));
    pL.value = withDelay(700, withTiming(1, timingConfig));
    pT2.value = withDelay(850, withTiming(1, timingConfig));

    // Dissolve into homepage seamlessly after letters fall
    containerOpacity.value = withDelay(2100, withTiming(0, { duration: 1000 }, (finished) => {
      if (finished && onComplete) {
        runOnJS(onComplete)();
      }
    }));
  }, []);

  const createAnimStyle = (progress, bendAngle, fallDistance) => {
    return useAnimatedStyle(() => {
      return {
        // Fade out as it reaches the bottom
        opacity: interpolate(progress.value, [0, 0.7, 1], [1, 1, 0]),
        transform: [
          { translateY: interpolate(progress.value, [0, 1], [0, fallDistance]) },
          { rotateZ: `${interpolate(progress.value, [0, 1], [0, bendAngle])}deg` },
          { scale: interpolate(progress.value, [0, 1], [1, 0.7]) },
        ],
      };
    });
  };

  const styleT1 = createAnimStyle(pT1, 45, height * 0.4);
  const styleSlash = createAnimStyle(pSlash, 60, height * 0.45);
  const styleL = createAnimStyle(pL, 75, height * 0.38);
  const styleT2 = createAnimStyle(pT2, 50, height * 0.4);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOpacity.value,
      transform: [
        { scale: interpolate(containerOpacity.value, [1, 0], [1, 1.08]) }
      ]
    };
  });

  return (
    <Animated.View style={[s.container, containerStyle]}>
      {/* Background radial gradient simulation via dark center */}
      <LinearGradient 
        colors={['#0B3C48', '#022A36']} 
        style={StyleSheet.absoluteFill}
      />

      {/* Abstract light refractions in the background */}
      <View style={s.lightRefractionAmber} />
      <View style={s.lightRefractionSage} />
      
      <View style={s.textContainer}>
        <Animated.View style={styleT1}>
          <GoldLetter text="T" />
        </Animated.View>
        <Animated.View style={styleSlash}>
          <GoldLetter text="\" isSlash />
        </Animated.View>
        <Animated.View style={styleL}>
          <GoldLetter text="L" />
        </Animated.View>
        <Animated.View style={styleT2}>
          <GoldLetter text="T" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#030305',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: width,
    height: 120, // Give fixed height so children can be masked properly
  },
  singleMask: {
    width: 60,
    height: 100,
    marginHorizontal: 4,
  },
  singleMaskWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  letter: {
    fontSize: 72,
    fontWeight: '900',
    color: 'black',
    letterSpacing: 0,
  },
  slash: {
    fontSize: 72,
    fontWeight: '200',
    color: 'black',
  },
  lightRefractionAmber: {
    position: 'absolute',
    width: width * 1.5,
    height: 80,
    backgroundColor: 'rgba(226, 177, 60, 0.15)', // Amber glow
    top: height / 2 - 40,
    left: -width * 0.25,
    transform: [{ rotate: '15deg' }],
    opacity: 0.8,
  },
  lightRefractionSage: {
    position: 'absolute',
    width: width * 1.5,
    height: 120,
    backgroundColor: 'rgba(135, 168, 164, 0.12)', // Sage glow
    top: height / 2 - 20,
    left: -width * 0.25,
    transform: [{ rotate: '-25deg' }],
    opacity: 0.9,
  }
});
