import * as Location from 'expo-location';

// Seluruh algoritma & konstanta murni berada di sacred-zones-core.ts
// (tanpa dependensi Expo — dapat diimpor harness pengujian di docs/accuracy-test/).
// Re-export di sini menjaga permukaan modul bagi aplikasi tetap sama.
export * from './sacred-zones-core';

// ==================== GPS WATCHER ====================

export function watchSacredLocation(
  callback: (lat: number, lng: number) => void,
): { remove: () => void } {
  let sub: Location.LocationSubscription | null = null;

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 2, // every 2 meters
      timeInterval: 3000,  // every 3 seconds
    },
    (loc) => {
      callback(loc.coords.latitude, loc.coords.longitude);
    },
  ).then((s) => { sub = s; });

  return { remove: () => { sub?.remove(); } };
}
