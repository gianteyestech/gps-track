import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  Linking,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTraccar } from '../../context/TraccarContext';
import { traccarApi } from '../../services/api';
import { GTS_COLORS } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { Device, Geofence } from '../../types/traccar';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationPreferences } from '../../services/notifications';

const parseGeofenceDetails = (area?: string) => {
  if (!area) {
    return {
      type: 'Boundary Zone',
      detail: 'Virtual safety perimeter',
      icon: 'map-marker-radius' as const,
      color: '#10B981',
      bg: '#DCFCE7',
    };
  }

  const trimmed = area.trim().toUpperCase();
  if (trimmed.startsWith('CIRCLE')) {
    const match = area.match(/,\s*([0-9.]+)\)/);
    const radiusMeters = match ? parseFloat(match[1]) : 1000;
    const formattedRadius =
      radiusMeters >= 1000
        ? `${(radiusMeters / 1000).toFixed(1)} km`
        : `${Math.round(radiusMeters)} m`;
    return {
      type: 'Circular Zone',
      detail: `Radius: ${formattedRadius}`,
      icon: 'circle-outline' as const,
      color: '#0284C7',
      bg: '#E0F2FE',
    };
  }

  if (trimmed.startsWith('POLYGON')) {
    const coordsMatch = area.match(/([0-9.-]+\s+[0-9.-]+)/g);
    const count = coordsMatch ? coordsMatch.length : 0;
    return {
      type: 'Polygon Perimeter',
      detail: count > 0 ? `${count} GPS boundary vertices` : 'Custom boundary',
      icon: 'vector-polygon' as const,
      color: '#8B5CF6',
      bg: '#EDE9FE',
    };
  }

  return {
    type: 'Safety Zone',
    detail: 'Virtual perimeter',
    icon: 'map-marker-radius' as const,
    color: '#059669',
    bg: '#D1FAE5',
  };
};

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const { devices, refreshData } = useTraccar();

  // Fuel Price
  const [fuelPrice, setFuelPrice] = useState('338.16');
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [tempPrice, setTempPrice] = useState(fuelPrice);

  // Success / Feedback Toast
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Modern In-App Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 1. Register A New Device Modal
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [devName, setDevName] = useState('');
  const [devUniqueId, setDevUniqueId] = useState('');
  const [devPhone, setDevPhone] = useState('');
  const [devCategory, setDevCategory] = useState<'car' | 'truck' | 'motorcycle' | 'bus' | 'van'>('car');
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // 2. Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // 3. Geofence Modal
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loadingGeofences, setLoadingGeofences] = useState(false);
  const [newGeoName, setNewGeoName] = useState('');
  const [newGeoRadius, setNewGeoRadius] = useState('1000');
  const [isCreatingGeo, setIsCreatingGeo] = useState(false);

  // 4. Over Speeding Modal
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [speedThreshold, setSpeedThreshold] = useState('100');

  // 5. Change Device Setting Modal
  const [showDeviceEditModal, setShowDeviceEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCategory, setEditCategory] = useState<string>('car');
  const [isUpdatingDev, setIsUpdatingDev] = useState(false);

  // 6. Terms / Privacy Info Modal
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoContent, setInfoContent] = useState('');

  // 7. Notification Preferences Modal
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(notificationService.getPreferences());

  useEffect(() => {
    notificationService.loadPreferences().then((p) => setNotifPrefs(p));
  }, []);

  const handleTogglePref = async (key: keyof NotificationPreferences) => {
    const updated = await notificationService.setPreferences({ [key]: !notifPrefs[key] });
    setNotifPrefs({ ...updated });
    showToast(`${key === 'enabled' ? 'Master Alerts' : key === 'sound' ? 'Alert Chime' : key} ${!notifPrefs[key] ? 'Enabled' : 'Muted'}`);
  };

  // Push notification test & live browser permission
  const handleTestPush = async () => {
    try {
      if (Platform.OS === 'web') {
        const granted = await notificationService.requestWebPermission();
        if (!granted && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'denied') {
          showToast('⚠️ Notifications blocked in browser. Please allow in address bar icon.');
          return;
        }
      }

      await notificationService.sendTestAlert('PT-3512');
      showToast('🔔 Live alert dispatched! Check banner, sound & notification.');
    } catch (err: any) {
      showToast('Alert dispatched.');
    }
  };

  const handleSetPrice = () => {
    setFuelPrice(tempPrice);
    setShowFuelModal(false);
    showToast(`Fuel price updated to PKR ${tempPrice}`);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      router.replace('/(auth)/login');
    }
  };

  // --- Handlers for Admin Features ---

  // Register New Device
  const handleSaveDevice = async () => {
    setDeviceError(null);
    if (!devName.trim() || !devUniqueId.trim()) {
      setDeviceError('Please enter both Device Name and IMEI / Unique ID.');
      return;
    }

    setIsSubmittingDevice(true);
    try {
      await traccarApi.createDevice({
        name: devName.trim(),
        uniqueId: devUniqueId.trim(),
        category: devCategory,
        phone: devPhone.trim() || undefined,
      });

      await refreshData();
      setShowAddDeviceModal(false);
      setDevName('');
      setDevUniqueId('');
      setDevPhone('');
      showToast(`✅ Tracker "${devName.trim()}" registered successfully!`);
    } catch (err: any) {
      setDeviceError(err.message || 'Failed to add tracker. Verify IMEI.');
    } finally {
      setIsSubmittingDevice(false);
    }
  };

  // Change Password
  const handleSavePassword = async () => {
    setPassError(null);
    if (!newPass || newPass.length < 4) {
      setPassError('Password must be at least 4 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('Passwords do not match.');
      return;
    }

    setIsSubmittingPass(true);
    try {
      if (user && user.id) {
        await traccarApi.updateUser({
          ...user,
          password: newPass,
        });
        setShowPasswordModal(false);
        setNewPass('');
        setConfirmPass('');
        showToast('🔑 Password updated successfully!');
      } else {
        throw new Error('User session not found.');
      }
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  // Open Geofences
  const handleOpenGeofences = async () => {
    setShowGeofenceModal(true);
    setLoadingGeofences(true);
    try {
      const list = await traccarApi.getGeofences();
      setGeofences(list || []);
    } catch {
      setGeofences([]);
    } finally {
      setLoadingGeofences(false);
    }
  };

  // Add Geofence
  const handleCreateGeofence = async () => {
    if (!newGeoName.trim()) {
      return;
    }

    setIsCreatingGeo(true);
    try {
      // Default center: Karachi coordinates (or first vehicle)
      const lat = 24.8607;
      const lon = 67.0011;
      const radius = parseFloat(newGeoRadius) || 1000;

      const created = await traccarApi.createGeofence({
        name: newGeoName.trim(),
        area: `CIRCLE (${lat} ${lon}, ${radius})`,
      });

      setGeofences((prev) => [...prev, created]);
      setNewGeoName('');
      showToast(`📍 Geofence "${created.name}" created!`);
    } catch (err: any) {
      showToast('Could not create geofence.');
    } finally {
      setIsCreatingGeo(false);
    }
  };

  // Delete Geofence
  const handleDeleteGeofence = async (id: number) => {
    try {
      await traccarApi.deleteGeofence(id);
      setGeofences((prev) => prev.filter((g) => g.id !== id));
      showToast('Geofence removed.');
    } catch {
      showToast('Could not delete geofence.');
    }
  };

  // Open Edit Device
  const handleOpenDeviceEdit = () => {
    if (devices.length > 0) {
      const first = devices[0];
      setSelectedDevice(first);
      setEditName(first.name);
      setEditPhone(first.phone || '');
      setEditCategory(first.category || 'car');
    }
    setShowDeviceEditModal(true);
  };

  // Save Device Settings
  const handleSaveDeviceEdit = async () => {
    if (!selectedDevice) return;
    setIsUpdatingDev(true);
    try {
      await traccarApi.updateDevice(selectedDevice.id, {
        ...selectedDevice,
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        category: editCategory,
      });

      await refreshData();
      setShowDeviceEditModal(false);
      showToast(`✅ "${editName}" settings updated!`);
    } catch (err: any) {
      showToast('Failed to update device.');
    } finally {
      setIsUpdatingDev(false);
    }
  };

  // Open Terms / Privacy
  const handleOpenInfo = (type: 'terms' | 'privacy') => {
    if (type === 'terms') {
      setInfoTitle('Terms & Conditions');
      setInfoContent(
        `Welcome to GPS Track, designed and developed by GIANT EYE TECH (https://gianteyetech.com).\n\n` +
        `1. Service Usage: This telemetry and GPS tracking software is provided for authorized fleet and asset monitoring only.\n\n` +
        `2. Telemetry Accuracy: GPS coordinates, speed calculations, and geofence alarms depend on cellular network towers and satellite fix quality.\n\n` +
        `3. Security: All server communications are encrypted. Do not share admin credentials with unauthorized operators.\n\n` +
        `4. Support: 24/7 assistance is provided by Giant Eye Tech via info@gianteyetech.com.`
      );
    } else {
      setInfoTitle('Privacy Policy');
      setInfoContent(
        `Your Privacy is Protected by GIANT EYE TECH.\n\n` +
        `1. Data Ownership: All GPS tracking telemetry, coordinates, route history, and alarms belong strictly to your company account.\n\n` +
        `2. Encryption: Vehicle data is transmitted over secure channels and stored on your dedicated cloud node.\n\n` +
        `3. No Third-Party Selling: GIANT EYE TECH never sells or rents your vehicle locations or driver telemetry to third parties.\n\n` +
        `4. Contact: For privacy inquiries, visit https://gianteyetech.com.`
      );
    }
    setShowInfoModal(true);
  };

  const settingsItems = [
    {
      title: 'Terms & Conditions',
      icon: 'file-document',
      iconColor: '#0284C7',
      onPress: () => handleOpenInfo('terms'),
    },
    {
      title: 'Privacy',
      icon: 'shield-alert',
      iconColor: '#EAB308',
      onPress: () => handleOpenInfo('privacy'),
    },
    {
      title: 'Change Password',
      icon: 'sync-circle',
      iconColor: '#EF4444',
      onPress: () => setShowPasswordModal(true),
    },
    {
      title: 'Reports',
      icon: 'chart-bar',
      iconColor: '#F59E0B',
      onPress: () => router.push(devices.length > 0 ? `/reports/${devices[0].id}` : '/reports/1'),
    },
    {
      title: 'Alerts Log History',
      icon: 'bell',
      iconColor: '#EF4444',
      onPress: () => router.push('/(tabs)/events'),
    },
    {
      title: 'Notification Settings (Enable / Disable)',
      icon: 'bell-cog',
      iconColor: '#2563EB',
      onPress: () => setShowNotifModal(true),
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
      onPress: handleOpenGeofences,
    },
    {
      title: 'Over Speeding',
      icon: 'speedometer',
      iconColor: '#F59E0B',
      onPress: () => setShowSpeedModal(true),
    },
    {
      title: 'Change Device Setting',
      icon: 'car-cog',
      iconColor: '#475569',
      onPress: handleOpenDeviceEdit,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings Screen</Text>
      </View>

      {/* Floating Status Feedback Toast */}
      {feedbackMsg && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{feedbackMsg}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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

          {/* Fuel Price Item */}
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

          {/* Register A New Device */}
          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => setShowAddDeviceModal(true)}
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
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* 1. Register A New Device Modal                                           */}
      {/* ========================================================================= */}
      <Modal visible={showAddDeviceModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 440 }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="car" size={28} color="#0284C7" />
            </View>

            <Text style={styles.modernModalTitle}>Register A New Tracker</Text>
            <Text style={styles.modernModalDesc}>Add a GPS tracker IMEI to your Traccar server.</Text>

            {deviceError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{deviceError}</Text>
              </View>
            )}

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Vehicle Name / Plate *</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. Toyota Corolla - ABC-123"
                value={devName}
                onChangeText={setDevName}
              />
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Tracker IMEI / Unique ID *</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. 867543029182374"
                keyboardType="numeric"
                value={devUniqueId}
                onChangeText={setDevUniqueId}
              />
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Category</Text>
              <View style={styles.categoryPillsRow}>
                {(['car', 'truck', 'motorcycle', 'bus', 'van'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catPill, devCategory === cat && styles.catPillActive]}
                    onPress={() => setDevCategory(cat)}
                  >
                    <Text style={[styles.catPillText, devCategory === cat && styles.catPillTextActive]}>
                      {cat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>SIM Phone Number (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="+92 300 1234567"
                keyboardType="phone-pad"
                value={devPhone}
                onChangeText={setDevPhone}
              />
            </View>

            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowAddDeviceModal(false)}
                disabled={isSubmittingDevice}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernLogoutBtn, { backgroundColor: '#E85A1D' }]}
                onPress={handleSaveDevice}
                disabled={isSubmittingDevice}
              >
                {isSubmittingDevice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modernLogoutBtnText}>Register Vehicle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. Change Password Modal                                                 */}
      {/* ========================================================================= */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 380 }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="lock-reset" size={28} color="#DC2626" />
            </View>

            <Text style={styles.modernModalTitle}>Change Password</Text>
            <Text style={styles.modernModalDesc}>Update your Traccar account password.</Text>

            {passError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{passError}</Text>
              </View>
            )}

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>New Password</Text>
              <TextInput
                style={styles.modalTextInput}
                secureTextEntry
                placeholder="Enter new password"
                value={newPass}
                onChangeText={setNewPass}
              />
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Confirm Password</Text>
              <TextInput
                style={styles.modalTextInput}
                secureTextEntry
                placeholder="Re-enter password"
                value={confirmPass}
                onChangeText={setConfirmPass}
              />
            </View>

            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowPasswordModal(false)}
                disabled={isSubmittingPass}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernLogoutBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleSavePassword}
                disabled={isSubmittingPass}
              >
                {isSubmittingPass ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modernLogoutBtnText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. Geofence Setting Modal                                                */}
      {/* ========================================================================= */}
      <Modal visible={showGeofenceModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 480, maxHeight: '90%' }]}>
            {/* Modal Header */}
            <View style={styles.geoModalHeader}>
              <View style={[styles.logoutIconBubble, { backgroundColor: '#DCFCE7', marginBottom: 0 }]}>
                <MaterialCommunityIcons name="map-marker-radius" size={26} color="#16A34A" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modernModalTitle}>Geofence Settings</Text>
                <Text style={styles.modernModalDesc}>Virtual perimeters & safe zones</Text>
              </View>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={() => setShowGeofenceModal(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              {/* Existing Geofences List */}
              <View style={styles.geoSectionCard}>
                <View style={styles.geoSectionHeader}>
                  <Text style={styles.geoSectionTitle}>Active Zones</Text>
                  <View style={styles.geoCountBadge}>
                    <Text style={styles.geoCountText}>{geofences.length}</Text>
                  </View>
                </View>

                {loadingGeofences ? (
                  <ActivityIndicator color="#E85A1D" style={{ marginVertical: 20 }} />
                ) : geofences.length === 0 ? (
                  <View style={styles.emptyGeoWrap}>
                    <MaterialCommunityIcons name="map-marker-off" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyGeoText}>No geofences created on server yet.</Text>
                  </View>
                ) : (
                  <View style={styles.geoListScrollBox}>
                    {geofences.map((g) => {
                      const info = parseGeofenceDetails(g.area);
                      return (
                        <View key={g.id} style={styles.geoItemCard}>
                          <View style={[styles.geoItemIconBubble, { backgroundColor: info.bg }]}>
                            <MaterialCommunityIcons name={info.icon as any} size={18} color={info.color} />
                          </View>
                          <View style={{ flex: 1, paddingHorizontal: 10 }}>
                            <View style={styles.geoNameRow}>
                              <Text style={styles.geoItemName} numberOfLines={1}>
                                {g.name}
                              </Text>
                              <View style={[styles.geoTypePill, { backgroundColor: info.bg }]}>
                                <Text style={[styles.geoTypePillText, { color: info.color }]}>
                                  {info.type}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.geoItemDetail}>{info.detail}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.geoDeleteBtn}
                            onPress={() => handleDeleteGeofence(g.id)}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Add New Circular Geofence Section */}
              <View style={[styles.geoSectionCard, { marginTop: 14 }]}>
                <Text style={styles.geoSectionTitle}>Add New Circular Zone</Text>
                <Text style={styles.geoSectionSub}>Create an instant circular safety perimeter.</Text>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputFieldLabel}>Zone Name *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. Head Office, Warehouse, Port"
                    value={newGeoName}
                    onChangeText={setNewGeoName}
                  />
                </View>

                {/* Quick Radius Presets */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputFieldLabel}>Radius Preset</Text>
                  <View style={styles.radiusPillsRow}>
                    {[
                      { label: '500 m', value: '500' },
                      { label: '1.0 km', value: '1000' },
                      { label: '2.0 km', value: '2000' },
                      { label: '5.0 km', value: '5000' },
                    ].map((preset) => {
                      const isActive = newGeoRadius === preset.value;
                      return (
                        <TouchableOpacity
                          key={preset.value}
                          style={[styles.radiusPill, isActive && styles.radiusPillActive]}
                          onPress={() => setNewGeoRadius(preset.value)}
                        >
                          <Text style={[styles.radiusPillText, isActive && styles.radiusPillTextActive]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputFieldLabel}>Custom Radius (Meters)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. 1500"
                    keyboardType="numeric"
                    value={newGeoRadius}
                    onChangeText={setNewGeoRadius}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.createGeoBtn, { marginTop: 16 }]}
                  onPress={handleCreateGeofence}
                  disabled={isCreatingGeo}
                >
                  {isCreatingGeo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="plus-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.createGeoBtnText}>Create Geofence Zone</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 4. Over Speeding Modal                                                   */}
      {/* ========================================================================= */}
      <Modal visible={showSpeedModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 380 }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="speedometer" size={28} color="#D97706" />
            </View>

            <Text style={styles.modernModalTitle}>Over Speeding Threshold</Text>
            <Text style={styles.modernModalDesc}>Set speed threshold in km/h for trigger alerts.</Text>

            <View style={styles.inputGroupFull}>
              <TextInput
                style={[styles.modalTextInput, { textAlign: 'center', fontSize: 24, fontWeight: '800' }]}
                keyboardType="numeric"
                value={speedThreshold}
                onChangeText={setSpeedThreshold}
              />
              <Text style={{ textAlign: 'center', color: '#64748B', fontSize: 12, marginTop: 4 }}>KM / HOUR</Text>
            </View>

            <View style={styles.speedPresetsRow}>
              {['60', '80', '100', '120'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.speedPill, speedThreshold === preset && styles.speedPillActive]}
                  onPress={() => setSpeedThreshold(preset)}
                >
                  <Text style={[styles.speedPillText, speedThreshold === preset && styles.speedPillTextActive]}>
                    {preset} km/h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowSpeedModal(false)}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernLogoutBtn, { backgroundColor: '#D97706' }]}
                onPress={() => {
                  setShowSpeedModal(false);
                  showToast(`⚡ Max speed threshold set to ${speedThreshold} km/h`);
                }}
              >
                <Text style={styles.modernLogoutBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. Change Device Setting Modal                                           */}
      {/* ========================================================================= */}
      <Modal visible={showDeviceEditModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 440 }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#F1F5F9' }]}>
              <MaterialCommunityIcons name="car-cog" size={28} color="#475569" />
            </View>

            <Text style={styles.modernModalTitle}>Device Settings</Text>
            <Text style={styles.modernModalDesc}>Edit tracker details and vehicle attributes.</Text>

            {/* Vehicle Selector */}
            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Select Vehicle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {devices.map((dev) => (
                  <TouchableOpacity
                    key={dev.id}
                    style={[styles.devSelectChip, selectedDevice?.id === dev.id && styles.devSelectChipActive]}
                    onPress={() => {
                      setSelectedDevice(dev);
                      setEditName(dev.name);
                      setEditPhone(dev.phone || '');
                      setEditCategory(dev.category || 'car');
                    }}
                  >
                    <Text style={[styles.devSelectText, selectedDevice?.id === dev.id && styles.devSelectTextActive]}>
                      {dev.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>Vehicle Name</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editName}
                onChangeText={setEditName}
              />
            </View>

            <View style={styles.inputGroupFull}>
              <Text style={styles.inputFieldLabel}>SIM Phone Number</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editPhone}
                onChangeText={setEditPhone}
              />
            </View>

            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowDeviceEditModal(false)}
                disabled={isUpdatingDev}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernLogoutBtn, { backgroundColor: '#475569' }]}
                onPress={handleSaveDeviceEdit}
                disabled={isUpdatingDev}
              >
                {isUpdatingDev ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modernLogoutBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. Notification Preferences Modal (Enable / Disable Alerts)                */}
      {/* ========================================================================= */}
      <Modal visible={showNotifModal} transparent animationType="slide">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 440, maxHeight: '88%' }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#DBEAFE' }]}>
              <MaterialCommunityIcons name="bell-cog" size={28} color="#2563EB" />
            </View>

            <Text style={styles.modernModalTitle}>Notification Settings</Text>
            <Text style={styles.modernModalDesc}>Control live fleet alerts, audio chimes, and triggers.</Text>

            <ScrollView style={{ width: '100%', marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {/* Master Switch Card */}
              <View style={[styles.notifToggleRow, { backgroundColor: notifPrefs.enabled ? '#EFF6FF' : '#F1F5F9', borderColor: notifPrefs.enabled ? '#93C5FD' : '#E2E8F0' }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.notifToggleTitle, { color: notifPrefs.enabled ? '#1D4ED8' : '#475569' }]}>
                    Master Push Alerts
                  </Text>
                  <Text style={styles.notifToggleSub}>
                    {notifPrefs.enabled ? 'Live alerts enabled across your fleet' : 'All vehicle notifications are muted'}
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.enabled}
                  onValueChange={() => handleTogglePref('enabled')}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Individual Trigger Switches */}
              <View style={[styles.geoSectionCard, { marginTop: 12, opacity: notifPrefs.enabled ? 1 : 0.45 }]}>
                <Text style={styles.geoSectionTitle}>Alert Triggers & Sounds</Text>

                {/* Sound */}
                <View style={styles.prefSubRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="volume-high" size={20} color="#F59E0B" />
                    <View>
                      <Text style={styles.prefItemTitle}>Alert Chime Sound</Text>
                      <Text style={styles.prefItemSub}>Play audio chime when alerts arrive</Text>
                    </View>
                  </View>
                  <Switch
                    disabled={!notifPrefs.enabled}
                    value={notifPrefs.sound}
                    onValueChange={() => handleTogglePref('sound')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Ignition */}
                <View style={styles.prefSubRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="key-wireless" size={20} color="#10B981" />
                    <View>
                      <Text style={styles.prefItemTitle}>Ignition ON / OFF</Text>
                      <Text style={styles.prefItemSub}>Alert when engine turns on or off</Text>
                    </View>
                  </View>
                  <Switch
                    disabled={!notifPrefs.enabled}
                    value={notifPrefs.ignition}
                    onValueChange={() => handleTogglePref('ignition')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Over Speed */}
                <View style={styles.prefSubRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="speedometer" size={20} color="#EF4444" />
                    <View>
                      <Text style={styles.prefItemTitle}>Over Speed Alerts</Text>
                      <Text style={styles.prefItemSub}>Warn when vehicles exceed speed limit</Text>
                    </View>
                  </View>
                  <Switch
                    disabled={!notifPrefs.enabled}
                    value={notifPrefs.overspeed}
                    onValueChange={() => handleTogglePref('overspeed')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Geofence */}
                <View style={styles.prefSubRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="map-marker-radius" size={20} color="#8B5CF6" />
                    <View>
                      <Text style={styles.prefItemTitle}>Geofence Entry / Exit</Text>
                      <Text style={styles.prefItemSub}>Alerts when safety zones are crossed</Text>
                    </View>
                  </View>
                  <Switch
                    disabled={!notifPrefs.enabled}
                    value={notifPrefs.geofence}
                    onValueChange={() => handleTogglePref('geofence')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Motion */}
                <View style={[styles.prefSubRow, { borderBottomWidth: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <MaterialCommunityIcons name="car-traction-control" size={20} color="#06B6D4" />
                    <View>
                      <Text style={styles.prefItemTitle}>Vehicle Motion / Parked</Text>
                      <Text style={styles.prefItemSub}>Notify on vehicle drive or stop</Text>
                    </View>
                  </View>
                  <Switch
                    disabled={!notifPrefs.enabled}
                    value={notifPrefs.motion}
                    onValueChange={() => handleTogglePref('motion')}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* Instant Test Alert Button */}
              <TouchableOpacity
                style={[styles.createGeoBtn, { backgroundColor: '#2563EB', marginTop: 14 }]}
                onPress={handleTestPush}
              >
                <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#FFFFFF" />
                <Text style={styles.createGeoBtnText}>Send Instant Test Alert</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernCancelBtn, { marginTop: 10, width: '100%' }]}
                onPress={() => setShowNotifModal(false)}
              >
                <Text style={styles.modernCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. Terms / Privacy Policy Modal                                          */}
      {/* ========================================================================= */}
      <Modal visible={showInfoModal} transparent animationType="fade">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 440, maxHeight: '80%' }]}>
            <View style={[styles.logoutIconBubble, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="file-document-outline" size={28} color="#0284C7" />
            </View>

            <Text style={styles.modernModalTitle}>{infoTitle}</Text>
            <ScrollView style={{ marginVertical: 12, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, color: '#334155', lineHeight: 20 }}>
                {infoContent}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modernLogoutBtn, { width: '100%', backgroundColor: '#0284C7' }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.modernLogoutBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. Fuel Price Modal                                                      */}
      {/* ========================================================================= */}
      <Modal visible={showFuelModal} transparent animationType="fade">
        <View style={styles.modernModalOverlay}>
          <View style={[styles.modernModalCard, { maxWidth: 360 }]}>
            <Text style={styles.modernModalTitle}>Set Fuel Price Per Liter</Text>
            <TextInput
              style={[styles.modalTextInput, { textAlign: 'center', fontSize: 20, fontWeight: '700', marginVertical: 14 }]}
              keyboardType="decimal-pad"
              value={tempPrice}
              onChangeText={setTempPrice}
            />
            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowFuelModal(false)}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modernLogoutBtn, { backgroundColor: '#EF4444' }]} onPress={handleSetPrice}>
                <Text style={styles.modernLogoutBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. Modern Logout Modal                                                   */}
      {/* ========================================================================= */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modernModalOverlay}>
          <View style={styles.modernModalCard}>
            <View style={styles.logoutIconBubble}>
              <MaterialCommunityIcons name="logout-variant" size={28} color="#DC2626" />
            </View>

            <Text style={styles.modernModalTitle}>Log Out</Text>
            <Text style={styles.modernModalDesc}>
              Are you sure you want to end your active GPS Track monitoring session?
            </Text>

            <View style={styles.modernModalBtnsRow}>
              <TouchableOpacity
                style={styles.modernCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
                disabled={isLoggingOut}
              >
                <Text style={styles.modernCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modernLogoutBtn}
                onPress={handleConfirmLogout}
                activeOpacity={0.85}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="logout" size={16} color="#FFFFFF" />
                    <Text style={styles.modernLogoutBtnText}>Log Out</Text>
                  </>
                )}
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
  toastWrap: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#EF4444',
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
  modernModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modernModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  logoutIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modernModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  modernModalDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  inputGroupFull: {
    width: '100%',
    marginBottom: 12,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  modalTextInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginBottom: 12,
  },
  modalErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  catPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catPillActive: {
    backgroundColor: '#E85A1D',
    borderColor: '#E85A1D',
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  speedPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  speedPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  speedPillActive: {
    backgroundColor: '#D97706',
  },
  speedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  speedPillTextActive: {
    color: '#FFFFFF',
  },
  geoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  geoSectionCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  geoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  geoSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  geoSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 4,
  },
  geoCountBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  geoCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyGeoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  emptyGeoText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  geoListScrollBox: {
    maxHeight: 180,
    width: '100%',
  },
  geoItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  geoItemIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geoItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  geoTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  geoTypePillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  geoItemDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  geoDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  radiusPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  radiusPillTextActive: {
    color: '#FFFFFF',
  },
  createGeoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
  },
  createGeoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  devSelectChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  devSelectChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  devSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  devSelectTextActive: {
    color: '#FFFFFF',
  },
  modernModalBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 14,
  },
  modernCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modernLogoutBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modernLogoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  notifToggleTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  notifToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  prefSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  prefItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  prefItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
});
