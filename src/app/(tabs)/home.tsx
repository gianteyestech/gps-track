import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { GTS_COLORS } from '../../constants/theme';
import { GpsTrackLogo } from '../../components/GpsTrackLogo';

export default function HomeScreen() {
  const { stats, devices } = useTraccar();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top GPS TRACK Logo */}
        <View style={styles.header}>
          <GpsTrackLogo size="medium" />
          <Text style={styles.headerSub}>Giant Eye Tech • Fleet Command Center</Text>
        </View>

        {/* Big Fleet Status Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Total Fleet Size</Text>
          <Text style={styles.heroNum}>{stats.total}</Text>
          <Text style={styles.heroSub}>Active GPS Trackers Connected</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <View style={[styles.dot, { backgroundColor: GTS_COLORS.statusRunning }]} />
              <Text style={styles.statVal}>{stats.moving}</Text>
              <Text style={styles.statLabel}>Running</Text>
            </View>

            <View style={styles.statCol}>
              <View style={[styles.dot, { backgroundColor: GTS_COLORS.statusStopped }]} />
              <Text style={styles.statVal}>{stats.stopped}</Text>
              <Text style={styles.statLabel}>Stopped</Text>
            </View>

            <View style={styles.statCol}>
              <View style={[styles.dot, { backgroundColor: GTS_COLORS.statusIdle }]} />
              <Text style={styles.statVal}>{stats.idle}</Text>
              <Text style={styles.statLabel}>Idle</Text>
            </View>

            <View style={styles.statCol}>
              <View style={[styles.dot, { backgroundColor: GTS_COLORS.statusOffline }]} />
              <Text style={styles.statVal}>{stats.offline}</Text>
              <Text style={styles.statLabel}>Offline</Text>
            </View>
          </View>
        </View>

        {/* Quick Launch Shortcuts */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
              <MaterialCommunityIcons name="car-multiple" size={26} color="#15803D" />
            </View>
            <Text style={styles.actionName}>Vehicles List</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/map')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={26} color="#2563EB" />
            </View>
            <Text style={styles.actionName}>Live Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/reports/1')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FFFBEB' }]}>
              <MaterialCommunityIcons name="file-chart" size={26} color="#D97706" />
            </View>
            <Text style={styles.actionName}>Fleet Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/events')}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#FEF2F2' }]}>
              <MaterialCommunityIcons name="bell-ring" size={26} color="#DC2626" />
            </View>
            <Text style={styles.actionName}>Active Alerts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 20,
    paddingBottom: 90,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  gtsLogoText: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  headerSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroNum: {
    fontSize: 44,
    fontWeight: '900',
    color: '#111827',
    marginVertical: 4,
  },
  heroSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  statCol: {
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
});

