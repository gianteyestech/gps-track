import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { GTS_COLORS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../../services/notifications';

export default function SettingsScreen() {
  const { logout } = useAuth();

  const [fuelPrice, setFuelPrice] = useState('338.16');
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [tempPrice, setTempPrice] = useState(fuelPrice);

  const handleTestPush = async () => {
    Alert.alert(
      'Test Push Notification',
      'A test notification will trigger in 3 seconds. Lock your phone or minimize the app to see the lock-screen banner!',
      [
        {
          text: 'Send Test Alert',
          onPress: async () => {
            try {
              const token = notificationService.getPushToken();
              if (token && token.startsWith('ExponentPushToken')) {
                await notificationService.sendExpoPushNotification(
                  token,
                  '🚨 GPS Track: Test Geofence Exit',
                  'Vehicle PT-3512 has exited City Zone! (Expo Push Service Active)'
                );
              }

              // Also schedule local OS trigger in 3 seconds
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🚨 GPS Track: Geofence Alert',
                  body: 'Vehicle PT-3512 exited designated geofence! Tap to track live.',
                  sound: 'default',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                  seconds: 3,
                },
              });
            } catch (err: any) {
              Alert.alert('Notification Test', 'Alert scheduled. Please check your notification tray.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSetPrice = () => {
    setFuelPrice(tempPrice);
    setShowFuelModal(false);
    Alert.alert('Updated', `Fuel price set to: ${tempPrice}`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Disconnect Server',
      'Are you sure you want to log out from Traccar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const settingsItems = [
    {
      title: 'Terms & Conditions',
      icon: 'file-document',
      iconColor: '#0284C7',
      onPress: () => Alert.alert('Terms & Conditions', 'GPS Track by Giant Eye Tech terms of service.'),
    },
    {
      title: 'Privacy',
      icon: 'shield-alert',
      iconColor: '#EAB308',
      onPress: () => Alert.alert('Privacy Policy', 'Your location data is encrypted.'),
    },
    {
      title: 'Change Password',
      icon: 'sync-circle',
      iconColor: '#EF4444',
      onPress: () => Alert.alert('Password', 'Change Traccar account password'),
    },
    {
      title: 'Reports',
      icon: 'chart-bar',
      iconColor: '#F59E0B',
      onPress: () => router.push('/reports/1'),
    },
    {
      title: 'Alerts List',
      icon: 'bell',
      iconColor: '#EF4444',
      onPress: () => router.push('/(tabs)/events'),
    },
    {
      title: 'Activate Alerts',
      icon: 'bell-ring',
      iconColor: '#EF4444',
      onPress: () => router.push('/(tabs)/events'),
    },
    {
      title: 'Test Push Notification (Lock Screen)',
      icon: 'bell-badge',
      iconColor: '#10B981',
      onPress: handleTestPush,
    },
    {
      title: 'Geofence Setting',
      icon: 'circle-outline',
      iconColor: '#EF4444',
      onPress: () => Alert.alert('Geofence Setting', 'Manage fleet virtual fences'),
    },
    {
      title: 'Over Speeding',
      icon: 'speedometer',
      iconColor: '#F59E0B',
      onPress: () => Alert.alert('Over Speeding', 'Configure max speed thresholds (km/h)'),
    },
    {
      title: 'Change Device Setting',
      icon: 'car-cog',
      iconColor: '#475569',
      onPress: () => Alert.alert('Device Settings', 'Manage tracker attributes and telemetry intervals'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings Screen</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Settings List matching Image 10 */}
        <View style={styles.listWrap}>
          {settingsItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.settingCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.cardLeft}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={24}
                  color={item.iconColor}
                />
                <Text style={styles.cardLabel}>{item.title}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          ))}

          {/* Fuel Price Item matching Image 10 */}
          <View style={styles.settingCard}>
            <View style={styles.cardLeft}>
              <MaterialCommunityIcons name="gas-station" size={24} color="#EF4444" />
              <Text style={styles.cardLabel}>Fuel Price: {fuelPrice}</Text>
            </View>
            <TouchableOpacity
              style={styles.setPriceBtn}
              onPress={() => setShowFuelModal(true)}
            >
              <Text style={styles.setPriceText}>Set price</Text>
            </TouchableOpacity>
          </View>

          {/* Register A New Device matching Image 10 */}
          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => Alert.alert('Register Device', 'Add a new GPS tracker by IMEI')}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <MaterialCommunityIcons name="car-cog" size={24} color="#475569" />
              <Text style={styles.cardLabel}>Register A New Device</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Company Branding & About Card */}
          <TouchableOpacity
            style={styles.aboutCard}
            onPress={() => Linking.openURL(APP_CONFIG.COMPANY_WEBSITE).catch(() => {})}
            activeOpacity={0.8}
          >
            <View style={styles.aboutHeader}>
              <View style={styles.aboutIconWrap}>
                <MaterialCommunityIcons name="shield-check" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aboutBrand}>{APP_CONFIG.APP_NAME} v1.0.0</Text>
                <Text style={styles.aboutSubtitle}>Designed and Developed by {APP_CONFIG.COMPANY_NAME}</Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={18} color="#9CA3AF" />
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutDetailsRow}>
              <Text style={styles.aboutDetailLabel}>Website:</Text>
              <Text style={styles.aboutDetailValue}>{APP_CONFIG.COMPANY_WEBSITE}</Text>
            </View>
            <View style={styles.aboutDetailsRow}>
              <Text style={styles.aboutDetailLabel}>Server Connection:</Text>
              <View style={styles.secureBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.secureBadgeText}>Secured Cloud Node</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Disconnect & Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fuel Price Modal */}
      <Modal visible={showFuelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Fuel Price Per Liter</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="decimal-pad"
              value={tempPrice}
              onChangeText={setTempPrice}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowFuelModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSetPrice}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
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
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  listWrap: {
    gap: 10,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  setPriceBtn: {
    backgroundColor: '#EF4444', // Red button matching Image 10
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  setPriceText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutBrand: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  aboutSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  aboutDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  aboutDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  aboutDetailValue: {
    fontSize: 12,
    color: '#E85A1D',
    fontWeight: '600',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  secureBadgeText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSave: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
