import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Position } from '../types/traccar';
import { formatSpeed } from '../utils/formatters';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentIndex: number;
  totalPoints: number;
  currentPoint?: Position;
  playbackSpeed: number; // 1, 2, 5, 10
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onChangeSpeed: () => void;
  speedUnit?: 'kmh' | 'mph';
}

export function PlaybackControls({
  isPlaying,
  currentIndex,
  totalPoints,
  currentPoint,
  playbackSpeed,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onChangeSpeed,
  speedUnit = 'kmh',
}: PlaybackControlsProps) {
  const progressPercent = totalPoints > 0 ? (currentIndex / (totalPoints - 1)) * 100 : 0;
  const pointTime = currentPoint?.fixTime
    ? new Date(currentPoint.fixTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  const pointSpeed = formatSpeed(currentPoint?.speed, speedUnit);

  return (
    <View style={styles.container}>
      {/* Telemetry at current playback point */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
          <Text style={styles.infoText}>{pointTime}</Text>
        </View>

        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="speedometer" size={16} color="#64748B" />
          <Text style={styles.infoText}>{pointSpeed}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.counterText}>
            {totalPoints > 0 ? currentIndex + 1 : 0} / {totalPoints}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* Playback Button Controls */}
      <View style={styles.controlsRow}>
        {/* Speed button */}
        <TouchableOpacity style={styles.speedButton} onPress={onChangeSpeed}>
          <Text style={styles.speedButtonText}>{playbackSpeed}x</Text>
        </TouchableOpacity>

        {/* Step back */}
        <TouchableOpacity style={styles.stepButton} onPress={onStepBackward}>
          <MaterialCommunityIcons name="skip-previous" size={24} color="#334155" />
        </TouchableOpacity>

        {/* Play / Pause main button */}
        <TouchableOpacity style={styles.playButton} onPress={onTogglePlay}>
          <MaterialCommunityIcons
            name={isPlaying ? 'pause' : 'play'}
            size={30}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Step forward */}
        <TouchableOpacity style={styles.stepButton} onPress={onStepForward}>
          <MaterialCommunityIcons name="skip-next" size={24} color="#334155" />
        </TouchableOpacity>

        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  counterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
  },
  speedButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  stepButton: {
    padding: 8,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});

