import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { traccarApi } from '../../services/api';
import { Position } from '../../types/traccar';
import { MapViewer } from '../../components/MapViewer';
import { PlaybackControls } from '../../components/PlaybackControls';

export default function PlaybackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);

  const { devices, speedUnit } = useTraccar();
  const device = devices.find((d) => d.id === deviceId);

  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'past24h'>('today');
  const [routePoints, setRoutePoints] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Playback state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1, 2, 5, 10

  const playTimerRef = useRef<any>(null);

  // Calculate start & end ISO dates
  const getDateBounds = (range: 'today' | 'yesterday' | 'past24h') => {
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    } else if (range === 'yesterday') {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { from: yesterdayStart.toISOString(), to: yesterdayEnd.toISOString() };
    } else {
      const past24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return { from: past24.toISOString(), to: now.toISOString() };
    }
  };

  const fetchRoute = async () => {
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentIndex(0);
    try {
      const { from, to } = getDateBounds(dateRange);
      const data = await traccarApi.getRoute(deviceId, from, to);
      setRoutePoints(data);
      if (data.length === 0) {
        Alert.alert('No Movement Data', 'No GPS fixes recorded for the selected period.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch historical route.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, [dateRange, deviceId]);

  // Handle Playback Loop
  useEffect(() => {
    if (isPlaying && routePoints.length > 0) {
      const intervalMs = Math.max(100, Math.floor(1000 / playbackSpeed));
      playTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= routePoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, routePoints.length]);

  const togglePlay = () => {
    if (routePoints.length === 0) return;
    if (currentIndex >= routePoints.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    if (currentIndex < routePoints.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const cycleSpeed = () => {
    if (playbackSpeed === 1) setPlaybackSpeed(2);
    else if (playbackSpeed === 2) setPlaybackSpeed(5);
    else if (playbackSpeed === 5) setPlaybackSpeed(10);
    else setPlaybackSpeed(1);
  };

  const currentPoint = routePoints[currentIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Time Range Selector */}
        <View style={styles.dateSelectorRow}>
          <TouchableOpacity
            style={[styles.rangeTab, dateRange === 'today' && styles.rangeTabActive]}
            onPress={() => setDateRange('today')}
          >
            <Text style={[styles.rangeTabText, dateRange === 'today' && styles.rangeTabTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rangeTab, dateRange === 'yesterday' && styles.rangeTabActive]}
            onPress={() => setDateRange('yesterday')}
          >
            <Text style={[styles.rangeTabText, dateRange === 'yesterday' && styles.rangeTabTextActive]}>
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rangeTab, dateRange === 'past24h' && styles.rangeTabActive]}
            onPress={() => setDateRange('past24h')}
          >
            <Text style={[styles.rangeTabText, dateRange === 'past24h' && styles.rangeTabTextActive]}>
              Last 24h
            </Text>
          </TouchableOpacity>
        </View>

        {/* Map Container */}
        <View style={styles.mapWrap}>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading Route Trail...</Text>
            </View>
          ) : (
            <MapViewer
              devices={[]}
              positions={{}}
              routeCoordinates={routePoints.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed,
                time: p.fixTime,
              }))}
              playbackPosition={
                currentPoint
                  ? {
                      latitude: currentPoint.latitude,
                      longitude: currentPoint.longitude,
                      course: currentPoint.course,
                    }
                  : undefined
              }
            />
          )}
        </View>

        {/* Player Bar */}
        <PlaybackControls
          isPlaying={isPlaying}
          currentIndex={currentIndex}
          totalPoints={routePoints.length}
          currentPoint={currentPoint}
          playbackSpeed={playbackSpeed}
          onTogglePlay={togglePlay}
          onStepForward={handleStepForward}
          onStepBackward={handleStepBackward}
          onChangeSpeed={cycleSpeed}
          speedUnit={speedUnit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  rangeTabActive: {
    backgroundColor: '#2563EB',
  },
  rangeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  rangeTabTextActive: {
    color: '#FFFFFF',
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  loadingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
});
