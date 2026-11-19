import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface GpsTrackLogoProps {
  size?: 'small' | 'medium' | 'large';
  showContainer?: boolean;
  textColorMode?: 'light' | 'dark';
}

export function GpsTrackLogo({
  size = 'medium',
  showContainer = false,
  textColorMode = 'dark',
}: GpsTrackLogoProps) {
  if (showContainer) {
    const boxSize = size === 'large' ? 140 : size === 'medium' ? 100 : 70;
    return (
      <View style={[styles.containerBox, { width: boxSize, height: boxSize }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: '100%', height: '100%', borderRadius: boxSize * 0.22 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Vector render without background box (great for headers and navigation bars)
  const isLarge = size === 'large';
  const isSmall = size === 'small';
  const scale = isLarge ? 1.3 : isSmall ? 0.7 : 1.0;

  const gpsColor = textColorMode === 'light' ? '#FFFFFF' : '#1E293B';
  const trackColor = '#F97316'; // Vibrant orange from logo

  return (
    <View style={styles.vectorWrap}>
      <Svg width={90 * scale} height={50 * scale} viewBox="0 0 90 50">
        {/* Blue GPS Location Pin Outline */}
        <Path
          d="M 22 8 C 14 8 8 14 8 22 C 8 32 22 45 22 45 C 22 45 36 32 36 22 C 36 14 30 8 22 8 Z"
          fill="none"
          stroke="#2563EB"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner Pin Circle */}
        <Circle cx="22" cy="22" r="6" fill="none" stroke="#2563EB" strokeWidth="3" />

        {/* Orange Connected Waypoint Trajectory Trail */}
        <Path
          d="M 23 44 C 30 44 35 40 40 30 C 45 20 48 20 54 22 C 58 24 62 38 68 38 C 73 38 78 20 84 18"
          fill="none"
          stroke="#F97316"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Waypoint Nodes */}
        <Circle cx="50" cy="20" r="4" fill="#1E293B" stroke="#F97316" strokeWidth="3" />
        <Circle cx="64" cy="34" r="4" fill="#1E293B" stroke="#F97316" strokeWidth="3" />
        <Circle cx="84" cy="18" r="4.5" fill="#F97316" />
      </Svg>

      {/* Typography: GPS TRACK */}
      <View style={styles.textRow}>
        <Text
          style={[
            styles.gpsText,
            { color: gpsColor, fontSize: isLarge ? 24 : isSmall ? 15 : 19 },
          ]}
        >
          GPS{' '}
        </Text>
        <Text
          style={[
            styles.trackText,
            { color: trackColor, fontSize: isLarge ? 24 : isSmall ? 15 : 19 },
          ]}
        >
          TRACK
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerBox: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  vectorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gpsText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  trackText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
