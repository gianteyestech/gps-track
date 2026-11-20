import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { traccarApi } from '../../services/api';
import { GTS_COLORS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { Device, Position } from '../../types/traccar';

interface TripItem {
  startTime: string;
  endTime: string;
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  startAddress?: string;
  endAddress?: string;
}

interface StopItem {
  startTime: string;
  endTime: string;
  duration: number;
  latitude: number;
  longitude: number;
  address?: string;
  spentFuel?: number;
}

// Convert heading degrees to 8-point compass direction
function getCompassDirection(deg: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return directions[index];
}

export default function ReportsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { devices } = useTraccar();

  // Find target device by param ID or default to first fleet vehicle
  const initialDevice =
    devices.find((d) => d.id.toString() === id) || devices[0] || null;
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(initialDevice);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  // Sync selected device when devices load
  useEffect(() => {
    if (!selectedDevice && devices.length > 0) {
      const match = devices.find((d) => d.id.toString() === id) || devices[0];
      setSelectedDevice(match);
    }
  }, [devices, id, selectedDevice]);

  // Report Types (Log History Report included as primary)
  const reportTypes = [
    'Log History Report',
    'Distance & Trips Report',
    'Events & Alarms Report',
    'Fleet Summary Report',
    'Fuel & Mileage Report',
    'Stops & Parking Report',
  ];

  const [reportType, setReportType] = useState('Log History Report');
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'HTML'>('PDF');
  const [selectedPeriod, setSelectedPeriod] = useState('Today');

  const periodOptions = [
    'Last Hours',
    'Today',
    'Yesterday',
    'Before 2 days',
    'Last 7 days',
    'Last Week',
  ];

  // Report Loading & Result States
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{
    reportType: string;
    generatedAt: string;
    totalDistanceKm: string;
    maxSpeedKmh: string;
    avgSpeedKmh: string;
    engineHours: string;
    spentFuel: string;
    periodLabel: string;
    positions: Position[];
    trips: TripItem[];
    events: any[];
    stops: StopItem[];
  } | null>(null);

  // Log History filtering and display pagination
  const [logFilter, setLogFilter] = useState<'all' | 'moving' | 'stopped'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [logsVisibleCount, setLogsVisibleCount] = useState(50);

  // Helper to compute ISO dates from friendly period options
  const calculateDateRange = (period: string) => {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    if (period === 'Today') {
      from.setHours(0, 0, 0, 0);
    } else if (period === 'Yesterday') {
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(now.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else if (period === 'Before 2 days') {
      from.setDate(now.getDate() - 2);
      from.setHours(0, 0, 0, 0);
    } else if (period === 'Last 7 days') {
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    } else if (period === 'Last Week') {
      from.setDate(now.getDate() - 14);
      from.setHours(0, 0, 0, 0);
      to.setDate(now.getDate() - 7);
      to.setHours(23, 59, 59, 999);
    } else {
      // Last Hours (past 4 hours)
      from.setHours(now.getHours() - 4);
    }

    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      fromDisplay: from.toLocaleDateString('en-GB') + ' ' + from.toLocaleTimeString('en-US', { hour12: true }),
      toDisplay: to.toLocaleDateString('en-GB') + ' ' + to.toLocaleTimeString('en-US', { hour12: true }),
    };
  };

  const handleGenerateReport = async () => {
    if (!selectedDevice) {
      setReportError('Please select a vehicle from your fleet.');
      return;
    }

    setIsGenerating(true);
    setReportError(null);
    setLogsVisibleCount(50);

    const { fromIso, toIso, fromDisplay, toDisplay } = calculateDateRange(selectedPeriod);

    try {
      let positionsList: Position[] = [];
      let tripsList: TripItem[] = [];
      let eventsList: any[] = [];
      let stopsList: StopItem[] = [];
      let summaryObj: any = null;

      // Always query summary for core baseline distance and speed metrics
      const summaryPromise = traccarApi.getSummaryReport(selectedDevice.id, fromIso, toIso);

      if (reportType === 'Log History Report') {
        const [sumRes, routeRes] = await Promise.allSettled([
          summaryPromise,
          traccarApi.getRoute(selectedDevice.id, fromIso, toIso),
        ]);
        summaryObj = sumRes.status === 'fulfilled' && sumRes.value ? sumRes.value[0] : null;
        positionsList = routeRes.status === 'fulfilled' && routeRes.value ? routeRes.value : [];
      } else if (reportType === 'Distance & Trips Report') {
        const [sumRes, tripsRes] = await Promise.allSettled([
          summaryPromise,
          traccarApi.getTripsReport(selectedDevice.id, fromIso, toIso),
        ]);
        summaryObj = sumRes.status === 'fulfilled' && sumRes.value ? sumRes.value[0] : null;
        tripsList = tripsRes.status === 'fulfilled' && tripsRes.value ? tripsRes.value : [];
      } else if (reportType === 'Events & Alarms Report') {
        const [sumRes, eventsRes] = await Promise.allSettled([
          summaryPromise,
          traccarApi.getEvents(selectedDevice.id, fromIso, toIso),
        ]);
        summaryObj = sumRes.status === 'fulfilled' && sumRes.value ? sumRes.value[0] : null;
        eventsList = eventsRes.status === 'fulfilled' && eventsRes.value ? eventsRes.value : [];
      } else if (reportType === 'Stops & Parking Report') {
        const [sumRes, stopsRes] = await Promise.allSettled([
          summaryPromise,
          traccarApi.getStopsReport(selectedDevice.id, fromIso, toIso),
        ]);
        summaryObj = sumRes.status === 'fulfilled' && sumRes.value ? sumRes.value[0] : null;
        stopsList = stopsRes.status === 'fulfilled' && stopsRes.value ? stopsRes.value : [];
      } else {
        // Fleet Summary or Fuel & Mileage
        const [sumRes, tripsRes] = await Promise.allSettled([
          summaryPromise,
          traccarApi.getTripsReport(selectedDevice.id, fromIso, toIso),
        ]);
        summaryObj = sumRes.status === 'fulfilled' && sumRes.value ? sumRes.value[0] : null;
        tripsList = tripsRes.status === 'fulfilled' && tripsRes.value ? tripsRes.value : [];
      }

      // Calculate Total Distance (KM)
      let distanceMeters = summaryObj?.distance || 0;
      if (!distanceMeters && tripsList.length > 0) {
        distanceMeters = tripsList.reduce((acc, t) => acc + (t.distance || 0), 0);
      }
      if (!distanceMeters && positionsList.length > 1) {
        const firstDist = positionsList[0].attributes?.totalDistance || 0;
        const lastDist = positionsList[positionsList.length - 1].attributes?.totalDistance || 0;
        if (lastDist > firstDist) {
          distanceMeters = lastDist - firstDist;
        }
      }
      const distKm = (distanceMeters / 1000).toFixed(1);

      // Calculate Max Speed (KM/H)
      let maxSpeed = summaryObj?.maxSpeed ? Math.round(summaryObj.maxSpeed * 1.852) : 0;
      if (!maxSpeed && tripsList.length > 0) {
        maxSpeed = Math.round(Math.max(...tripsList.map((t) => t.maxSpeed || 0)) * 1.852);
      }
      if (!maxSpeed && positionsList.length > 0) {
        maxSpeed = Math.round(Math.max(...positionsList.map((p) => p.speed || 0)) * 1.852);
      }

      // Calculate Average Speed
      let avgSpeed = summaryObj?.averageSpeed ? Math.round(summaryObj.averageSpeed * 1.852) : 0;
      if (!avgSpeed && tripsList.length > 0) {
        const sumAvg = tripsList.reduce((acc, t) => acc + (t.averageSpeed || 0), 0);
        avgSpeed = Math.round((sumAvg / tripsList.length) * 1.852);
      }
      if (!avgSpeed && positionsList.length > 0) {
        const moving = positionsList.filter((p) => (p.speed || 0) * 1.852 > 1);
        if (moving.length > 0) {
          const sumM = moving.reduce((acc, p) => acc + (p.speed || 0) * 1.852, 0);
          avgSpeed = Math.round(sumM / moving.length);
        }
      }

      // Spent Fuel & Engine Hours
      const spentFuel = summaryObj?.spentFuel ? `${summaryObj.spentFuel.toFixed(1)} L` : '0.0 L';
      const engineHours = summaryObj?.engineHours
        ? `${(summaryObj.engineHours / 3600000).toFixed(1)} hrs`
        : '0.0 hrs';

      setReportData({
        reportType,
        generatedAt: new Date().toLocaleTimeString('en-US', { hour12: true }),
        totalDistanceKm: `${distKm} km`,
        maxSpeedKmh: `${maxSpeed} km/h`,
        avgSpeedKmh: `${avgSpeed} km/h`,
        engineHours,
        spentFuel,
        periodLabel: `${fromDisplay}  ➔  ${toDisplay}`,
        positions: positionsList,
        trips: tripsList,
        events: eventsList,
        stops: stopsList,
      });
    } catch (err: any) {
      console.warn('Report generation error:', err);
      setReportError(err.message || 'Could not fetch telemetry records from server.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered & Sorted Positions for Log History
  const filteredPositions = useMemo(() => {
    if (!reportData || !reportData.positions) return [];
    let list = [...reportData.positions];

    // Filter by movement status
    if (logFilter === 'moving') {
      list = list.filter((p) => (p.speed || 0) * 1.852 > 1 || p.attributes?.motion === true);
    } else if (logFilter === 'stopped') {
      list = list.filter((p) => (p.speed || 0) * 1.852 <= 1 && !p.attributes?.motion);
    }

    // Sort order (desc = newest first)
    list.sort((a, b) => {
      const timeA = new Date(a.fixTime || a.deviceTime || 0).getTime();
      const timeB = new Date(b.fixTime || b.deviceTime || 0).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [reportData, logFilter, sortOrder]);

  const movingCount = useMemo(() => {
    if (!reportData?.positions) return 0;
    return reportData.positions.filter(
      (p) => (p.speed || 0) * 1.852 > 1 || p.attributes?.motion === true
    ).length;
  }, [reportData]);

  const stoppedCount = useMemo(() => {
    if (!reportData?.positions) return 0;
    return reportData.positions.length - movingCount;
  }, [reportData, movingCount]);

  const handlePrintOrExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fleet Telemetry Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Vehicle Selector Card */}
        <View style={styles.selectorCard}>
          <Text style={styles.cardHeaderLabel}>TARGET VEHICLE</Text>
          <TouchableOpacity
            style={styles.vehicleSelectBox}
            onPress={() => setShowVehiclePicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.vehicleSelectLeft}>
              <View style={styles.vehicleIconCircle}>
                <MaterialCommunityIcons name="car-side" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.vehicleSelectName}>
                  {selectedDevice?.name || 'Select Vehicle'}
                </Text>
                <Text style={styles.vehicleSelectModel}>
                  {selectedDevice?.model || selectedDevice?.category || 'GPS Asset Tracker'}
                </Text>
              </View>
            </View>
            <View style={styles.changeBadge}>
              <Text style={styles.changeBadgeText}>Change</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color="#475569" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Report Type Dropdown */}
        <View style={styles.dropdownContainer}>
          <Text style={styles.cardHeaderLabel}>REPORT TYPE</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setShowReportDropdown(!showReportDropdown)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons
                name={
                  reportType === 'Log History Report'
                    ? 'history'
                    : reportType === 'Distance & Trips Report'
                    ? 'map-marker-distance'
                    : reportType === 'Events & Alarms Report'
                    ? 'bell-alert-outline'
                    : reportType === 'Fuel & Mileage Report'
                    ? 'gas-station'
                    : reportType === 'Stops & Parking Report'
                    ? 'parking'
                    : 'file-chart-outline'
                }
                size={20}
                color="#F59E0B"
              />
              <Text style={styles.dropdownSelectedText}>{reportType}</Text>
            </View>
            <MaterialCommunityIcons
              name={showReportDropdown ? 'menu-up' : 'menu-down'}
              size={22}
              color="#4B5563"
            />
          </TouchableOpacity>

          {showReportDropdown && (
            <View style={styles.dropdownMenu}>
              {reportTypes.map((type, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.menuItem}
                  onPress={() => {
                    setReportType(type);
                    setShowReportDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      reportType === type && { color: GTS_COLORS.primary, fontWeight: '700' },
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Format Selector: PDF vs HTML */}
        <View style={styles.formatToggleRow}>
          <TouchableOpacity
            style={[
              styles.formatBtn,
              styles.formatBtnLeft,
              exportFormat === 'PDF' && styles.formatBtnActive,
            ]}
            onPress={() => setExportFormat('PDF')}
          >
            <MaterialCommunityIcons
              name="file-pdf-box"
              size={18}
              color={exportFormat === 'PDF' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.formatBtnText,
                exportFormat === 'PDF' && styles.formatBtnTextActive,
              ]}
            >
              PDF Document
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.formatBtn,
              styles.formatBtnRight,
              exportFormat === 'HTML' && styles.formatBtnActive,
            ]}
            onPress={() => setExportFormat('HTML')}
          >
            <MaterialCommunityIcons
              name="language-html5"
              size={18}
              color={exportFormat === 'HTML' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.formatBtnText,
                exportFormat === 'HTML' && styles.formatBtnTextActive,
              ]}
            >
              HTML Ledger
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Period Pills */}
        <Text style={[styles.cardHeaderLabel, { marginTop: 14 }]}>TIME PERIOD</Text>
        <View style={styles.periodPillsGrid}>
          {periodOptions.map((period, idx) => {
            const isSelected = selectedPeriod === period;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.periodPill, isSelected && styles.periodPillActive]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    isSelected && styles.periodPillTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Error Feedback */}
        {reportError && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{reportError}</Text>
          </View>
        )}

        {/* Generate Report Button */}
        <TouchableOpacity
          style={[styles.viewReportBtn, isGenerating && { opacity: 0.7 }]}
          onPress={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.viewReportText}>
            {isGenerating ? 'Querying Traccar Server...' : `Generate ${reportType}`}
          </Text>
        </TouchableOpacity>

        {/* ========================================================================= */}
        {/* Rendered Live Report                                                      */}
        {/* ========================================================================= */}
        {reportData && (
          <View style={styles.reportSummaryCard}>
            {/* Report Header */}
            <View style={styles.reportSummaryHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportSummaryTitle}>{reportData.reportType}</Text>
                <Text style={styles.reportSummaryMeta}>
                  {selectedDevice?.name} ({selectedDevice?.category || 'Vehicle'}) • Created at {reportData.generatedAt}
                </Text>
                <Text style={styles.reportPeriodBadge}>{reportData.periodLabel}</Text>
              </View>
              <View style={styles.formatBadge}>
                <Text style={styles.formatBadgeText}>{exportFormat}</Text>
              </View>
            </View>

            {/* Top KPI Metrics Grid */}
            <View style={styles.reportMetricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricVal}>{reportData.totalDistanceKm}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Max Speed</Text>
                <Text style={styles.metricVal}>{reportData.maxSpeedKmh}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Avg Speed</Text>
                <Text style={styles.metricVal}>{reportData.avgSpeedKmh}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {reportData.reportType === 'Log History Report'
                    ? 'Total Points'
                    : reportData.reportType === 'Distance & Trips Report'
                    ? 'Trips'
                    : reportData.reportType === 'Stops & Parking Report'
                    ? 'Stops'
                    : 'Records'}
                </Text>
                <Text style={styles.metricVal}>
                  {reportData.reportType === 'Log History Report'
                    ? reportData.positions.length
                    : reportData.reportType === 'Distance & Trips Report'
                    ? reportData.trips.length
                    : reportData.reportType === 'Stops & Parking Report'
                    ? reportData.stops.length
                    : reportData.events.length}
                </Text>
              </View>
            </View>

            {/* ===================================================================== */}
            {/* 1. LOG HISTORY REPORT (Point-by-Point GPS Position Logs)               */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Log History Report' && (
              <View style={styles.sectionWrap}>
                {/* Filter and Sort Bar */}
                <View style={styles.logFilterBar}>
                  <View style={styles.logFilterGroup}>
                    <TouchableOpacity
                      style={[styles.filterChip, logFilter === 'all' && styles.filterChipActive]}
                      onPress={() => {
                        setLogFilter('all');
                        setLogsVisibleCount(50);
                      }}
                    >
                      <Text style={[styles.filterChipText, logFilter === 'all' && styles.filterChipTextActive]}>
                        All ({reportData.positions.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterChip, logFilter === 'moving' && styles.filterChipActive]}
                      onPress={() => {
                        setLogFilter('moving');
                        setLogsVisibleCount(50);
                      }}
                    >
                      <Text style={[styles.filterChipText, logFilter === 'moving' && styles.filterChipTextActive]}>
                        Moving ({movingCount})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterChip, logFilter === 'stopped' && styles.filterChipActive]}
                      onPress={() => {
                        setLogFilter('stopped');
                        setLogsVisibleCount(50);
                      }}
                    >
                      <Text style={[styles.filterChipText, logFilter === 'stopped' && styles.filterChipTextActive]}>
                        Parked ({stoppedCount})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.sortToggleBtn}
                    onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  >
                    <MaterialCommunityIcons
                      name={sortOrder === 'desc' ? 'sort-clock-descending-outline' : 'sort-clock-ascending-outline'}
                      size={16}
                      color="#475569"
                    />
                    <Text style={styles.sortToggleText}>
                      {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Log Records Feed */}
                {filteredPositions.length > 0 ? (
                  <View style={styles.logList}>
                    {filteredPositions.slice(0, logsVisibleCount).map((pos, pIdx) => {
                      const speedKmh = Math.round((pos.speed || 0) * 1.852);
                      const isMoving = speedKmh > 1 || pos.attributes?.motion === true;
                      const dateObj = new Date(pos.fixTime || pos.deviceTime || pos.serverTime || 0);
                      const formattedDate = dateObj.toLocaleDateString('en-GB');
                      const formattedTime = dateObj.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      });
                      const compass = getCompassDirection(pos.course || 0);
                      const odoKm = pos.attributes?.totalDistance
                        ? (pos.attributes.totalDistance / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })
                        : pos.attributes?.odometer
                        ? (pos.attributes.odometer / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })
                        : null;

                      return (
                        <View key={pos.id || pIdx} style={styles.logCard}>
                          {/* Top Row: Index, Time, and Status Badge */}
                          <View style={styles.logCardHeader}>
                            <View style={styles.logIndexRow}>
                              <Text style={styles.logIndexBadge}>#{pIdx + 1}</Text>
                              <MaterialCommunityIcons name="clock-outline" size={13} color="#64748B" />
                              <Text style={styles.logTimeText}>
                                {formattedDate} {formattedTime}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.logStatusBadge,
                                isMoving ? styles.statusMovingBadge : styles.statusStoppedBadge,
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  { backgroundColor: isMoving ? '#16A34A' : '#94A3B8' },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  { color: isMoving ? '#15803D' : '#475569' },
                                ]}
                              >
                                {isMoving ? `${speedKmh} km/h` : 'Stopped (0 km/h)'}
                              </Text>
                            </View>
                          </View>

                          {/* Middle Row: Telemetry Attributes (Ignition, Satellites, Odometer) */}
                          <View style={styles.logAttrRow}>
                            {pos.attributes?.ignition !== undefined && (
                              <View
                                style={[
                                  styles.attrBadge,
                                  pos.attributes.ignition ? styles.ignOnBadge : styles.ignOffBadge,
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="lightning-bolt"
                                  size={12}
                                  color={pos.attributes.ignition ? '#15803D' : '#64748B'}
                                />
                                <Text
                                  style={[
                                    styles.attrBadgeText,
                                    { color: pos.attributes.ignition ? '#15803D' : '#64748B' },
                                  ]}
                                >
                                  IGN {pos.attributes.ignition ? 'ON' : 'OFF'}
                                </Text>
                              </View>
                            )}

                            {pos.attributes?.sat !== undefined && (
                              <View style={styles.attrBadge}>
                                <MaterialCommunityIcons name="satellite-variant" size={12} color="#0284C7" />
                                <Text style={[styles.attrBadgeText, { color: '#0284C7' }]}>
                                  {pos.attributes.sat} Sats
                                </Text>
                              </View>
                            )}

                            {odoKm && (
                              <View style={styles.attrBadge}>
                                <MaterialCommunityIcons name="counter" size={12} color="#475569" />
                                <Text style={styles.attrBadgeText}>{odoKm} km</Text>
                              </View>
                            )}

                            <View style={styles.attrBadge}>
                              <MaterialCommunityIcons name="compass-outline" size={12} color="#64748B" />
                              <Text style={styles.attrBadgeText}>
                                {Math.round(pos.course || 0)}° ({compass})
                              </Text>
                            </View>
                          </View>

                          {/* Bottom Row: GPS Coordinates & Street Address */}
                          <View style={styles.logCoordRow}>
                            <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#2563EB" />
                            <Text style={styles.coordText}>
                              {pos.latitude.toFixed(5)}°, {pos.longitude.toFixed(5)}°
                            </Text>
                            {pos.altitude !== undefined && pos.altitude > 0 && (
                              <Text style={styles.altitudeText}>• {Math.round(pos.altitude)}m alt</Text>
                            )}
                          </View>

                          {pos.address && (
                            <View style={styles.logAddressRow}>
                              <MaterialCommunityIcons name="map-marker-outline" size={13} color="#64748B" />
                              <Text style={styles.addressText} numberOfLines={2}>
                                {pos.address}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Pagination / Load More Controls */}
                    {filteredPositions.length > logsVisibleCount && (
                      <View style={styles.loadMoreContainer}>
                        <TouchableOpacity
                          style={styles.loadMoreBtn}
                          onPress={() => setLogsVisibleCount((prev) => prev + 50)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="chevron-double-down" size={18} color="#2563EB" />
                          <Text style={styles.loadMoreText}>
                            Load Next 50 Records (Showing {logsVisibleCount} of {filteredPositions.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.showAllBtn}
                          onPress={() => setLogsVisibleCount(filteredPositions.length)}
                        >
                          <Text style={styles.showAllText}>
                            Show All {filteredPositions.length} Points
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="history" size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No GPS coordinates recorded</Text>
                    <Text style={styles.emptySubtitle}>
                      No position pings were registered for this device during the selected time period.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ===================================================================== */}
            {/* 2. DISTANCE & TRIPS REPORT                                            */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Distance & Trips Report' && (
              <View style={styles.sectionWrap}>
                <Text style={styles.ledgerSectionTitle}>
                  Recorded Trips ({reportData.trips.length})
                </Text>
                {reportData.trips.length > 0 ? (
                  reportData.trips.map((trip, tIdx) => {
                    const distKm = ((trip.distance || 0) / 1000).toFixed(1);
                    const maxSpd = Math.round((trip.maxSpeed || 0) * 1.852);
                    const durMinutes = Math.round((trip.duration || 0) / 60000);
                    const sTime = trip.startTime
                      ? new Date(trip.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const eTime = trip.endTime
                      ? new Date(trip.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <View key={tIdx} style={styles.tripCard}>
                        <View style={styles.tripCardTop}>
                          <View style={styles.tripTimeBadge}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color="#0284C7" />
                            <Text style={styles.tripTimeText}>{sTime} – {eTime} ({durMinutes} min)</Text>
                          </View>
                          <View style={styles.tripDistanceBadge}>
                            <Text style={styles.tripDistText}>{distKm} km</Text>
                          </View>
                        </View>

                        {trip.startAddress && (
                          <View style={styles.addressRow}>
                            <MaterialCommunityIcons name="ray-start-arrow" size={16} color="#16A34A" />
                            <Text style={styles.addressText} numberOfLines={1}>{trip.startAddress}</Text>
                          </View>
                        )}
                        {trip.endAddress && (
                          <View style={styles.addressRow}>
                            <MaterialCommunityIcons name="flag-checkered" size={16} color="#DC2626" />
                            <Text style={styles.addressText} numberOfLines={1}>{trip.endAddress}</Text>
                          </View>
                        )}
                        <Text style={styles.tripSpeedFoot}>Peak Speed: {maxSpd} km/h</Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="road-variant" size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Trips Found</Text>
                    <Text style={styles.emptySubtitle}>No completed journeys were registered for this period.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ===================================================================== */}
            {/* 3. STOPS & PARKING REPORT                                             */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Stops & Parking Report' && (
              <View style={styles.sectionWrap}>
                <Text style={styles.ledgerSectionTitle}>
                  Recorded Stops ({reportData.stops.length})
                </Text>
                {reportData.stops.length > 0 ? (
                  reportData.stops.map((stop, sIdx) => {
                    const durMinutes = Math.round((stop.duration || 0) / 60000);
                    const durHours = (durMinutes / 60).toFixed(1);
                    const sTime = stop.startTime
                      ? new Date(stop.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const eTime = stop.endTime
                      ? new Date(stop.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <View key={sIdx} style={styles.tripCard}>
                        <View style={styles.tripCardTop}>
                          <View style={styles.tripTimeBadge}>
                            <MaterialCommunityIcons name="parking" size={16} color="#EF4444" />
                            <Text style={styles.tripTimeText}>{sTime} – {eTime}</Text>
                          </View>
                          <View style={[styles.tripDistanceBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.tripDistText, { color: '#DC2626' }]}>
                              {durMinutes > 60 ? `${durHours} hrs` : `${durMinutes} min`}
                            </Text>
                          </View>
                        </View>
                        {stop.address && (
                          <View style={styles.addressRow}>
                            <MaterialCommunityIcons name="map-marker" size={16} color="#64748B" />
                            <Text style={styles.addressText}>{stop.address}</Text>
                          </View>
                        )}
                        <Text style={styles.coordText}>
                          GPS: {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="parking" size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Parking Stops Found</Text>
                    <Text style={styles.emptySubtitle}>No extended parking stops recorded for this timeframe.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ===================================================================== */}
            {/* 4. EVENTS & ALARMS REPORT                                             */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Events & Alarms Report' && (
              <View style={styles.sectionWrap}>
                <Text style={styles.ledgerSectionTitle}>
                  Triggered Events ({reportData.events.length})
                </Text>
                {reportData.events.length > 0 ? (
                  reportData.events.map((evt, eIdx) => {
                    const eTime = evt.eventTime
                      ? new Date(evt.eventTime).toLocaleString('en-US')
                      : 'Unknown Time';

                    return (
                      <View key={evt.id || eIdx} style={styles.tripCard}>
                        <View style={styles.tripCardTop}>
                          <View style={styles.tripTimeBadge}>
                            <MaterialCommunityIcons name="bell-ring" size={15} color="#D97706" />
                            <Text style={[styles.tripTimeText, { color: '#B45309' }]}>
                              {evt.type.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.logTimeText}>{eTime}</Text>
                        </View>
                        {evt.attributes && (
                          <Text style={styles.addressText} numberOfLines={2}>
                            {JSON.stringify(evt.attributes)}
                          </Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="bell-outline" size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Security Alerts</Text>
                    <Text style={styles.emptySubtitle}>No over-speed or geofence violations occurred.</Text>
                  </View>
                )}
              </View>
            )}

            {/* ===================================================================== */}
            {/* 5. FUEL & MILEAGE REPORT                                              */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Fuel & Mileage Report' && (
              <View style={styles.sectionWrap}>
                <Text style={styles.ledgerSectionTitle}>Fuel Consumption Breakdown</Text>
                <View style={styles.fuelKpiRow}>
                  <View style={styles.fuelKpiCard}>
                    <MaterialCommunityIcons name="gas-station" size={24} color="#EA580C" />
                    <Text style={styles.fuelKpiVal}>{reportData.spentFuel}</Text>
                    <Text style={styles.fuelKpiLabel}>Estimated Fuel Spent</Text>
                  </View>
                  <View style={styles.fuelKpiCard}>
                    <MaterialCommunityIcons name="cash" size={24} color="#16A34A" />
                    <Text style={styles.fuelKpiVal}>
                      PKR {(parseFloat(reportData.spentFuel) * 338.16).toFixed(0)}
                    </Text>
                    <Text style={styles.fuelKpiLabel}>Est. Cost (@ 338.16/L)</Text>
                  </View>
                </View>

                <View style={styles.fuelDetailCard}>
                  <View style={styles.fuelDetailRow}>
                    <Text style={styles.fuelDetailLabel}>Total Distance Traveled</Text>
                    <Text style={styles.fuelDetailVal}>{reportData.totalDistanceKm}</Text>
                  </View>
                  <View style={styles.fuelDetailRow}>
                    <Text style={styles.fuelDetailLabel}>Engine Operating Hours</Text>
                    <Text style={styles.fuelDetailVal}>{reportData.engineHours}</Text>
                  </View>
                  <View style={styles.fuelDetailRow}>
                    <Text style={styles.fuelDetailLabel}>Average Vehicle Economy</Text>
                    <Text style={styles.fuelDetailVal}>
                      {parseFloat(reportData.spentFuel) > 0
                        ? `${(parseFloat(reportData.totalDistanceKm) / parseFloat(reportData.spentFuel)).toFixed(1)} km/L`
                        : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ===================================================================== */}
            {/* 6. FLEET SUMMARY REPORT                                               */}
            {/* ===================================================================== */}
            {reportData.reportType === 'Fleet Summary Report' && (
              <View style={styles.sectionWrap}>
                <Text style={styles.ledgerSectionTitle}>Executive Asset Performance</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Total Distance</Text>
                    <Text style={styles.summaryCardVal}>{reportData.totalDistanceKm}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Peak Speed</Text>
                    <Text style={styles.summaryCardVal}>{reportData.maxSpeedKmh}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Average Speed</Text>
                    <Text style={styles.summaryCardVal}>{reportData.avgSpeedKmh}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardLabel}>Operating Engine</Text>
                    <Text style={styles.summaryCardVal}>{reportData.engineHours}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Print / Export Action Button */}
            <TouchableOpacity
              style={styles.downloadReportBtn}
              onPress={handlePrintOrExport}
            >
              <MaterialCommunityIcons name="printer" size={18} color="#FFFFFF" />
              <Text style={styles.downloadReportText}>
                Print / Save {exportFormat} Report
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* Modal: Vehicle Fleet Switcher                                             */}
      {/* ========================================================================= */}
      <Modal visible={showVehiclePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Fleet Vehicle</Text>
              <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {devices.map((dev) => {
                const isCurrent = dev.id === selectedDevice?.id;
                return (
                  <TouchableOpacity
                    key={dev.id}
                    style={[styles.pickerItem, isCurrent && styles.pickerItemActive]}
                    onPress={() => {
                      setSelectedDevice(dev);
                      setShowVehiclePicker(false);
                      setReportData(null);
                    }}
                  >
                    <View style={styles.pickerItemLeft}>
                      <MaterialCommunityIcons
                        name="car"
                        size={20}
                        color={isCurrent ? '#E85A1D' : '#64748B'}
                      />
                      <View>
                        <Text style={[styles.pickerItemName, isCurrent && { color: '#E85A1D' }]}>
                          {dev.name}
                        </Text>
                        <Text style={styles.pickerItemSub}>
                          {dev.model || dev.category || 'Asset'} • Status: {dev.status}
                        </Text>
                      </View>
                    </View>
                    {isCurrent && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#E85A1D" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  selectorCard: {
    marginBottom: 14,
  },
  vehicleSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  vehicleSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleSelectName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleSelectModel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dropdownContainer: {
    position: 'relative',
    marginBottom: 14,
    zIndex: 20,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 30,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
  },
  formatToggleRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  formatBtnLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderRightWidth: 0.75,
  },
  formatBtnRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderLeftWidth: 0.75,
  },
  formatBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  formatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  formatBtnTextActive: {
    color: '#FFFFFF',
  },
  periodPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  periodPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodPillActive: {
    backgroundColor: '#E85A1D',
    borderColor: '#E85A1D',
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  periodPillTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E85A1D',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#E85A1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  viewReportText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  reportSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  reportSummaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportSummaryMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  reportPeriodBadge: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
    marginTop: 4,
  },
  formatBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  sectionWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  ledgerSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  // Log History specific styles
  logFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logFilterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  logList: {
    gap: 8,
  },
  logCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logIndexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logIndexBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logTimeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  logStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusMovingBadge: {
    backgroundColor: '#DCFCE7',
  },
  statusStoppedBadge: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  logAttrRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  attrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ignOnBadge: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  ignOffBadge: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  attrBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  logCoordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  coordText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  altitudeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  logAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  loadMoreContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  showAllBtn: {
    paddingVertical: 6,
  },
  showAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  // Trip card styles
  tripCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tripCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tripTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  tripDistanceBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tripDistText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  tripSpeedFoot: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Fuel breakdown styles
  fuelKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  fuelKpiCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 4,
  },
  fuelKpiVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fuelKpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  fuelDetailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  fuelDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  fuelDetailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  fuelDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Fleet summary grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCardLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryCardVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  downloadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 18,
  },
  downloadReportText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  pickerItemActive: {
    backgroundColor: '#FFF7ED',
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
});
