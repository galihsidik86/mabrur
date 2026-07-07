import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useAuthStore } from '../src/stores/auth';
import { initDB } from '../src/services/db';
import {
  setupNotificationChannels,
  registerPushToken,
} from '../src/services/notification';
import { startBackgroundLocation } from '../src/services/background';
import { scheduleUpcomingNotifications } from '../src/services/schedule-notify';
import { api } from '../src/services/api';
import Constants from 'expo-constants';

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);
  const bgStarted = useRef(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Init DB + session
  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch (e) {
        console.warn('DB init error:', e);
      }
      setDbReady(true);
      await setupNotificationChannels();
      await loadSession();
    })();
  }, []);

  // Start background services after login
  useEffect(() => {
    if (!isAuthenticated || bgStarted.current) return;
    bgStarted.current = true;

    (async () => {
      // Store API URL for background task access
      const apiUrl =
        Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:3000';
      await SecureStore.setItemAsync('api_url', apiUrl);

      // Register push token
      try {
        const pushToken = await registerPushToken();
        if (pushToken) {
          await api.registerPushToken(pushToken);
        }
      } catch {}

      // Start background location
      await startBackgroundLocation();

      // Schedule reminders for upcoming agenda
      await scheduleUpcomingNotifications();
    })();
  }, [isAuthenticated]);

  // Auth routing
  useEffect(() => {
    if (isLoading || !fontsLoaded || !dbReady) return;

    const inLogin = segments[0] === 'login';

    if (!isAuthenticated && !inLogin) {
      router.replace('/login');
    } else if (isAuthenticated && inLogin) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, fontsLoaded, dbReady, segments]);

  if (isLoading || !fontsLoaded || !dbReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F5F1E8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#8B2E2E" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="rating" />
      </Stack>
    </>
  );
}
