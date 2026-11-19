import React from 'react';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { TraccarProvider } from '../context/TraccarContext';
import { InAppAlertBanner } from '../components/InAppAlertBanner';
import { PwaInstallBanner } from '../components/PwaInstallBanner';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Head>
        <title>GPS Track - Live Fleet Monitoring</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#121B2A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GPS Track" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </Head>
      <AuthProvider>
        <TraccarProvider>
          <StatusBar style="dark" />
          <InAppAlertBanner />
          <PwaInstallBanner />
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

