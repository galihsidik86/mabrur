// Petunjuk hemat baterai per merek HP (Permintaan 9): beberapa merek Android menahan
// notifikasi saat aplikasi ditutup. Modul murni tanpa impor Expo — dites dari server/tests.

export type BatteryBrand = 'xiaomi' | 'oppo' | 'vivo' | 'samsung' | 'huawei' | 'generic';

// Merek turunan memakai antarmuka pengaturan induknya (MIUI/HyperOS, ColorOS, Funtouch, EMUI).
const BRAND_ALIASES: ReadonlyArray<[BatteryBrand, readonly string[]]> = [
  ['xiaomi', ['xiaomi', 'redmi', 'poco']],
  ['oppo', ['oppo', 'realme', 'oneplus']],
  ['vivo', ['vivo', 'iqoo']],
  ['samsung', ['samsung']],
  ['huawei', ['huawei', 'honor']],
];

/** Merek dari Device.manufacturer / Device.brand (boleh null atau huruf campur). */
export function batteryBrandOf(...names: Array<string | null | undefined>): BatteryBrand {
  for (const raw of names) {
    const name = raw?.trim().toLowerCase();
    if (!name) continue;
    const hit = BRAND_ALIASES.find(([, aliases]) => aliases.some((a) => name.includes(a)));
    if (hit) return hit[0];
  }
  return 'generic';
}

/** Kunci teks bahasa langkah-langkah untuk merek tersebut. */
export function batteryStepsKey(brand: BatteryBrand): `battery.steps.${BatteryBrand}` {
  return `battery.steps.${brand}`;
}
