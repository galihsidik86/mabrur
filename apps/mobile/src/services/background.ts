import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { sendLocalNotification } from './notification';

const TASK_NAME = 'mabrur-background-location';
const WARNING_DISTANCE = 3000;
const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 menit

let lastWarnTime = 0;

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
      const km = (minDist / 1000).toFixed(1).replace('.', ',');
      await sendLocalNotification(
        'Pakai ihram sekarang!',
        `Kamu ${km} km dari batas miqat ${nearestName}. Berihram & niat sebelum melewati garis.`,
      );
    }
  }

  // Send location to server (best effort)
  try {
    const token = await SecureStore.getItemAsync('access_token');
    const apiUrl = await SecureStore.getItemAsync('api_url');
    if (token && apiUrl) {
      fetch(`${apiUrl}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat,
          lng,
          accuracy: loc.coords.accuracy,
        }),
      }).catch(() => {});
    }
  } catch {}
});

export async function startBackgroundLocation(): Promise<boolean> {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return false;

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') return false;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (isRunning) return true;

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: 100,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Mabrur',
        notificationBody: 'Memantau lokasi untuk peringatan miqat',
        notificationColor: '#8B2E2E',
      },
    });

    return true;
  } catch (err) {
    console.warn('[BG] Gagal start background location:', err);
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  } catch {}
}
