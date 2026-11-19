import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { DeviceCard } from '../../components/DeviceCard';
import { DeviceStatusFilter } from '../../types/traccar';
import { GTS_COLORS } from '../../constants/theme';
import { GpsTrackLogo } from '../../components/GpsTrackLogo';

export default function FleetScreen() {
  const {
    filteredDevices,
    positions,
    refreshData,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    stats,
    speedUnit,
    setSelectedDeviceId,
  } = useTraccar();

  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleDevicePress = (deviceId: number) => {
    setSelectedDeviceId(deviceId);
    router.push({
      pathname: '/(tabs)/map',
      params: { deviceId: deviceId.toString() },
    });
  };

  // Status Category Items matching Image 2
  const categories = [
    {
      key: 'all' as DeviceStatusFilter,
      label: 'All Vehicle',
      count: stats.total,
      color: GTS_COLORS.statusAll,
    },
    {
      key: 'moving' as DeviceStatusFilter,
      label: 'Running',
      count: stats.moving,
      color: GTS_COLORS.statusRunning,
    },
    {
      key: 'stopped' as DeviceStatusFilter,
      label: 'Stopped',
      count: stats.stopped,
      color: GTS_COLORS.statusStopped,
    },
    {
      key: 'idle' as DeviceStatusFilter,
      label: 'Idle',
      count: stats.idle,
      color: GTS_COLORS.statusIdle,
    },
    {
      key: 'offline' as DeviceStatusFilter,
      label: 'Offline',
      count: stats.offline,
      color: GTS_COLORS.statusOffline,
    },
    {
      key: 'offline' as DeviceStatusFilter,
      label: 'In Active',
      count: 0,
      color: GTS_COLORS.statusInactive,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          {/* GPS TRACK Logo */}
          <View style={styles.logoRow}>
            <GpsTrackLogo size="small" />
          </View>

          {/* Search Toggle Icon */}
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => setShowSearch(!showSearch)}
          >
            <MaterialCommunityIcons name="magnify" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Expandable Search Input */}
        {showSearch && (
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vehicle name or registration..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 6 Category Status Cards (Horizontal Scroll) */}
        <View style={styles.categoriesWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((cat, idx) => {
              const isSelected = filter === cat.key;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.categoryCard,
                    isSelected && { borderColor: cat.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => setFilter(cat.key)}
                  activeOpacity={0.8}
                >
                  {/* Glowing Top Circle with Car Icon */}
                  <View
                    style={[
                      styles.circleIcon,
                      {
                        backgroundColor: cat.color,
                        shadowColor: cat.color,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="car-side" size={16} color="#FFFFFF" />
                  </View>

                  {/* Count */}
                  <Text style={[styles.catCount, { color: cat.color }]}>{cat.count}</Text>

                  {/* Label */}
                  <Text style={styles.catLabel}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Vehicle Cards List */}
        <FlatList
          data={filteredDevices}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={GTS_COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              position={positions[item.id]}
              onPress={() => handleDevicePress(item.id)}
              speedUnit={speedUnit}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="car-off" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Vehicles Found</Text>
              <Text style={styles.emptySubtitle}>
                No vehicle found for the selected status filter.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gtsLogoText: {
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  searchIconBtn: {
    padding: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  categoriesWrap: {
    marginBottom: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryCard: {
    width: 78,
    height: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  circleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  catCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  catLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90, // Clearance for curved bottom tab bar
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
