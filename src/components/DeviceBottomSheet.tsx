import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Device, Position } from '../types/traccar';
import {
  getDeviceOperationalStatus,
  getStatusColor,
  getStatusLabel,
  formatSpeed,
  formatDistance,
} from '../utils/formatters';

interface DeviceBottomSheetProps {
  device: Device;
  position?: Position;
  onClose: () => void;
  onNavigateDetail: () => void;
  onNavigatePlayback: () => void;
  onOpenCommand: () => void;
  speedUnit?: 'kmh' | 'mph';
}

export function DeviceBottomSheet({
  device,
  position,
  onClose,
  onNavigateDetail,
  onNavigatePlayback,
  onOpenCommand,
  speedUnit = 'kmh',
}: DeviceBottomSheetProps) {
  const status = getDeviceOperationalStatus(device, position);
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  const speed = formatSpeed(position?.speed, speedUnit);
  const ignition = position?.attributes?.ignition;
  const battery = position?.attributes?.batteryLevel ?? position?.attributes?.battery;
  const odometer = formatDistance(position?.attributes?.totalDistance);

  return (
    <View style={styles.sheetContainer}>
      {/* Top Handle / Close */}
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Text style={styles.nameText} numberOfLines={1}>
            {device.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Quick Telemetry Grid */}
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Speed</Text>
          <Text style={styles.gridValue}>{speed}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Ignition</Text>
          <Text style={[styles.gridValue, { color: ignition ? '#10B981' : '#64748B' }]}>
            {ignition ? 'ON' : 'OFF'}
          </Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Battery</Text>
          <Text style={styles.gridValue}>{battery !== undefined ? `${Math.round(battery)}%` : 'N/A'}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.gridLabel}>Odometer</Text>
          <Text style={styles.gridValue}>{odometer}</Text>
        </View>
      </View>

      {/* Address */}
      {position?.address && (
        <View style={styles.addressBox}>
          <MaterialCommunityIcons name="map-marker" size={16} color="#64748B" />
          <Text style={styles.addressText} numberOfLines={2}>
            {position.address}
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onNavigateDetail}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#2563EB" />
          <Text style={styles.actionText}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onNavigatePlayback}>
          <MaterialCommunityIcons name="history" size={20} color="#2563EB" />
          <Text style={styles.actionText}>Playback</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.commandBtn]} onPress={onOpenCommand}>
          <MaterialCommunityIcons name="remote" size={20} color="#EF4444" />
          <Text style={[styles.actionText, { color: '#EF4444' }]}>Commands</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  closeBtn: {
    padding: 4,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  commandBtn: {
    backgroundColor: '#FEF2F2',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
});

