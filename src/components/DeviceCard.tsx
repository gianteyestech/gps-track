import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Device, Position } from '../types/traccar';
import {
  getDeviceOperationalStatus,
  getStatusLabel,
  formatRelativeTime,
} from '../utils/formatters';
import { SpeedometerGauge } from './SpeedometerGauge';
import { GTS_COLORS } from '../constants/theme';
import { getReverseGeocodedAddress } from '../utils/geocoder';

interface DeviceCardProps {
  device: Device;
  position?: Position;
  isSelected?: boolean;
  onPress: () => void;
  speedUnit?: 'kmh' | 'mph';
}

export function DeviceCard({
  device,
  position,
  isSelected,
  onPress,
}: DeviceCardProps) {
  const status = getDeviceOperationalStatus(device, position);
  const statusLabel = getStatusLabel(status);

  const [address, setAddress] = useState<string>(
    position?.address ||
      (position?.latitude && position?.longitude
        ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
        : 'Location unavailable')
  );

  useEffect(() => {
    let isMounted = true;
    if (position?.address) {
      setAddress(position.address);
    } else if (position?.latitude && position?.longitude) {
      getReverseGeocodedAddress(position.latitude, position.longitude).then((resolved) => {
        if (isMounted) setAddress(resolved);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [position?.latitude, position?.longitude, position?.address]);

  // Real speed in km/h
  const speedKmh = position?.speed ? Math.round(position.speed * 1.852) : 0;
  const ignition = position?.attributes?.ignition ?? false;
  const immobilizer = position?.attributes?.blocked ?? false;
  const batteryLevel = position?.attributes?.batteryLevel ?? position?.attributes?.battery;

  // Background tint based on status
  const getCardHeaderBg = () => {
    switch (status) {
      case 'moving':
        return GTS_COLORS.runningBg;
      case 'idle':
        return GTS_COLORS.idleBg;
      case 'stopped':
      case 'offline':
      default:
        return GTS_COLORS.stoppedBg;
    }
  };

  const formattedDate = position?.fixTime
    ? new Date(position.fixTime).toLocaleDateString('en-GB') +
      ' ' +
      new Date(position.fixTime).toLocaleTimeString('en-US', { hour12: true })
    : device.lastUpdate
    ? new Date(device.lastUpdate).toLocaleDateString('en-GB') +
      ' ' +
      new Date(device.lastUpdate).toLocaleTimeString('en-US', { hour12: true })
    : 'No GPS fix yet';

  const durationStr = formatRelativeTime(position?.fixTime || device.lastUpdate);

  // Expiration calculation if available in device attributes
  const expirationDate = device.attributes?.expirationDate
    ? new Date(device.attributes.expirationDate).toLocaleDateString('en-GB')
    : null;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Top Header Card Area */}
      <View style={[styles.cardHeader, { backgroundColor: getCardHeaderBg() }]}>
        <View style={styles.titleRow}>
          <Text style={styles.plateTitle}>{device.name}</Text>
          <Text style={styles.plateId}>ID: {device.uniqueId}</Text>
        </View>

        <View style={styles.cardContentRow}>
          {/* Left Column: Car icon + Telemetry texts */}
          <View style={styles.leftCol}>
            {/* 3D Car graphic */}
            <View style={styles.carGraphicWrap}>
              <MaterialCommunityIcons
                name="car-sports"
                size={42}
                color={status === 'moving' ? '#16A34A' : status === 'idle' ? '#D97706' : '#EF4444'}
              />
            </View>

            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="information-outline" size={14} color="#9CA3AF" />
              <Text style={styles.statusLabelText}>
                Status: <Text style={styles.statusValueText}>{statusLabel}</Text>
              </Text>
            </View>

            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#9CA3AF" />
              <Text style={styles.timeValueText}>{formattedDate}</Text>
            </View>

            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="timer-outline" size={14} color="#9CA3AF" />
              <Text style={styles.durationValueText}>
                Duration: <Text style={styles.statusValueText}>{durationStr}</Text>
              </Text>
            </View>
          </View>

          {/* Right Column: Speedometer Dial Gauge */}
          <View style={styles.gaugeCol}>
            <SpeedometerGauge speed={speedKmh} size={88} />
          </View>
        </View>

        {/* Address Row with Real Resolved Address or Coordinates */}
        <View style={styles.addressBox}>
          <MaterialCommunityIcons name="map-marker-outline" size={13} color="#6B7280" />
          <Text style={styles.addressText} numberOfLines={2}>
            {address}
          </Text>
        </View>
      </View>

      {/* Bottom Info Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.expiryRow}>
          <Text style={styles.expiryText}>
            Status:{' '}
            <Text style={[styles.boldText, { color: status === 'moving' ? '#16A34A' : '#EF4444' }]}>
              {statusLabel}
            </Text>
          </Text>
          {expirationDate ? (
            <Text style={styles.expiryText}>
              Expiry: <Text style={styles.boldText}>{expirationDate}</Text>
            </Text>
          ) : (
            <Text style={styles.expiryText}>
              Battery:{' '}
              <Text style={styles.boldText}>
                {batteryLevel !== undefined ? `${Math.round(batteryLevel)}%` : 'Active'}
              </Text>
            </Text>
          )}
        </View>

        {/* Diagnostic Status Pills */}
        <View style={styles.pillsRow}>
          <View style={styles.badgePill}>
            <MaterialCommunityIcons
              name="engine"
              size={13}
              color={ignition ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.pillText,
                { color: ignition ? '#10B981' : '#EF4444' },
              ]}
            >
              Ignition: {ignition ? 'On' : 'Off'}
            </Text>
          </View>

          <View style={styles.badgePill}>
            <MaterialCommunityIcons
              name="cog-outline"
              size={13}
              color={immobilizer ? '#EF4444' : '#10B981'}
            />
            <Text
              style={[
                styles.pillText,
                { color: immobilizer ? '#EF4444' : '#10B981' },
              ]}
            >
              Immobilizer: {immobilizer ? 'On' : 'Off'}
            </Text>
          </View>

          <View style={styles.badgePill}>
            <MaterialCommunityIcons
              name="battery-charging"
              size={13}
              color={batteryLevel && batteryLevel > 20 ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.pillText,
                { color: batteryLevel && batteryLevel > 20 ? '#10B981' : '#EF4444' },
              ]}
            >
              Battery: {batteryLevel !== undefined ? `${Math.round(batteryLevel)}%` : '100%'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  selectedCard: {
    borderColor: GTS_COLORS.primary,
    borderWidth: 2,
  },
  cardHeader: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  plateId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flex: 1,
    paddingRight: 10,
  },
  carGraphicWrap: {
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  statusLabelText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  statusValueText: {
    fontWeight: '700',
    color: '#1F2937',
  },
  timeValueText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  durationValueText: {
    fontSize: 11,
    color: '#4B5563',
  },
  gaugeCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 11.5,
    color: '#374151',
    lineHeight: 16,
    flex: 1,
  },
  cardFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  expiryText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  boldText: {
    fontWeight: '800',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
