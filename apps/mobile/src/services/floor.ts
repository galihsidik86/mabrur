// Deteksi lantai via barometer ponsel (expo-sensors). Best-effort: tidak semua
// perangkat punya barometer, dan tekanan indoor bisa terpengaruh AC — nilai
// bersifat perkiraan untuk info lantai + membantu menyesuaikan band radius tawaf.
import { Barometer } from 'expo-sensors';
import { pressureToAltitude, altitudeToFloor, FloorEstimate } from './floor-core';

export type { FloorEstimate };

export async function isBarometerAvailable(): Promise<boolean> {
  try { return await Barometer.isAvailableAsync(); } catch { return false; }
}

/**
 * Mulai memantau lantai. baseline = tekanan TERTINGGI yang teramati (titik
 * terendah) sehingga ketinggian dihitung relatif terhadap lantai terbawah yang
 * pernah dilewati. Memanggil onFloor setiap ada estimasi baru.
 * Mengembalikan fungsi stop.
 */
export function watchFloor(onFloor: (est: FloorEstimate) => void): { remove: () => void } {
  let baselineP = 0; // hPa tekanan tertinggi (lantai terendah)
  Barometer.setUpdateInterval(2000);
  const sub = Barometer.addListener(({ pressure }) => {
    if (!pressure || pressure <= 0) return;
    if (baselineP === 0 || pressure > baselineP) baselineP = pressure; // titik terendah
    const alt = pressureToAltitude(pressure, baselineP);
    onFloor(altitudeToFloor(alt));
  });
  return { remove: () => sub.remove() };
}
