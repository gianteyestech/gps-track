import React, { useState, useEffect } from 'react';
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
import { Device } from '../../types/traccar';

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

  const [reportType, setReportType] = useState('Distance & Trips Report');
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'HTML'>('PDF');
  const [selectedPeriod, setSelectedPeriod] = useState('Today');

  const reportTypes = [
    'Distance & Trips Report',
    'Events & Alarms Report',
    'Fleet Summary Report',
    'Fuel & Mileage Report',
  ];

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
    generatedAt: string;
    totalDistanceKm: string;
    maxSpeedKmh: string;
    avgSpeedKmh: string;
    tripsCount: number;
    eventsCount: number;
    spentFuel: string;
    trips: TripItem[];
    events: any[];
    periodLabel: string;
  } | null>(null);

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

    const { fromIso, toIso, fromDisplay, toDisplay } = calculateDateRange(selectedPeriod);

    try {
      // Concurrently query Traccar API endpoints with Accept: application/json
      const [summaryRes, tripsRes, eventsRes] = await Promise.allSettled([
        traccarApi.getSummaryReport(selectedDevice.id, fromIso, toIso),
        traccarApi.getTripsReport(selectedDevice.id, fromIso, toIso),
        traccarApi.getEvents(selectedDevice.id, fromIso, toIso),
      ]);

      const summaryList = summaryRes.status === 'fulfilled' ? summaryRes.value || [] : [];
      const tripsList: TripItem[] = tripsRes.status === 'fulfilled' ? tripsRes.value || [] : [];
      const eventsList = eventsRes.status === 'fulfilled' ? eventsRes.value || [] : [];

      const sum = summaryList[0] || null;

      // Extract real metrics or compute from trips
      let distanceMeters = sum?.distance || 0;
      if (!distanceMeters && tripsList.length > 0) {
        distanceMeters = tripsList.reduce((acc, t) => acc + (t.distance || 0), 0);
      }
      const distKm = (distanceMeters / 1000).toFixed(1);

      let maxSpeed = sum?.maxSpeed ? Math.round(sum.maxSpeed * 1.852) : 0;
      if (!maxSpeed && tripsList.length > 0) {
        maxSpeed = Math.round(Math.max(...tripsList.map((t) => t.maxSpeed || 0)) * 1.852);
      }

      let avgSpeed = sum?.averageSpeed ? Math.round(sum.averageSpeed * 1.852) : 0;
      if (!avgSpeed && tripsList.length > 0) {
        const sumAvg = tripsList.reduce((acc, t) => acc + (t.averageSpeed || 0), 0);
        avgSpeed = Math.round((sumAvg / tripsList.length) * 1.852);
      }

      const spentFuel = sum?.spentFuel ? `${sum.spentFuel.toFixed(1)} L` : '0.0 L';

      setReportData({
        generatedAt: new Date().toLocaleTimeString('en-US', { hour12: true }),
        totalDistanceKm: `${distKm} km`,
        maxSpeedKmh: `${maxSpeed} km/h`,
        avgSpeedKmh: `${avgSpeed} km/h`,
        tripsCount: tripsList.length,
        eventsCount: eventsList.length,
        spentFuel,
        trips: tripsList,
        events: eventsList,
        periodLabel: `${fromDisplay}  ➔  ${toDisplay}`,
      });
    } catch (err: any) {
      console.warn('Report generation error:', err);
      setReportError(err.message || 'Could not fetch telemetry records from server.');
    } finally {
      setIsGenerating(false);
    }
  };

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
                  {selectedDevice?.model || 'GPS Asset Tracker'}
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
              <MaterialCommunityIcons name="file-chart-outline" size={20} color="#F59E0B" />
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

        {/* View / Generate Report Button */}
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
            {isGenerating ? 'Querying Traccar Server...' : 'Generate Live Report'}
          </Text>
        </TouchableOpacity>

        {/* ========================================================================= */}
        {/* Rendered Live Report Summary Card & Trip Ledger                          */}
        {/* ========================================================================= */}
        {reportData && (
          <View style={styles.reportSummaryCard}>
            {/* Report Header */}
            <View style={styles.reportSummaryHeader}>
              <View>
                <Text style={styles.reportSummaryTitle}>{reportType}</Text>
                <Text style={styles.reportSummaryMeta}>
                  {selectedDevice?.name} ({selectedDevice?.category || 'Vehicle'}) • Created at {reportData.generatedAt}
                </Text>
                <Text style={styles.reportPeriodBadge}>{reportData.periodLabel}</Text>
              </View>
              <View style={styles.formatBadge}>
                <Text style={styles.formatBadgeText}>{exportFormat}</Text>
              </View>
            </View>

            {/* KPI Metrics Grid */}
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
                <Text style={styles.metricLabel}>Trips</Text>
                <Text style={styles.metricVal}>{reportData.tripsCount}</Text>
              </View>
            </View>

            {/* Trip Ledger Detail Section */}
            {reportData.trips.length > 0 ? (
              <View style={styles.tripsLedgerSection}>
                <Text style={styles.ledgerSectionTitle}>
                  Recorded Trips ({reportData.trips.length})
                </Text>
                {reportData.trips.map((trip, tIdx) => {
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
                })}
              </View>
            ) : (
              <View style={styles.emptyTripsBox}>
                <MaterialCommunityIcons name="road-variant" size={28} color="#94A3B8" />
                <Text style={styles.emptyTripsText}>
                  No active journey trips recorded for this time range.
                </Text>
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
  tripsLedgerSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  ledgerSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
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
  emptyTripsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyTripsText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  downloadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 14,
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
