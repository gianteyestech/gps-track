import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTraccar } from '../../context/TraccarContext';
import { GTS_COLORS } from '../../constants/theme';

interface AlertItem {
  id: string;
  name: string;
  enabled: boolean;
}

export default function AlertsScreen() {
  const { devices } = useTraccar();

  const [alerts, setAlerts] = useState<AlertItem[]>([
    { id: '1', name: 'Battery Disconnected', enabled: true },
    { id: '2', name: 'Lahore Zone', enabled: true },
    { id: '3', name: 'OverSpeed', enabled: true },
  ]);

  // Add Alert Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertName, setAlertName] = useState('');
  const [alertValue, setAlertValue] = useState('');
  const [selectedType, setSelectedType] = useState('Overspeed');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(devices[0]?.name || 'AZU-578');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  const alertTypes = [
    'Overspeed',
    'Stop Duration',
    'Offline Duration',
    'Ignition Duration',
    'Idle Duration',
    'Geofence In',
    'Geofence Out',
    'Geofence In/Out',
    'Start of movement',
    'SOS',
    'Fuel(Fill/Theft)',
    'Driver change unauthorized',
  ];

  const toggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleSaveAlert = () => {
    if (!alertName.trim()) {
      Alert.alert('Required', 'Please enter alert name.');
      return;
    }
    const newAlert: AlertItem = {
      id: Date.now().toString(),
      name: alertName.trim(),
      enabled: true,
    };
    setAlerts((prev) => [...prev, newAlert]);
    setAlertName('');
    setAlertValue('');
    setShowAddModal(false);
    Alert.alert('Success', `Alert "${newAlert.name}" created successfully!`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header matching Image 3 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={() => setShowAddModal(true)}
          >
            <MaterialCommunityIcons name="plus-circle" size={26} color={GTS_COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Alerts List matching Image 3 */}
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.alertCard}
              onPress={() => toggleAlert(item.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.alertCardTitle}>{item.name}</Text>
              <View
                style={[
                  styles.checkbox,
                  item.enabled && styles.checkboxActive,
                ]}
              >
                {item.enabled && (
                  <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Add Alert Modal matching Image 6 & Image 8 */}
      <Modal visible={showAddModal} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.modalBackBtn}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#15803D" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add Alerts</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Name Input */}
            <View style={styles.cardInputWrap}>
              <TextInput
                style={styles.cardInput}
                placeholder="Name"
                placeholderTextColor="#9CA3AF"
                value={alertName}
                onChangeText={setAlertName}
              />
            </View>

            {/* Value Input */}
            <View style={styles.cardInputWrap}>
              <TextInput
                style={styles.cardInput}
                placeholder="Value"
                placeholderTextColor="#9CA3AF"
                value={alertValue}
                onChangeText={setAlertValue}
              />
            </View>

            {/* Select Alert Type Dropdown matching Image 6 & 8 */}
            <View style={styles.dropdownWrap}>
              <TouchableOpacity
                style={styles.cardInputWrap}
                onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              >
                <Text style={styles.dropdownLabel}>{selectedType || 'Select Alert Type'}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>

              {showTypeDropdown && (
                <View style={styles.dropdownSheet}>
                  {alertTypes.map((t, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dropdownItem,
                        selectedType === t && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedType(t);
                        setShowTypeDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedType === t && styles.dropdownItemTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Select Vehicle Dropdown */}
            <View style={styles.dropdownWrap}>
              <TouchableOpacity
                style={styles.cardInputWrap}
                onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
              >
                <Text style={styles.dropdownLabel}>{selectedVehicle || 'Select Vehicle'}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#6B7280" />
              </TouchableOpacity>

              {showVehicleDropdown && (
                <View style={styles.dropdownSheet}>
                  {devices.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedVehicle(d.name);
                        setShowVehicleDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Save Button matching Image 8 */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAlert}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  addIconBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 90,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  alertCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#6D28D9', // Purple checkbox matching Image 3
    borderColor: '#6D28D9',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalBackBtn: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
  },
  cardInputWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInput: {
    fontSize: 15,
    color: '#111827',
    width: '100%',
  },
  dropdownWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  dropdownLabel: {
    fontSize: 15,
    color: '#111827',
  },
  dropdownSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: {
    backgroundColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: '#111827',
  },
  saveBtn: {
    backgroundColor: '#2563EB', // Blue pill button matching Image 8
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
