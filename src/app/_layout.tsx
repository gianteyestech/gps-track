import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { TraccarProvider } from '../context/TraccarContext';
import { InAppAlertBanner } from '../components/InAppAlertBanner';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TraccarProvider>
          <StatusBar style="dark" />
          <InAppAlertBanner />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
            <Stack.Screen
              name="device/[id]"
              options={{
                headerShown: true,
                headerTitle: 'Device Telemetry',
                headerBackTitle: 'Back',
                headerTintColor: '#0F172A',
              }}
            />
            <Stack.Screen
              name="playback/[id]"
              options={{
                headerShown: true,
                headerTitle: 'Route Playback',
                headerBackTitle: 'Back',
                headerTintColor: '#0F172A',
              }}
            />
            <Stack.Screen
              name="reports/[id]"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
        </TraccarProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

