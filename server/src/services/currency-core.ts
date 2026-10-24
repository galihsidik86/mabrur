// Validasi respons kurs open.er-api.com (murni — bisa dites tanpa jaringan).
// Sumber: https://open.er-api.com (ExchangeRate-API, paket gratis tanpa API key):
// ±160 mata uang, diperbarui sekali sehari, wajib atribusi "Rates By Exchange Rate API".

export interface RatesSnapshot {
  base: string;
  /** 1 unit `base` = rates[KODE] unit KODE. */
  rates: Record<string, number>;
  /** Teks asli sumber (RFC-2822), dipertahankan untuk APK lama. */
  updated: string;
  /** ISO-8601 dari time_last_update_unix; null bila tidak ada. */
  updated_at: string | null;
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

export function parseRatesResponse(json: unknown): RatesSnapshot {
  const body = json as {
    result?: unknown; base_code?: unknown; time_last_update_utc?: unknown;
    time_last_update_unix?: unknown; rates?: unknown;
  } | null;
  if (!body || body.result !== 'success' || typeof body.rates !== 'object' || body.rates === null) {
    throw new Error('Format respons kurs tidak sesuai');
  }

  const rates = Object.fromEntries(
    Object.entries(body.rates as Record<string, unknown>).filter(
      (entry): entry is [string, number] =>
        CURRENCY_CODE.test(entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
    ),
  );
  // IDR wajib ada: field lama sar_to_idr dipakai APK versi sebelumnya.
  if (!rates.IDR) throw new Error('Kurs IDR tidak tersedia');

  return {
    base: typeof body.base_code === 'string' ? body.base_code : 'SAR',
    rates,
    updated: typeof body.time_last_update_utc === 'string' ? body.time_last_update_utc : '',
    updated_at: typeof body.time_last_update_unix === 'number' && Number.isFinite(body.time_last_update_unix)
      ? new Date(body.time_last_update_unix * 1000).toISOString()
      : null,
  };
}
