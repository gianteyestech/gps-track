import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { traccarApi } from '../../services/api';
import { GTS_COLORS } from '../../constants/theme';

export default function ReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = parseInt(id, 10);
  const { devices } = useTraccar();
  const device = devices.find((d) => d.id === deviceId);

  const [reportType, setReportType] = useState('Events Report');
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'HTML'>('PDF');
  const [selectedPeriod, setSelectedPeriod] = useState('Today');
  const [deviceSelected, setDeviceSelected] = useState(true);

  const reportTypes = [
    'Events Report',
    'Temprature Report',
    'Fuel Report',
    'Distance Report',
  ];

  const periodOptions = [
    'Last Hours',
    'Today',
    'Yesterday',
    'Before 2 days',
    'Last 7 days',
    'Last Week',
  ];

  const [isGenerating, setIsGenerating] = useState(false);
  const [reportResult, setReportResult] = useState<{
    generatedAt: string;
    totalDistance: string;
    maxSpeed: string;
    eventsCount: number;
  } | null>(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setReportResult({
        generatedAt: new Date().toLocaleTimeString(),
        totalDistance: '38.4 km',
        maxSpeed: '82 km/h',
        eventsCount: 4,
      });
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{device?.name || 'AZU-578'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Report Type Dropdown */}
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setShowReportDropdown(!showReportDropdown)}
          >
            <Text style={styles.dropdownSelectedText}>{reportType}</Text>
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

        {/* Checkbox: [x] Vehicle Name */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setDeviceSelected(!deviceSelected)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, deviceSelected && styles.checkboxChecked]}>
            {deviceSelected && (
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>{device?.name || 'AZU-578'}</Text>
        </TouchableOpacity>

        {/* PDF / HTML format toggle matching Image 5 */}
        <View style={styles.formatToggleRow}>
          <TouchableOpacity
            style={[
              styles.formatBtn,
              styles.formatBtnLeft,
              exportFormat === 'PDF' && styles.formatBtnActive,
            ]}
            onPress={() => setExportFormat('PDF')}
          >
            <Text
              style={[
                styles.formatBtnText,
                exportFormat === 'PDF' && styles.formatBtnTextActive,
              ]}
            >
              PDF
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
            <Text
              style={[
                styles.formatBtnText,
                exportFormat === 'HTML' && styles.formatBtnTextActive,
              ]}
            >
              HTML
            </Text>
          </TouchableOpacity>
        </View>

        {/* Interval Dropdown */}
        <TouchableOpacity style={styles.intervalBox}>
          <Text style={styles.intervalText}>30 min</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#6B7280" />
        </TouchableOpacity>

        {/* Quick Period Pills (6 pills matching Image 5) */}
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

        {/* Select Custom Date & Time section matching Image 5 */}
        <Text style={styles.customDateTitle}>Select Custom Date & Time</Text>

        <View style={styles.dateTimeGrid}>
          {/* Row 1 */}
          <View style={styles.dateTimeRow}>
            <TouchableOpacity style={styles.darkPill}>
              <Text style={styles.darkPillText}>04-08-2026</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.darkPill}>
              <Text style={styles.darkPillText}>00:00</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={styles.dateTimeRow}>
            <TouchableOpacity style={styles.darkPill}>
              <Text style={styles.darkPillText}>04-08-2026</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.darkPill}>
              <Text style={styles.darkPillText}>1:7</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Report Button matching Image 5 */}
        <TouchableOpacity
          style={[styles.viewReportBtn, isGenerating && { opacity: 0.7 }]}
          onPress={handleGenerateReport}
          disabled={isGenerating}
        >
          <MaterialCommunityIcons name="file-document-multiple-outline" size={20} color="#374151" />
          <Text style={styles.viewReportText}>
            {isGenerating ? 'Processing Report...' : 'View Report'}
          </Text>
        </TouchableOpacity>

        {reportResult && (
          <View style={styles.reportSummaryCard}>
            <View style={styles.reportSummaryHeader}>
              <View>
                <Text style={styles.reportSummaryTitle}>{reportType}</Text>
                <Text style={styles.reportSummaryMeta}>
                  {device?.name || 'Vehicle'} • Generated at {reportResult.generatedAt}
                </Text>
              </View>
              <View style={styles.formatBadge}>
                <Text style={styles.formatBadgeText}>{exportFormat}</Text>
              </View>
            </View>

            <View style={styles.reportMetricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricVal}>{reportResult.totalDistance}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Max Speed</Text>
                <Text style={styles.metricVal}>{reportResult.maxSpeed}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Alarms</Text>
                <Text style={styles.metricVal}>{reportResult.eventsCount}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.downloadReportBtn}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.print();
                }
              }}
            >
              <MaterialCommunityIcons name="download" size={18} color="#FFFFFF" />
              <Text style={styles.downloadReportText}>Export / Print {exportFormat}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    padding: 20,
    paddingBottom: 40,
  },
  dropdownContainer: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 20,
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownSelectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GTS_COLORS.primary,
    borderColor: GTS_COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  formatToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  formatBtn: {
    width: 120,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
  },
  formatBtnLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderRightWidth: 0.75,
  },
  formatBtnRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderLeftWidth: 0.75,
  },
  formatBtnActive: {
    backgroundColor: '#0284C7',
  },
  formatBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  formatBtnTextActive: {
    color: '#FFFFFF',
  },
  intervalBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    gap: 6,
  },
  intervalText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  periodPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 24,
  },
  periodPill: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  periodPillTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  customDateTitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateTimeGrid: {
    gap: 12,
    marginBottom: 28,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  darkPill: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 24,
    paddingVertical: 14,
    gap: 8,
  },
  viewReportText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  reportSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  reportSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  reportSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  reportSummaryMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  formatBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
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
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  downloadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E85A1D',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  downloadReportText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

