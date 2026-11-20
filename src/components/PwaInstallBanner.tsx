import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GTS_COLORS } from '../constants/theme';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isChromeIos, setIsChromeIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window !== 'undefined' && false) return;
    if (typeof window === 'undefined') return;

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

    // iOS detection (iPhone / iPad)
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isCriOS = isIos && /CriOS/.test(ua); // Chrome on iOS

    if (isIos && !isStandalone) {
      setShowIosPrompt(true);
      setIsChromeIos(isCriOS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (showIosPrompt) {
      setShowIosModal(true);
    }
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIosPrompt) return null;

  return (
    <>
      {/* Floating PWA Banner */}
      <View style={styles.bannerContainer}>
        <TouchableOpacity
          style={styles.clickableArea}
          onPress={handleInstallClick}
          activeOpacity={0.8}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="cellphone-arrow-down" size={24} color="#E85A1D" />
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.bannerTitle}>Install GPS Track App</Text>
            <Text style={styles.bannerSubtitle}>
              {showIosPrompt
                ? isChromeIos
                  ? "Tap 'Install' for iPhone Chrome steps"
                  : "Tap 'Install' to Add to Home Screen"
                : 'Install app on your phone for full-screen tracking'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action Button: triggers prompt on Android, opens guide on iOS */}
        <TouchableOpacity
          style={styles.installBtn}
          onPress={handleInstallClick}
          activeOpacity={0.8}
        >
          <Text style={styles.installBtnText}>Install</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={() => setDismissed(true)}>
          <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* iOS Step-by-Step Installation Modal */}
      <Modal visible={showIosModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.appleIconCircle}>
                  <MaterialCommunityIcons name="apple" size={22} color="#0F172A" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Install on iPhone</Text>
                  <Text style={styles.modalSub}>
                    {isChromeIos ? 'Google Chrome on iOS' : 'Safari on iOS'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowIosModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.iosExplanation}>
                Apple iOS does not permit websites to auto-install with a single click. Follow these 3 simple steps to add GPS Track to your iPhone:
              </Text>

              {isChromeIos ? (
                /* Steps for Chrome on iOS */
                <View style={styles.stepsContainer}>
                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>1</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Tap the Three Dots Menu (•••)</Text>
                      <Text style={styles.stepDesc}>
                        Look at the bottom-right corner of Chrome and tap the <Text style={{ fontWeight: '800' }}>•••</Text> menu icon.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>2</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Select 'Add to Home Screen'</Text>
                      <Text style={styles.stepDesc}>
                        Scroll down the menu options and tap <Text style={{ fontWeight: '800' }}>Add to Home Screen (➕)</Text>.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Tap 'Add'</Text>
                      <Text style={styles.stepDesc}>
                        Tap <Text style={{ fontWeight: '800' }}>Add</Text> at the top right to place the app on your home screen.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                /* Steps for Safari on iOS */
                <View style={styles.stepsContainer}>
                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>1</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Tap the Share Button (📤)</Text>
                      <Text style={styles.stepDesc}>
                        Tap the square share icon with an upward arrow in Safari's bottom toolbar.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>2</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Select 'Add to Home Screen'</Text>
                      <Text style={styles.stepDesc}>
                        Scroll down and tap <Text style={{ fontWeight: '800' }}>Add to Home Screen (➕)</Text>.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumBubble}>
                      <Text style={styles.stepNum}>3</Text>
                    </View>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepTitle}>Tap 'Add'</Text>
                      <Text style={styles.stepDesc}>
                        Tap <Text style={{ fontWeight: '800' }}>Add</Text> at the top-right corner to finish.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.tipCard}>
                <MaterialCommunityIcons name="lightbulb-on" size={18} color="#D97706" />
                <Text style={styles.tipText}>
                  Once added, GPS Track will run full-screen just like a native App Store app with no browser address bars!
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.gotItBtn}
              onPress={() => setShowIosModal(false)}
            >
              <Text style={styles.gotItBtnText}>Got It, I'll Add It Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  clickableArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
  },
  iosExplanation: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 14,
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E85A1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 15,
  },
  gotItBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
