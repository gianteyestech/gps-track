import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ScrollView,
  Share,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { MapViewer } from '../../components/MapViewer';
import { SpeedometerGauge } from '../../components/SpeedometerGauge';
import { OdometerBox } from '../../components/OdometerBox';
import { SendCommandModal } from '../../components/SendCommandModal';
import { GTS_COLORS } from '../../constants/theme';
import { calculateDistanceKm, estimateDriveTimeMinutes } from '../../utils/formatters';

export default function LiveMapScreen() {
  const params = useLocalSearchParams<{ deviceId?: string }>();
  const {
    devices,
    positions,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useTraccar();

  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'dark'>('osm');
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);
  const [commandModalVisible, setCommandModalVisible] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // User live location & vehicle chase/track mode state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isTrackMode, setIsTrackMode] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Set device from navigation param if passed
  useEffect(() => {
    if (params.deviceId) {
      setSelectedDeviceId(parseInt(params.deviceId, 10));
    }
  }, [params.deviceId]);

  // Watch user's live physical location in Web/PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn('Geolocation notice:', err.message);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Active target vehicle
  const currentDevice =
    devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;
  const currentPosition = currentDevice ? positions[currentDevice.id] : undefined;

  const speedKmh = currentPosition?.speed ? Math.round(currentPosition.speed * 1.852) : 0;
  const totalKm = currentPosition?.attributes?.totalDistance
    ? (currentPosition.attributes.totalDistance / 1000).toFixed(2)
    : currentPosition?.attributes?.odometer
    ? (currentPosition.attributes.odometer / 1000).toFixed(2)
    : '000.00';
  const todayKm = currentPosition?.attributes?.distance
    ? Math.round(currentPosition.attributes.distance / 1000).toString().padStart(4, '0') + 'KM'
    : '0000KM';

  const formattedDate = currentPosition?.fixTime
    ? new Date(currentPosition.fixTime).toLocaleDateString('en-GB') +
      ' ' +
      new Date(currentPosition.fixTime).toLocaleTimeString('en-US', { hour12: true })
    : currentDevice?.lastUpdate
    ? new Date(currentDevice.lastUpdate).toLocaleDateString('en-GB') +
      ' ' +
      new Date(currentDevice.lastUpdate).toLocaleTimeString('en-US', { hour12: true })
    : 'No GPS fix yet';

  // Real-time distance and driving ETA from User to Vehicle
  const distanceToVehicle =
    userLocation && currentPosition?.latitude && currentPosition?.longitude
      ? calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          currentPosition.latitude,
          currentPosition.longitude
        )
      : null;
  const etaMinutes = distanceToVehicle !== null ? estimateDriveTimeMinutes(distanceToVehicle) : null;

  const cycleMapLayer = () => {
    if (mapLayer === 'osm') setMapLayer('satellite');
    else if (mapLayer === 'satellite') setMapLayer('dark');
    else setMapLayer('osm');
  };

  const toggleTrackMode = () => {
    if (!isTrackMode && !userLocation) {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
            setIsLocating(false);
            setIsTrackMode(true);
            setRecenterTrigger((prev) => prev + 1);
          },
          (err) => {
            setIsLocating(false);
            Alert.alert(
              'Location Access Needed',
              'Please allow location access in your browser or device to see your position relative to this vehicle.'
            );
          },
          { enableHighAccuracy: true }
        );
        return;
      }
    }
    setIsTrackMode((prev) => !prev);
    setRecenterTrigger((prev) => prev + 1);
  };

  const handleOpenDirections = () => {
    if (!currentPosition?.latitude || !currentPosition?.longitude) {
      Alert.alert('No Coordinates', 'Vehicle GPS fix is currently unavailable.');
      return;
    }
    const originParam = userLocation
      ? `&origin=${userLocation.latitude},${userLocation.longitude}`
      : '';
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${currentPosition.latitude},${currentPosition.longitude}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleShareLocation = async () => {
    if (!currentPosition || !currentDevice) return;
    try {
      const url = `https://maps.google.com/?q=${currentPosition.latitude},${currentPosition.longitude}`;
      await Share.share({
        message: `${currentDevice.name} live location: ${url}`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapViewer
        devices={devices}
        positions={positions}
        selectedDeviceId={currentDevice?.id}
        onSelectDevice={(id) => setSelectedDeviceId(id)}
        mapLayer={mapLayer}
        forceRecenter={recenterTrigger}
        userLocation={userLocation}
        trackMode={isTrackMode}
      />

      {/* Top Status Header Banner matching Image 4 */}
      <SafeAreaView style={styles.topBannerArea}>
        <View style={styles.topBanner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.push('/(tabs)')}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.bannerInfoCol}>
            <Text style={styles.bannerTitle}>
              {currentDevice?.name || 'Select Vehicle'}
            </Text>
            <Text style={styles.bannerSubTitle}>{formattedDate}</Text>
          </View>

          {/* Quick Track Mode Switch in Header */}
          <TouchableOpacity
            style={[styles.headerTrackBtn, isTrackMode && styles.headerTrackBtnActive]}
            onPress={toggleTrackMode}
          >
            <MaterialCommunityIcons
              name="human"
              size={18}
              color={isTrackMode ? '#FFFFFF' : '#F97316'}
            />
            <Text style={[styles.headerTrackText, isTrackMode && styles.headerTrackTextActive]}>
              {isTrackMode ? 'Tracking' : 'Track'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Vehicle Switcher Strip */}
        {devices.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.vehicleStrip}
            contentContainerStyle={styles.vehicleStripContent}
          >
            {devices.map((d) => {
              const isSelected = d.id === currentDevice?.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.vehiclePill,
                    isSelected && styles.vehiclePillActive,
                  ]}
                  onPress={() => setSelectedDeviceId(d.id)}
                >
                  <MaterialCommunityIcons
                    name="car-side"
                    size={14}
                    color={isSelected ? '#FFFFFF' : '#374151'}
                  />
                  <Text
                    style={[
                      styles.vehiclePillText,
                      isSelected && styles.vehiclePillTextActive,
                    ]}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Live Proximity / Relative Tracking Pill */}
        {distanceToVehicle !== null && currentDevice && (
          <View style={styles.proximityFloatingCard}>
            <View style={styles.proximityLeft}>
              <View style={styles.humanBadge}>
                <MaterialCommunityIcons name="human" size={15} color="#FFFFFF" />
              </View>
              <MaterialCommunityIcons name="arrow-right-thin" size={18} color="#EA580C" />
              <Text style={styles.proximityVehName} numberOfLines={1}>
                {currentDevice.name}
              </Text>
            </View>

            <View style={styles.proximityCenter}>
              <Text style={styles.proximityDistText}>{distanceToVehicle} km</Text>
              <Text style={styles.proximityEtaText}>~{etaMinutes} min away</Text>
            </View>

            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={handleOpenDirections}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="navigation-variant" size={14} color="#FFFFFF" />
              <Text style={styles.navigateBtnText}>Directions</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Left Floating Controls Widget matching Image 4 */}
      <View style={styles.leftWidgets}>
        {/* Speed Circle */}
        <View style={styles.speedBubble}>
          <Text style={styles.speedBubbleNum}>{speedKmh}</Text>
          <Text style={styles.speedBubbleUnit}>km/h</Text>
        </View>

        {/* Lock / Immobilizer Command */}
        <TouchableOpacity
          style={styles.circleToolBtn}
          onPress={() => setCommandModalVisible(true)}
        >
          <MaterialCommunityIcons name="lock" size={20} color="#111827" />
        </TouchableOpacity>

        {/* Playback History */}
        <TouchableOpacity
          style={styles.circleToolBtn}
          onPress={() => {
            if (currentDevice) {
              router.push({
                pathname: '/playback/[id]',
                params: { id: currentDevice.id.toString() },
              });
            }
          }}
        >
          <MaterialCommunityIcons name="play-circle" size={22} color="#111827" />
        </TouchableOpacity>

        {/* Speed Gauge Details */}
        <TouchableOpacity
          style={styles.circleToolBtn}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <MaterialCommunityIcons name="speedometer" size={20} color="#22C55E" />
        </TouchableOpacity>

        {/* Info */}
        <TouchableOpacity
          style={styles.circleToolBtn}
          onPress={() => setIsExpanded(true)}
        >
          <MaterialCommunityIcons name="information" size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      {/* Right Floating Map Controls matching Image 4 */}
      <View style={styles.rightWidgets}>
        {/* Layers */}
        <TouchableOpacity style={styles.squareToolBtn} onPress={cycleMapLayer}>
          <MaterialCommunityIcons name="layers" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* Traffic */}
        <TouchableOpacity
          style={styles.squareToolBtn}
          onPress={() => Alert.alert('Traffic', 'Live traffic layer toggled')}
        >
          <MaterialCommunityIcons name="traffic-light" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* Navigation / Directions from You to Vehicle */}
        <TouchableOpacity
          style={styles.squareToolBtn}
          onPress={handleOpenDirections}
        >
          <MaterialCommunityIcons name="navigation" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* Recenter */}
        <TouchableOpacity
          style={styles.squareToolBtn}
          onPress={() => setRecenterTrigger((prev) => prev + 1)}
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* Measure */}
        <TouchableOpacity
          style={styles.squareToolBtn}
          onPress={() => Alert.alert('Ruler', 'Distance measurement enabled')}
        >
          <MaterialCommunityIcons name="ruler" size={22} color="#1E293B" />
        </TouchableOpacity>

        {/* Human Icon / Track Vehicle Relative to My Location */}
        <TouchableOpacity
          style={[
            styles.squareToolBtn,
            isTrackMode && { backgroundColor: '#EA580C', borderColor: '#EA580C' },
          ]}
          onPress={toggleTrackMode}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={isTrackMode ? '#FFFFFF' : '#EA580C'} />
          ) : (
            <MaterialCommunityIcons
              name="human"
              size={24}
              color={isTrackMode ? '#FFFFFF' : '#1E293B'}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Telemetry Drawer matching Image 4 & Image 7 */}
      <View style={[styles.bottomDrawer, isExpanded && styles.bottomDrawerExpanded]}>
        {/* Expand / Collapse toggle handle */}
        <TouchableOpacity
          style={styles.drawerHandle}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-down' : 'chevron-up'}
            size={24}
            color="#475569"
          />
        </TouchableOpacity>

        {isExpanded ? (
          /* Expanded Content matching Image 7 */
          <ScrollView style={styles.expandedScroll} showsVerticalScrollIndicator={false}>
            {/* 8 Diagnostic Metric Cards Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="cellphone" size={18} color="#2563EB" />
                <Text style={styles.metricName}>GPS Signals</Text>
                <Text style={styles.metricVal}>
                  {currentPosition?.attributes?.sat ?? 8}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="signal" size={18} color="#2563EB" />
                <Text style={styles.metricName}>GSM Signals</Text>
                <Text style={styles.metricVal}>
                  {currentPosition?.attributes?.rssi
                    ? `${Math.round((currentPosition.attributes.rssi / 31) * 100)} %`
                    : 'Good'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="speedometer" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Odometer</Text>
                <Text style={styles.metricVal}>{totalKm} KM</Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="gauge" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Total Odometer</Text>
                <Text style={styles.metricVal}>{totalKm} KM</Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="battery-charging" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Battery Charging</Text>
                <Text style={styles.metricVal}>
                  {currentPosition?.attributes?.charge ? 'On' : 'Off'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="clock-outline" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Engine Hours</Text>
                <Text style={styles.metricVal}>
                  {currentPosition?.attributes?.hours
                    ? (currentPosition.attributes.hours / 3600000).toFixed(1)
                    : 'N/A'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="battery-off-outline" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Moving</Text>
                <Text style={styles.metricVal}>
                  {currentPosition?.attributes?.motion ? 'on' : 'off'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <MaterialCommunityIcons name="cellphone-check" size={18} color="#2563EB" />
                <Text style={styles.metricName}>Result</Text>
                <Text style={styles.metricVal}>-</Text>
              </View>
            </View>

            {/* Sumario (Summary) Card */}
            <View style={styles.sumarioCard}>
              <Text style={styles.sumarioTitle}>Sumario</Text>
              <View style={styles.sumarioContent}>
                <View style={styles.routeIconBox}>
                  <MaterialCommunityIcons name="map-marker-path" size={40} color="#0D9488" />
                </View>
                <View style={styles.sumarioCol}>
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabel}>Travelled distance</Text>
                    <Text style={styles.sumValue}>{todayKm}</Text>
                  </View>
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabel}>Max Speed</Text>
                    <Text style={styles.sumValue}>{speedKmh} kph</Text>
                  </View>
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabel}>Average Speed</Text>
                    <Text style={styles.sumValue}>{speedKmh} kph</Text>
                  </View>
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabel}>Fuel Consumption</Text>
                    <Text style={styles.sumValue}>
                      {currentPosition?.attributes?.fuel ? `${currentPosition.attributes.fuel} L` : '0 L'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Time Spent Breakdown */}
            <View style={styles.timeCard}>
              <View style={styles.timeContent}>
                <View style={styles.hourglassBox}>
                  <MaterialCommunityIcons name="timer-sand" size={44} color="#3B82F6" />
                </View>
                <View style={styles.timeCol}>
                  <View style={styles.timeRow}>
                    <View style={[styles.timeDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={styles.timeLabel}>Running</Text>
                    <Text style={styles.timeValue}>0s</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={[styles.timeDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.timeLabel}>Idle</Text>
                    <Text style={styles.timeValue}>0 s</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={[styles.timeDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.timeLabel}>Stop</Text>
                    <Text style={styles.timeValue}>1h 8min 20s</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={[styles.timeDot, { backgroundColor: '#0EA5E9' }]} />
                    <Text style={styles.timeLabel}>Inactive</Text>
                    <Text style={styles.timeValue}>0 s</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 8 Action Buttons Grid */}
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Vehicle Name', 'Rename vehicle')}
              >
                <MaterialCommunityIcons name="cog-refresh" size={26} color="#0284C7" />
                <Text style={styles.actionGridLabel}>Update Vehicle Name</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Engine', 'Update engine capacity')}
              >
                <MaterialCommunityIcons name="engine" size={26} color="#DC2626" />
                <Text style={styles.actionGridLabel}>Update Engine</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Add Group', 'Create vehicle group')}
              >
                <MaterialCommunityIcons name="account-group" size={26} color="#4F46E5" />
                <Text style={styles.actionGridLabel}>Add Group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Fuel Cost', 'Cost per liter: 338.16')}
              >
                <MaterialCommunityIcons name="calculator" size={26} color="#15803D" />
                <Text style={styles.actionGridLabel}>Cost Per Liter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Calling Driver', 'Connecting to driver...')}
              >
                <MaterialCommunityIcons name="phone" size={26} color="#2563EB" />
                <Text style={styles.actionGridLabel}>Call Driver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={handleShareLocation}
              >
                <MaterialCommunityIcons name="share-variant" size={26} color="#DC2626" />
                <Text style={styles.actionGridLabel}>Share Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => Alert.alert('Geofence', 'Tap map to draw geofence')}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={26} color="#059669" />
                <Text style={styles.actionGridLabel}>Add Geofence</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={() => router.push('/(tabs)/events')}
              >
                <MaterialCommunityIcons name="bell-ring" size={26} color="#F59E0B" />
                <Text style={styles.actionGridLabel}>Add Alert</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          /* Collapsed View matching Image 4 */
          <View style={styles.odometerSection}>
            <View style={styles.odoCol}>
              <OdometerBox label="ODOMETER" value={totalKm} />
            </View>

            <View style={styles.gaugeCol}>
              <SpeedometerGauge speed={speedKmh} size={110} showTicks={true} />
            </View>

            <View style={styles.odoCol}>
              <OdometerBox label="TODAY KM" value={todayKm} />
            </View>
          </View>
        )}

        {/* Bottom Toolbar: KM Details, PlayBack, Report, Command, Trips, Info */}
        <View style={styles.bottomToolbar}>
          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <MaterialCommunityIcons name="chart-bar" size={22} color="#10B981" />
            <Text style={styles.toolLabel}>KM Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => {
              if (currentDevice) {
                router.push({
                  pathname: '/playback/[id]',
                  params: { id: currentDevice.id.toString() },
                });
              }
            }}
          >
            <MaterialCommunityIcons name="play-circle-outline" size={22} color="#8B5CF6" />
            <Text style={styles.toolLabel}>PlayBack</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => {
              if (currentDevice) {
                router.push({
                  pathname: '/reports/[id]',
                  params: { id: currentDevice.id.toString() },
                });
              }
            }}
          >
            <MaterialCommunityIcons name="file-document-outline" size={22} color="#F59E0B" />
            <Text style={styles.toolLabel}>Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => setCommandModalVisible(true)}
          >
            <MaterialCommunityIcons name="account-tie-voice-outline" size={22} color="#0EA5E9" />
            <Text style={styles.toolLabel}>Command</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => {
              if (currentDevice) {
                router.push({
                  pathname: '/playback/[id]',
                  params: { id: currentDevice.id.toString() },
                });
              }
            }}
          >
            <MaterialCommunityIcons name="map-marker-distance" size={22} color="#EC4899" />
            <Text style={styles.toolLabel}>Trips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolCol}
            onPress={() => setIsExpanded(true)}
          >
            <MaterialCommunityIcons name="car-info" size={22} color="#EF4444" />
            <Text style={styles.toolLabel}>Info</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Command Modal */}
      <SendCommandModal
        visible={commandModalVisible}
        device={currentDevice}
        onClose={() => setCommandModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FAFAFA',
  },
  topBannerArea: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248, 113, 113, 0.92)', // Light red tint matching Image 4
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  backBtn: {
    padding: 2,
  },
  bannerInfoCol: {
    alignItems: 'center',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerSubTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  vehicleStrip: {
    marginTop: 8,
  },
  vehicleStripContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  vehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehiclePillActive: {
    backgroundColor: GTS_COLORS.primary,
  },
  vehiclePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  vehiclePillTextActive: {
    color: '#FFFFFF',
  },
  headerTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerTrackBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  headerTrackText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
  },
  headerTrackTextActive: {
    color: '#FFFFFF',
  },
  proximityFloatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  proximityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  humanBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityVehName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    maxWidth: 90,
  },
  proximityCenter: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  proximityDistText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F97316',
  },
  proximityEtaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  navigateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leftWidgets: {
    position: 'absolute',
    left: 16,
    top: 110,
    gap: 12,
    zIndex: 10,
  },
  speedBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  speedBubbleNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 20,
  },
  speedBubbleUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  circleToolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  rightWidgets: {
    position: 'absolute',
    right: 16,
    top: 110,
    gap: 10,
    zIndex: 10,
  },
  squareToolBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingBottom: 72, // Space for custom curved bottom bar
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomDrawerExpanded: {
    height: '75%',
  },
  drawerHandle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  odometerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  odoCol: {
    flex: 1,
    alignItems: 'center',
  },
  gaugeCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  toolCol: {
    alignItems: 'center',
    gap: 3,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  expandedScroll: {
    paddingHorizontal: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  metricName: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  sumarioCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  sumarioTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  sumarioContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconBox: {
    marginRight: 16,
    paddingLeft: 4,
  },
  sumarioCol: {
    flex: 1,
    gap: 6,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sumLabel: {
    fontSize: 12,
    color: '#334155',
  },
  sumValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  timeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  timeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourglassBox: {
    marginRight: 16,
    paddingLeft: 4,
  },
  timeCol: {
    flex: 1,
    gap: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  timeLabel: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  timeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  actionGridItem: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  actionGridLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
});
