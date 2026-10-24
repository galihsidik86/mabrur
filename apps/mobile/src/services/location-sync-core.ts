// Aturan kirim lokasi ke server dari task latar belakang (murni — bisa dites dari vitest).

/** Kirim segera bila sudah berpindah sejauh ini sejak kiriman terakhir. */
export const MIN_MOVE_TO_SEND_M = 25;
/** Saat diam, tetap kirim tiap selang ini agar muthawwif tahu jamaah masih terpantau. */
export const HEARTBEAT_MS = 5 * 60 * 1000;

export interface SinceLastSend {
  movedMeters: number;
  msSinceLastSend: number;
}

// null = belum ada kiriman di sesi task ini.
export function shouldSendLocation(since: SinceLastSend | null): boolean {
  if (!since) return true;
  return since.movedMeters >= MIN_MOVE_TO_SEND_M || since.msSinceLastSend >= HEARTBEAT_MS;
}
