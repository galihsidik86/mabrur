import { describe, it, expect } from 'vitest';
import { replayTawaf } from '../replay';
import type { Residual } from '../transform';

// Residual KONSTAN NOL (tanpa derau lapangan) = kasus TERBAIK yang mungkin --
// reviewer menunjukkan replayTawaf lama (tepat 7*stepsPerLap=700 langkah,
// TANPA fase diam settle di awal maupun tail di akhir) tetap gagal
// menghasilkan 7 bahkan di sini (predictedRounds: 6), karena TawafTracker
// produksi (kebijakan "tidak pernah dini", sacred-zones-core.ts) butuh
// referensi awal dari rata-rata sirkular 3 sampel pertama DI DALAM band, dan
// putaran ke-k baru dihitung setelah akumulasi sudut >= 360*k -- lintasan
// "mulai dingin langsung berjalan, berhenti tepat di 2520 deg" kehilangan
// langkah rotasi ke referensi tanpa cara memulihkannya. Lihat CLAUDE.md &
// docs/accuracy-test/run.ts §tawafPath (TAWAF_SETTLE=5, TAWAF_TAIL=10) untuk
// pola yang sudah benar di harness utama.
function zeroResiduals(spanMs: number): Residual[] {
  return [
    { t: 0, dE: 0, dN: 0 },
    { t: spanMs, dE: 0, dN: 0 },
  ];
}

describe('replayTawaf — settle & tail (tindak lanjut review koordinat, handoff 04r)', () => {
  it('residual nol (lingkaran ideal) + 7 putaran penuh -> predictedRounds tepat 7 (bukan under-count sistematis ke 6)', () => {
    const result = replayTawaf(zeroResiduals(800 * 3000));
    expect(result.predictedRounds).toBe(7);
    expect(result.exact).toBe(true);
  });

  it('tidak overshoot ke 8 akibat tail berlebih', () => {
    const result = replayTawaf(zeroResiduals(800 * 3000));
    expect(result.predictedRounds).not.toBe(8);
  });
});
