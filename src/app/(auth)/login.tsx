import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { GTS_COLORS } from '../../constants/theme';
import { GpsTrackLogo } from '../../components/GpsTrackLogo';
import { APP_CONFIG } from '../../constants/config';

export default function LoginScreen() {
  const {
    loginWithCredentials,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email or username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithCredentials(email.trim(), password.trim(), rememberMe);
      router.replace('/(tabs)');
    } catch (err: any) {
      let msg = err.message || 'Login failed. Please verify credentials.';
      if (msg.includes('NullPointerException') || msg.includes('loginResult')) {
        msg = 'Invalid username or password. Please verify your credentials.';
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWebsite = () => {
    Linking.openURL(APP_CONFIG.COMPANY_WEBSITE).catch(() => {
      Alert.alert('Website', APP_CONFIG.COMPANY_WEBSITE);
    });
  };

  const handleWhatsApp = () => {
    Linking.openURL(`https://wa.me/${APP_CONFIG.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}`).catch(() => {
      Alert.alert('WhatsApp Support', `Contact: ${APP_CONFIG.WHATSAPP_NUMBER}`);
    });
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${APP_CONFIG.SUPPORT_PHONE}`).catch(() => {
      Alert.alert('Helpline Support', `Call: ${APP_CONFIG.SUPPORT_PHONE}`);
    });
  };

  if (authLoading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={GTS_COLORS.accentOrange} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Official GPS TRACK App Logo */}
        <View style={styles.topLogoArea}>
          <GpsTrackLogo size="large" showContainer={true} />
        </View>

        {/* Floating Dark Charcoal Card */}
        <View style={styles.loginCard}>
          <Text style={styles.cardTitle}>Login</Text>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Email field with underline */}
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.underlineInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Username / Email"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password field with underline & eye toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.underlineInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye' : 'eye-outline'}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && (
                <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.rememberLabel}>Remember me</Text>
          </TouchableOpacity>

          {/* Login Orange Button */}
          <TouchableOpacity
            style={styles.orangeLoginBtn}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.orangeLoginText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Giant Eye Tech Brand Card - No server IP input needed for customers */}
          <TouchableOpacity
            style={styles.brandCreditBox}
            onPress={handleOpenWebsite}
            activeOpacity={0.85}
          >
            <View style={styles.brandIconWrap}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#10B981" />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandSubtext}>Designed and Developed by</Text>
              <Text style={styles.brandTitle}>{APP_CONFIG.COMPANY_NAME}</Text>
              <Text style={styles.brandLink}>{APP_CONFIG.COMPANY_WEBSITE}</Text>
            </View>
            <MaterialCommunityIcons name="open-in-new" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Bottom Action Row: WhatsApp, Helpline Support, Website */}
          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              style={styles.actionCol}
              onPress={handleWhatsApp}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="#16A34A" />
              </View>
              <Text style={styles.actionLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCol}
              onPress={handleCallSupport}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="phone-in-talk" size={24} color="#D97706" />
              </View>
              <Text style={styles.actionLabel}>24/7 Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCol}
              onPress={handleOpenWebsite}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <MaterialCommunityIcons name="earth" size={24} color="#0284C7" />
              </View>
              <Text style={styles.actionLabel}>Official Site</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    minHeight: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  topLogoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  gtsBadge: {
    position: 'absolute',
    left: '28%',
    top: '38%',
  },
  gtsText: {
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  loginCard: {
    backgroundColor: '#353941',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  underlineInput: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#6B7280',
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: 8,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 14,
  },
  forgotText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#E85A1D',
    borderColor: '#E85A1D',
  },
  rememberLabel: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  orangeLoginBtn: {
    backgroundColor: '#E85A1D',
    borderRadius: 24,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E85A1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  orangeLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  brandCreditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#273449',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
  },
  brandIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextWrap: {
    flex: 1,
  },
  brandSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F9FAFB',
    marginTop: 1,
  },
  brandLink: {
    fontSize: 11,
    color: '#E85A1D',
    fontWeight: '600',
    marginTop: 1,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 14,
    marginTop: 12,
  },
  actionCol: {
    alignItems: 'center',
    gap: 6,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
});
