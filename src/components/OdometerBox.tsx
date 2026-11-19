import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OdometerBoxProps {
  label: string;
  value: string; // e.g. "629.46" or "0000KM"
}

export function OdometerBox({ label, value }: OdometerBoxProps) {
  const characters = value.split('');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.digitsRow}>
        {characters.map((char, index) => (
          <View
            key={index}
            style={[
              styles.digitBox,
              char === '.' ? styles.dotBox : undefined,
            ]}
          >
            <Text style={[styles.digitText, char === '.' ? styles.dotText : undefined]}>
              {char}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 3,
    borderRadius: 6,
    gap: 2,
  },
  digitBox: {
    width: 17,
    height: 24,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  },
  dotBox: {
    width: 8,
    backgroundColor: 'transparent',
  },
  digitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  dotText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

