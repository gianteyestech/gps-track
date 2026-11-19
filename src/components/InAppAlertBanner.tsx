import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { notificationService } from '../services/notifications';
import { useTraccar } from '../context/TraccarContext';

interface BannerData {
  title: string;
  body: string;
  deviceId: number;
}

export function InAppAlertBanner() {
  const [currentAlert, setCurrentAlert] = useState<BannerData | null>(null);
  const slideAnim = React.useRef(new Animated.Value(-120)).current;
  const { setSelectedDeviceId } = useTraccar();

  useEffect(() => {
    const unsub = notificationService.subscribeInAppBanner((alert) => {
      setCurrentAlert(alert);

      // Slide down
      Animated.spring(slideAnim, {
        toValue: 10,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      // Auto dismiss after 8 seconds
      setTimeout(() => {
        dismissBanner();
      }, 8000);
    });

    return () => unsub();
  }, []);

  const dismissBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentAlert(null);
    });
  };

  const handlePress = () => {
    if (currentAlert?.deviceId) {
      setSelectedDeviceId(currentAlert.deviceId);
      router.push({
        pathname: '/(tabs)/map',
        params: { deviceId: currentAlert.deviceId.toString() },
      });
    }
    dismissBanner();
  };

  if (!currentAlert) return null;

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="alert-octagon" size={24} color="#DC2626" />
        </View>

        <View style={styles.textCol}>
          <Text style={styles.bannerTitle}>{currentAlert.title}</Text>
          <Text style={styles.bannerBody} numberOfLines={2}>
            {currentAlert.body}
          </Text>
        </View>

        <TouchableOpacity onPress={dismissBanner} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 40,
    left: 14,
    right: 14,
    zIndex: 9999,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 5,
    borderLeftColor: '#EF4444',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.3,
  },
  bannerBody: {
    fontSize: 12.5,
    color: '#F1F5F9',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
