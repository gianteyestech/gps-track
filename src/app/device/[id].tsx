import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import {
  getDeviceOperationalStatus,
  getStatusColor,
  getStatusLabel,
  formatSpeed,
  formatDistance,
  getHeadingDirection,
} from '../../utils/formatters';
import { SendCommandModal } from '../../components/SendCommandModal';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);

  const { devices, positions, speedUnit, setSelectedDeviceId } = useTraccar();
  const [commandModalVisible, setCommandModalVisible] = useState(false);

  const device = devices.find((d) => d.id === deviceId);
  const position = positions[deviceId];

  if (!device) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Device not found.</Text>
      </SafeAreaView>
    );
  }

  const status = getDeviceOperationalStatus(device, position);
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  const speed = formatSpeed(position?.speed, speedUnit);
  const ignition = position?.attributes?.ignition;
  const battery = position?.attributes?.batteryLevel ?? position?.attributes?.battery;
  const totalDistance = formatDistance(position?.attributes?.totalDistance);
  const engineHours = position?.attributes?.hours
    ? `${(position.attributes.hours / 3600000).toFixed(1)} hrs`
    : 'N/A';
  const heading = position ? `${Math.round(position.course)}° (${getHeadingDirection(position.course)})` : 'N/A';

  const handleShareLocation = async () => {
    if (!position) return;
    try {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${position.latitude},${position.longitude}`;
      await Share.share({
        title: `Location of ${device.name}`,
        message: `${device.name} is currently at: ${mapsUrl}`,
      });
    } catch {}
  };

  const handleOpenLiveMap = () => {
    setSelectedDeviceId(device.id);
    router.push('/(tabs)/map');
  };

  const handleOpenPlayback = () => {
    router.push({
      pathname: '/playback/[id]',
      params: { id: device.id.toString() },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Vehicle Summary Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.avatarBox, { backgroundColor: `${statusColor}18` }]}>
              <MaterialCommunityIcons name="car" size={28} color={statusColor} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceImei}>IMEI: {device.uniqueId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Speed & Ignition Large Display */}
          <View style={styles.speedDisplayBox}>
            <View style={styles.speedCol}>
              <Text style={styles.speedValue}>{speed}</Text>
              <Text style={styles.speedSub}>Current Velocity</Text>
            </View>
            <View style={styles.speedDivider} />
            <View style={styles.speedCol}>
              <View style={styles.ignitionRow}>
                <MaterialCommunityIcons
                  name="key-variant"
                  size={20}
                  color={ignition ? '#10B981' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.ignitionStatus,
                    { color: ignition ? '#10B981' : '#64748B' },
                  ]}
                >
                  {ignition ? 'Ignition ON' : 'Ignition OFF'}
                </Text>
              </View>
              <Text style={styles.speedSub}>Engine State</Text>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryAction} onPress={handleOpenLiveMap}>
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Live Track</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={handleOpenPlayback}>
              <MaterialCommunityIcons name="history" size={18} color="#2563EB" />
              <Text style={styles.secondaryActionText}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryAction, styles.dangerAction]}
              onPress={() => setCommandModalVisible(true)}
            >
              <MaterialCommunityIcons name="remote" size={18} color="#EF4444" />
              <Text style={[styles.secondaryActionText, { color: '#EF4444' }]}>Command</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location & Coordinates */}
        <Text style={styles.sectionHeader}>Location & Geocoding</Text>
        <View style={styles.card}>
          {position?.address && (
            <View style={styles.telemetryRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#64748B" />
              <View style={styles.telemetryCol}>
                <Text style={styles.telemetryLabel}>Address</Text>
                <Text style={styles.telemetryValue}>{position.address}</Text>
              </View>
            </View>
          )}

          <View style={styles.telemetryRow}>
            <MaterialCommunityIcons name="compass-outline" size={20} color="#64748B" />
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Coordinates</Text>
              <Text style={styles.telemetryValue}>
                {position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.telemetryRow}>
            <MaterialCommunityIcons name="navigation-variant-outline" size={20} color="#64748B" />
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Heading & Direction</Text>
              <Text style={styles.telemetryValue}>{heading}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareLocation}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#2563EB" />
            <Text style={styles.shareBtnText}>Share GPS Location</Text>
          </TouchableOpacity>
        </View>

        {/* Telemetry & Sensor Details */}
        <Text style={styles.sectionHeader}>Diagnostics & Telemetry</Text>
        <View style={styles.card}>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="battery-high" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>Battery</Text>
              <Text style={styles.cellValue}>
                {battery !== undefined ? `${Math.round(battery)}%` : 'N/A'}
              </Text>
            </View>

            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="counter" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>Odometer</Text>
              <Text style={styles.cellValue}>{totalDistance}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>Engine Hours</Text>
              <Text style={styles.cellValue}>{engineHours}</Text>
            </View>

            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="satellite-variant" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>Satellites</Text>
              <Text style={styles.cellValue}>{position?.attributes?.sat ?? 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="signal" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>GSM Signal</Text>
              <Text style={styles.cellValue}>
                {position?.attributes?.rssi ? `${position.attributes.rssi} / 31` : 'Good'}
              </Text>
            </View>

            <View style={styles.gridCell}>
              <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#64748B" />
              <Text style={styles.cellLabel}>Immobilizer</Text>
              <Text
                style={[
                  styles.cellValue,
                  { color: position?.attributes?.blocked ? '#DC2626' : '#10B981' },
                ]}
              >
                {position?.attributes?.blocked ? 'Cut Off' : 'Normal'}
              </Text>
            </View>
          </View>
        </View>

        {/* Timestamps */}
        <Text style={styles.sectionHeader}>Timestamps</Text>
        <View style={styles.card}>
          <View style={styles.timestampRow}>
            <Text style={styles.timeLabel}>GPS Fix Time:</Text>
            <Text style={styles.timeVal}>
              {position?.fixTime ? new Date(position.fixTime).toLocaleString() : 'N/A'}
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timeLabel}>Server Received:</Text>
            <Text style={styles.timeVal}>
              {position?.serverTime ? new Date(position.serverTime).toLocaleString() : 'N/A'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Command Modal */}
      <SendCommandModal
        visible={commandModalVisible}
        device={device}
        onClose={() => setCommandModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceImei: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  speedDisplayBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  speedCol: {
    flex: 1,
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  speedSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  speedDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  ignitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ignitionStatus: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  dangerAction: {
    backgroundColor: '#FEF2F2',
  },
  secondaryActionText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  telemetryCol: {
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  telemetryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 4,
    gap: 6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  gridCell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cellLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  timeLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  timeVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
});

