import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GTS_COLORS } from '../constants/theme';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
      });
    }

    // Check if already in standalone (installed PWA) mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; // Already running as native installed PWA!
    }

    // Android / Chrome / Edge install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari detection
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos && !isStandalone) {
      setShowIosPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIosPrompt) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={24} color="#E85A1D" />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.bannerTitle}>Install GPS Track</Text>
        <Text style={styles.bannerSubtitle}>
          {showIosPrompt && !deferredPrompt
            ? "Tap Share 📤 then 'Add to Home Screen' for full app experience"
            : 'Install app on your phone for full-screen tracking'}
        </Text>
      </View>

      {deferredPrompt && (
        <TouchableOpacity style={styles.installBtn} onPress={handleInstallClick} activeOpacity={0.8}>
          <Text style={styles.installBtnText}>Install</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.closeBtn} onPress={() => setDismissed(true)}>
        <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 90, 29, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  installBtn: {
    backgroundColor: '#E85A1D',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  installBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
});
