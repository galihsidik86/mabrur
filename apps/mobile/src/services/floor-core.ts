// Matematika deteksi lantai dari tekanan barometer — MURNI, tanpa dependensi Expo
// (bisa diuji di node). Dipakai floor.ts yang menangani langganan sensor.

/**
 * Ketinggian (meter) di atas tekanan acuan p0, formula barometrik internasional.
 * p, p0 dalam hPa. Hasil positif bila p < p0 (naik = tekanan turun).
 */
export function pressureToAltitude(p: number, p0: number): number {
  if (p <= 0 || p0 <= 0) return 0;
  return 44330 * (1 - Math.pow(p / p0, 0.190295));
}

export interface FloorEstimate {
  floor: number;   // 0 = lantai dasar (relatif titik terendah yang dikunjungi)
  label: string;
  altitude: number; // meter di atas acuan
}

/**
 * Petakan ketinggian relatif ke perkiraan lantai. Tinggi antar-lantai Masjidil
 * Haram besar (~5,5 m); pakai ambang setengah-lantai agar tak mudah lompat.
 */
export function altitudeToFloor(altM: number, floorHeight = 5.5): FloorEstimate {
  const floor = Math.max(0, Math.round(altM / floorHeight));
  const label =
    floor === 0 ? 'Lantai dasar (mataf)' :
    floor === 1 ? 'Lantai 1' :
    floor === 2 ? 'Lantai 2' :
    floor >= 3 ? 'Atap' : `Lantai ${floor}`;
  return { floor, label, altitude: Math.round(altM * 10) / 10 };
}
