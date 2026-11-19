import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Device } from '../types/traccar';
import { traccarApi } from '../services/api';

interface SendCommandModalProps {
  visible: boolean;
  device: Device | null;
  onClose: () => void;
}

const PRESET_COMMANDS = [
  {
    type: 'engineStop',
    label: 'Engine Cut-off',
    desc: 'Block fuel pump / immobilizer',
    icon: 'power',
    danger: true,
  },
  {
    type: 'engineResume',
    label: 'Engine Resume',
    desc: 'Restore fuel pump & ignition',
    icon: 'power-cycle',
    danger: false,
  },
  {
    type: 'positionSingle',
    label: 'Request Location',
    desc: 'Force immediate GPS fix report',
    icon: 'crosshairs-gps',
    danger: false,
  },
  {
    type: 'alarmArm',
    label: 'Arm Alarm',
    desc: 'Enable shock & movement sensor alarm',
    icon: 'shield-lock-outline',
    danger: false,
  },
  {
    type: 'alarmDisarm',
    label: 'Disarm Alarm',
    desc: 'Disable active alarm state',
    icon: 'shield-off-outline',
    danger: false,
  },
];

export function SendCommandModal({ visible, device, onClose }: SendCommandModalProps) {
  const [selectedType, setSelectedType] = useState<string>('engineStop');
  const [customCommand, setCustomCommand] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  if (!device) return null;

  const handleSend = async () => {
    setIsSending(true);
    try {
      const payload: any = {
        deviceId: device.id,
        type: selectedType,
      };

      if (selectedType === 'custom') {
        payload.attributes = { data: customCommand };
      }

      await traccarApi.sendCommand(payload);
      Alert.alert('Command Sent', `Command successfully queued for ${device.name}`);
      onClose();
    } catch (err: any) {
      Alert.alert('Command Failed', err.message || 'Failed to dispatch command to device.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Send Remote Command</Text>
              <Text style={styles.subtitle}>Target: {device.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* List of preset commands */}
          <View style={styles.commandsList}>
            {PRESET_COMMANDS.map((cmd) => {
              const isSelected = selectedType === cmd.type;
              return (
                <TouchableOpacity
                  key={cmd.type}
                  style={[
                    styles.commandItem,
                    isSelected && styles.commandItemSelected,
                    cmd.danger && isSelected && styles.commandItemDanger,
                  ]}
                  onPress={() => setSelectedType(cmd.type)}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: cmd.danger ? '#FEE2E2' : '#EFF6FF' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={cmd.icon as any}
                      size={20}
                      color={cmd.danger ? '#EF4444' : '#2563EB'}
                    />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text
                      style={[
                        styles.itemTitle,
                        isSelected && { color: cmd.danger ? '#B91C1C' : '#1D4ED8' },
                      ]}
                    >
                      {cmd.label}
                    </Text>
                    <Text style={styles.itemDesc}>{cmd.desc}</Text>
                  </View>
                  {isSelected && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={cmd.danger ? '#EF4444' : '#2563EB'}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendBtn, selectedType === 'engineStop' && styles.dangerSendBtn]}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                <Text style={styles.sendBtnText}>Dispatch Command</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  commandsList: {
    gap: 8,
    marginBottom: 16,
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  commandItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  commandItemDanger: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  dangerSendBtn: {
    backgroundColor: '#DC2626',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

