import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
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
// Amiri: teks Arab berharakat (frasa, doa) tanpa tanda bertumpuk.
import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/auth';
import { initDB } from '../src/services/db';
import { initLanguage, useI18n } from '../src/services/i18n';
import { useChatUnread } from '../src/services/chat-unread';
import {
  setupNotificationChannels,
  registerPushToken,
} from '../src/services/notification';
import { startBackgroundLocation, stopBackgroundLocation, promptLocationSharing } from '../src/services/background';
import { scheduleUpcomingNotifications } from '../src/services/schedule-notify';
import { retryPendingUploads } from '../src/services/trace-recorder';
import { processQueue as processMediaQueue } from '../src/services/documentation';
import { registerGlobals as registerLiveKitGlobals } from '@livekit/react-native';
import { VoiceHost } from '../src/components/VoiceHost';

// LiveKit (Suara Rombongan) butuh global WebRTC didaftarkan sekali saat start.
registerLiveKitGlobals();
import { api } from '../src/services/api';
import Constants from 'expo-constants';

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadSession, user } = useAuthStore();
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
    Amiri_400Regular,
    Amiri_700Bold,
  });

  // Init DB + session
  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch (e) {
        console.warn('DB init error:', e);
      }
      // Sebelum layar pertama tampil, agar tidak berkedip dari Indonesia ke English.
      await initLanguage();
      setDbReady(true);
      await setupNotificationChannels();
      await loadSession();
    })();
  }, []);

  // Start background services after login
  useEffect(() => {
    // Reset saat logout: akun berikutnya di HP yang sama wajib mendaftarkan push token-nya sendiri.
    if (!isAuthenticated) {
      // Logout: hentikan pelacakan — lokasi tidak lagi dikumpulkan untuk akun mana pun.
      if (bgStarted.current) stopBackgroundLocation();
      bgStarted.current = false;
      return;
    }
    if (bgStarted.current) return;
    bgStarted.current = true;

    (async () => {
      // Store API URL for background task access
      const apiUrl =
        Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:3000';
      await SecureStore.setItemAsync('api_url', apiUrl);

      // Bahasa pilihan ke server (push SOS/pengingat dalam bahasa ini)
      api.setLanguage(useI18n.getState().lang).catch(() => {});

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

      // Unggah ulang trace uji-akurasi yang tertunda (gagal kirim saat offline)
      retryPendingUploads().catch(() => {});

      // Lanjutkan antrean unggah foto Dokumentasi yang tertunda
      processMediaQueue().catch(() => {});
    })();
  }, [isAuthenticated]);

  // Tiap app kembali aktif: unggah trace tertunda, dan hidupkan lagi pelacakan lokasi
  // bila sempat berhenti (mis. GPS baru dinyalakan / izin baru diberikan lewat Pengaturan).
  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      retryPendingUploads().catch(() => {});
      processMediaQueue().catch(() => {});
      startBackgroundLocation(false).catch(() => {});
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Notifikasi chat: perbarui badge saat push masuk (app terbuka) dan tiap app kembali aktif
  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => useChatUnread.getState().refresh();
    refresh();
    const received = Notifications.addNotificationReceivedListener((n) => {
      if (n.request.content.data?.type === 'chat') refresh();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { received.remove(); appState.remove(); };
  }, [isAuthenticated]);

  // Ketuk notifikasi chat -> buka percakapan; pengingat lokasi -> aktifkan lokasi. useLastNotificationResponse juga
  // menangkap ketukan yang membuka app dari kondisi tertutup (cold start).
  // Tiap ketukan diproses sekali (ref id) agar tidak diputar ulang saat appReady berubah;
  // ketukan saat belum login dibuang, bukan ditunda sampai login.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);
  const appReady = isAuthenticated && !isLoading && fontsLoaded && dbReady && !user?.must_change_password;
  useEffect(() => {
    const type = lastResponse?.notification.request.content.data?.type;
    if (!lastResponse || (type !== 'chat' && type !== 'location_reminder')) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    if (!isLoading && !isAuthenticated) {
      handledResponseId.current = id;
      return;
    }
    if (!appReady) return;
    handledResponseId.current = id;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    if (type === 'location_reminder') promptLocationSharing().catch(() => {});
    else if (segments[0] !== 'chat') router.push('/chat');
  }, [appReady, isLoading, isAuthenticated, lastResponse, segments]);

  // Auth routing
  useEffect(() => {
    if (isLoading || !fontsLoaded || !dbReady) return;

    const inLogin = segments[0] === 'login';
    const inChangePw = segments[0] === 'change-password';
    // Akun dgn password awal dari travel/admin wajib menggantinya dulu —
    // layar change-password tidak bisa dilewati selama flag aktif.
    const mustChange = !!user?.must_change_password;

    if (!isAuthenticated && !inLogin) {
      router.replace('/login');
    } else if (isAuthenticated && mustChange && !inChangePw) {
      router.replace('/change-password');
    } else if (isAuthenticated && !mustChange && (inLogin || inChangePw)) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, fontsLoaded, dbReady, segments, user]);

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
        <ActivityIndicator size="large" color="#0B5D47" />
      </View>
    );
  }

  return (
    <VoiceHost>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="change-password" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="taxi-card" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="rating" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="quran" />
        <Stack.Screen name="quran-read" />
        <Stack.Screen name="documentation" />
        <Stack.Screen name="documentation-view" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </VoiceHost>
  );
}
