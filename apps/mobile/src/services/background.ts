import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking, Platform } from 'react-native';
import { sendLocalNotification } from './notification';
import { api } from './api';
import { shouldSendLocation } from './location-sync-core';
import { initLanguage, translate } from './i18n';

const TASK_NAME = 'mabrur-background-location';
const WARNING_DISTANCE = 3000;
const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 menit

let lastWarnTime = 0;
// Kiriman lokasi terakhir yang berhasil (hilang bila proses task dimulai ulang -> kirim segera).
let lastSent: { lat: number; lng: number; at: number } | null = null;

function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Miqat coordinates (hardcoded for background reliability)
const MIQAT_ZONES = [
  { name: 'Dzulhulaifah (Bir Ali)', lat: 24.4097, lng: 39.5433 },
  { name: 'Al-Juhfah (Rabigh)', lat: 22.7267, lng: 39.0778 },
  { name: 'Qarnul Manazil', lat: 21.6219, lng: 40.4344 },
  { name: 'Yalamlam', lat: 20.5489, lng: 39.8733 },
  { name: 'Dhat Irq', lat: 21.9269, lng: 40.4161 },
];

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[BG] Background location error:', error);
    return;
  }

  const locations = data?.locations as Location.LocationObject[] | undefined;
  if (!locations || locations.length === 0) return;

  const loc = locations[locations.length - 1];
  const lat = loc.coords.latitude;
  const lng = loc.coords.longitude;

  // Find nearest miqat
  let nearestName = '';
  let minDist = Infinity;
  for (const m of MIQAT_ZONES) {
    const d = haversine(lat, lng, m.lat, m.lng);
    if (d < minDist) {
      minDist = d;
      nearestName = m.name;
    }
  }

  // Check if should warn
  if (minDist <= WARNING_DISTANCE) {
    const now = Date.now();
    if (now - lastWarnTime > NOTIFICATION_COOLDOWN) {
      lastWarnTime = now;
      // Task bisa berjalan headless (tanpa UI) -> muat pilihan bahasa dulu.
      await initLanguage();
      const km = (minDist / 1000).toFixed(1).replace('.', translate('number.decimal_sep'));
      await sendLocalNotification(
        translate('miqat.notif_title'),
        translate('miqat.notif_body', { km, miqat: nearestName }),
      );
    }
  }

  // Kirim ke server: segera bila bergerak, heartbeat tiap beberapa menit bila diam.
  // Lewat api.sendLocation agar access token (berlaku 15 menit) di-refresh otomatis —
  // sebelumnya fetch mentah di sini ditolak 401 setelah app 15 menit di latar belakang,
  // sehingga jamaah tampil "Belum ada lokasi"/tidak terpantau di aplikasi muthawwif.
  const now = Date.now();
  const since = lastSent
    ? { movedMeters: haversine(lastSent.lat, lastSent.lng, lat, lng), msSinceLastSend: now - lastSent.at }
    : null;
  if (!shouldSendLocation(since)) return;
  try {
    if (!(await SecureStore.getItemAsync('refresh_token'))) { lastSent = null; return; } // sudah logout
    await api.sendLocation(lat, lng, loc.coords.accuracy ?? undefined);
    lastSent = { lat, lng, at: now };
  } catch {
    // Offline/gagal: coba lagi di update berikutnya (lastSent tidak diubah).
  }
});

export type LocationSharingResult = 'ok' | 'declined' | 'denied' | 'gps_off' | 'error';

function confirmLocationSharing(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      translate('loc.consent_title'),
      `${translate('loc.consent_body')}\n\n${translate('loc.consent_hint')}`,
      [
        { text: translate('loc.later'), style: 'cancel', onPress: () => resolve(false) },
        { text: translate('loc.continue'), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Mulai berbagi lokasi di latar belakang.
 * interactive=true: boleh menampilkan penjelasan & meminta izin (saat login / ketuk pengingat).
 * interactive=false: hanya (re)start bila izin sudah ada — aman dipanggil tiap app aktif.
 */
export async function startBackgroundLocation(interactive = true): Promise<LocationSharingResult> {
  try {
    let bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) {
      if (!interactive) return 'denied';
      if (!(await confirmLocationSharing())) return 'declined';
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) return 'denied';
      bg = await Location.requestBackgroundPermissionsAsync();
      if (!bg.granted) return 'denied';
    }

    if (!(await Location.hasServicesEnabledAsync())) return 'gps_off';

    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (isRunning) return 'ok';

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      // Android: update tiap ~1 menit walau diam (heartbeat diatur shouldSendLocation).
      // iOS mengabaikan timeInterval; distanceInterval kecil agar tetap mengalir saat berjalan.
      timeInterval: 60000,
      distanceInterval: Platform.OS === 'android' ? 0 : 25,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Mabrur',
        notificationBody: translate('loc.service_body'),
        notificationColor: '#0B5D47',
      },
    });

    return 'ok';
  } catch (err) {
    console.warn('[BG] Gagal start background location:', err);
    return 'error';
  }
}

/** Dipanggil saat jamaah mengetuk pengingat dari muthawwif: aktifkan + pandu bila gagal. */
export async function promptLocationSharing(): Promise<LocationSharingResult> {
  const result = await startBackgroundLocation(true);
  if (result === 'denied') {
    Alert.alert(
      translate('loc.denied_title'),
      translate('loc.denied_body'),
      [{ text: translate('loc.later'), style: 'cancel' }, { text: translate('loc.open_settings'), onPress: () => { Linking.openSettings(); } }],
    );
  } else if (result === 'gps_off') {
    try {
      await Location.enableNetworkProviderAsync(); // Android: dialog sistem "nyalakan lokasi"
      return startBackgroundLocation(false);
    } catch {
      Alert.alert(translate('loc.gps_off_title'), translate('loc.gps_off_body'));
    }
  } else if (result === 'ok') {
    Alert.alert(translate('loc.active_title'), translate('loc.active_body'));
  }
  return result;
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  } catch {}
}
