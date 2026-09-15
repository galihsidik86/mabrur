// Algoritma geospasial murni untuk deteksi ritual — TANPA dependensi Expo/native.
// Dipisah dari sacred-zones.ts agar dapat diimpor langsung oleh harness pengujian
// (docs/accuracy-test/) tanpa modul native. sacred-zones.ts me-re-export semuanya,
// sehingga permukaan modul bagi aplikasi tidak berubah.

// ==================== SACRED COORDINATES ====================
// Revisi 2026-09-15: koordinat diganti dari perkiraan tanpa sumber ke titik
// OSM konkret (node/way, id tercantum per baris). © OpenStreetMap
// contributors, ODbL; diakses 2026-09-15. Metodologi & sumber lengkap:
// .orkestra/runs/20260915-1900-lanjutan-lokasi-pustaka-apk/handoffs/01-research-scout-koordinat.md

export const KAABAH = { lat: 21.4225172, lng: 39.8261942 }; // centroid way 103914569 (5 titik sudut)
export const HAJAR_ASWAD = { lat: 21.4224985, lng: 39.8262546 }; // node 1199442721 "Black Stone" — TIDAK dipakai TawafTracker (lihat komentar di bawah)

export const SAFA = { lat: 21.4217996, lng: 39.8274307 }; // node 4589923995, natural=peak "الصفا"
export const MARWAH = { lat: 21.4251754, lng: 39.8271276 }; // node 4589923996, natural=peak "المروة"

// ==================== ARAFAH BOUNDARY ====================
// Padang Arafah: area wukuf yang sah.
// Sumber: poligon komunitas OSM (landuse=religious, Plain of Arafat,
// wikidata Q16912386), way 1377422823, v7 — bukan batas resmi pemerintah;
// © OpenStreetMap contributors, ODbL; diakses 2026-09-15. Divalidasi tidak
// langsung terhadap fatwa Masjid Namirah (islamweb.net #193141) — lihat
// handoff 01 di atas §Q1/Q2 untuk pengujian silang lengkap.

export const ARAFAH_CENTER = { lat: 21.3547998, lng: 39.9841015 }; // Jabal Rahmah, natural=peak (OSM/Nominatim)
export const ARAFAH_BOUNDARY: Array<{ lat: number; lng: number }> = [
  { lat: 21.3695977, lng: 39.9773800 },
  { lat: 21.3761499, lng: 39.9826889 },
  { lat: 21.3782040, lng: 39.9852638 },
  { lat: 21.3793226, lng: 39.9866656 },
  { lat: 21.3771534, lng: 39.9899693 },
  { lat: 21.3763054, lng: 39.9912909 },
  { lat: 21.3674582, lng: 39.9905980 },
  { lat: 21.3649751, lng: 39.9898635 },
  { lat: 21.3653071, lng: 39.9881482 },
  { lat: 21.3645777, lng: 39.9872851 },
  { lat: 21.3623821, lng: 39.9871238 },
  { lat: 21.3610123, lng: 39.9882060 },
  { lat: 21.3579478, lng: 39.9928825 },
  { lat: 21.3563638, lng: 39.9942318 },
  { lat: 21.3546853, lng: 39.9951724 },
  { lat: 21.3495338, lng: 39.9965037 },
  { lat: 21.3472738, lng: 39.9969318 },
  { lat: 21.3459372, lng: 39.9970903 },
  { lat: 21.3444054, lng: 39.9970858 },
  { lat: 21.3418877, lng: 39.9963221 },
  { lat: 21.3404027, lng: 39.9955882 },
  { lat: 21.3392462, lng: 39.9947035 },
  { lat: 21.3382420, lng: 39.9936124 },
  { lat: 21.3367177, lng: 39.9911417 },
  { lat: 21.3363585, lng: 39.9901304 },
  { lat: 21.3353732, lng: 39.9835979 },
  { lat: 21.3357169, lng: 39.9811298 },
  { lat: 21.3343626, lng: 39.9762420 },
  { lat: 21.3343495, lng: 39.9735835 },
  { lat: 21.3331892, lng: 39.9703003 },
  { lat: 21.3351444, lng: 39.9666153 },
  { lat: 21.3456610, lng: 39.9561698 },
  { lat: 21.3500997, lng: 39.9609418 },
  { lat: 21.3523336, lng: 39.9642624 },
  { lat: 21.3540982, lng: 39.9680279 },
  { lat: 21.3591488, lng: 39.9735006 },
];

// Masjid Namirah: sebagian di dalam Arafah (sisi timur/belakang), sebagian
// di luar (sisi barat/mihrab, di Wadi Uranah) — dikonfirmasi fatwa
// islamweb.net #193141 (mengutip Ibn Al-Qayyim, Ibn Taymiyyah, dll.) DAN
// pengujian geometris independen terhadap poligon di atas (handoff 01 §Q2).
// NAMIRAH_MOSQUE_CENTER = centroid aritmetika 51 titik jejak bangunan OSM
// way 112317307; © OpenStreetMap contributors, ODbL; diakses 2026-09-15.
export const NAMIRAH_MOSQUE_CENTER = { lat: 21.3532148, lng: 39.9658102 };
// Jarak ke TEPI poligon Arafah untuk memicu peringatan (lihat checkArafahPosition).
export const NAMIRAH_WARNING_RADIUS = 200; // meter
// Radius di sekitar NAMIRAH_MOSQUE_CENTER yang membatasi peringatan hanya ke
// tepi poligon DEKAT masjid — mencegah peringatan salah-pasang di tepi
// poligon lain yang jauh dari Namirah (revisi 2026-09-15, ganti model lama
// "1 titik NAMIRAH_BOUNDARY salah lokasi ±1.491 m" + lingkaran).
const NAMIRAH_PROXIMITY_RADIUS = 1000; // meter

// ==================== ARAFAH ZONE DETECTION ====================

export function isPointInPolygon(
  lat: number, lng: number,
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Konversi meter<->derajat (sama dgn docs/accuracy-test/sim-core.ts) — dipakai
// HANYA oleh distanceToPolygonBoundaryMeters di bawah (proyeksi planar lokal).
const M_PER_DEG_LAT = 111320;
function mPerDegLngLocal(lat: number): number { return 111320 * Math.cos((lat * Math.PI) / 180); }

// Jarak titik ke TEPI poligon terdekat (meter), proyeksi planar East/North
// berpusat di titik uji — akurat untuk skala poligon Arafah (~5 km), sama
// pendekatan dgn kurva batas di docs/accuracy-test/experiments/analytic.ts.
// Dipakai HANYA untuk logika peringatan Namirah (bukan untuk in/out — itu
// tetap ray casting isPointInPolygon di atas).
function distanceToPolygonBoundaryMeters(
  lat: number, lng: number,
  polygon: Array<{ lat: number; lng: number }>,
): number {
  const kLng = mPerDegLngLocal(lat);
  const toEN = (p: { lat: number; lng: number }) => ({
    e: (p.lng - lng) * kLng,
    n: (p.lat - lat) * M_PER_DEG_LAT,
  });
  let min = Infinity;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = toEN(polygon[j]), b = toEN(polygon[i]);
    const dx = b.e - a.e, dy = b.n - a.n;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : (-a.e * dx - a.n * dy) / lenSq; // proyeksi titik uji (0,0) ke segmen
    t = Math.max(0, Math.min(1, t));
    const cx = a.e + t * dx, cy = a.n + t * dy;
    const d = Math.hypot(cx, cy);
    if (d < min) min = d;
  }
  return min;
}

export type ArafahStatus =
  | 'inside'         // di dalam Arafah — wukuf sah
  | 'outside'        // di luar Arafah — wukuf TIDAK sah
  | 'namirah_danger' // dekat Masjid Namirah (batas rawan)
  | 'unknown';       // belum ada GPS

export interface ArafahResult {
  status: ArafahStatus;
  distToCenter: number;       // meter ke Jabal Rahmah
  distToNamirah: number;      // meter ke Masjid Namirah (NAMIRAH_MOSQUE_CENTER)
  message: string;
}

export function checkArafahPosition(lat: number, lng: number): ArafahResult {
  const distToCenter = distanceMetersExport(lat, lng, ARAFAH_CENTER.lat, ARAFAH_CENTER.lng);
  const distToNamirah = distanceMetersExport(lat, lng, NAMIRAH_MOSQUE_CENTER.lat, NAMIRAH_MOSQUE_CENTER.lng);
  const inArafah = isPointInPolygon(lat, lng, ARAFAH_BOUNDARY);

  if (!inArafah) {
    return {
      status: 'outside',
      distToCenter,
      distToNamirah,
      message: 'PERINGATAN: Kamu di LUAR area Arafah! Wukuf di luar Arafah tidak sah. Segera masuk ke area Arafah.',
    };
  }

  // Peringatan Namirah: HANYA saat dekat TEPI poligon (≤200 m) DAN dekat
  // Masjid Namirah itu sendiri (≤1.000 m dari NAMIRAH_MOSQUE_CENTER) — kedua
  // syarat mencegah peringatan salah-pasang di tepi poligon lain yang jauh
  // dari Namirah (revisi 2026-09-15, lihat komentar NAMIRAH_* di atas).
  const distToBoundary = distanceToPolygonBoundaryMeters(lat, lng, ARAFAH_BOUNDARY);
  const nearNamirah = distToBoundary <= NAMIRAH_WARNING_RADIUS && distToNamirah <= NAMIRAH_PROXIMITY_RADIUS;

  if (nearNamirah) {
    return {
      status: 'namirah_danger',
      distToCenter,
      distToNamirah,
      message: 'HATI-HATI: Kamu dekat batas Masjid Namirah. Sebagian masjid ini di LUAR Arafah. Pastikan posisimu di sisi timur masjid.',
    };
  }

  return {
    status: 'inside',
    distToCenter,
    distToNamirah,
    message: 'Kamu di DALAM area Arafah. Wukuf sah. Perbanyak doa dan dzikir.',
  };
}

// Export distance function for Arafah
export function distanceMetersExport(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceMeters(lat1, lng1, lat2, lng2);
}

// Revisi 2026-09-15: koordinat lama urutannya TERBALIK (Aqabah app punya
// bujur PALING TIMUR, seharusnya PALING BARAT/terdekat Makkah). Diganti node
// OSM historic=monument (lokasi historis, bukan dinding fisik aktual di
// jembatan bertingkat saat ini — belum ada sumber terbuka untuk itu, lihat
// handoff 01 §Q3 "Pertanyaan untuk user" no. 1). © OpenStreetMap
// contributors, ODbL; diakses 2026-09-15.
export const JAMARAT = {
  ula: { lat: 21.4199079, lng: 39.8741791, name: 'Jamarat Ula (Kecil)' }, // node 4144223248
  wustha: { lat: 21.4207404, lng: 39.8729996, name: 'Jamarat Wustha (Tengah)' }, // node 4144223249
  aqabah: { lat: 21.4216493, lng: 39.8709424, name: 'Jamarat Aqabah (Besar)' }, // node 4144223250, paling dekat Makkah
};

// ==================== DISTANCE HELPER ====================

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==================== TAWAF AUTO COUNTER ====================
// Menghitung putaran via AKUMULASI SUDUT KUMULATIF (bukan persilangan garis).
//
// Revisi 2026-09-14 (bug kritis, superseded di bawah): skema lama mendeteksi
// "putaran" saat sudut melintasi 0° dari rentang (0°,90°) ke (-90°,0°) — itu
// SEARAH JARUM JAM (CW). Tawaf yang sah harus BERLAWANAN jarum jam (CCW,
// Ka'bah di sisi kiri jamaah). Terbukti dengan lintasan sintetis: 7 putaran
// CCW penuh (r=25 m) → 0 pada skema lama; 7 putaran CW (arah SALAH) → 7.
// Diperbaiki dengan akumulasi sudut ter-unwrap (masih berlaku, lihat di bawah).
//
// Revisi 2026-09-15 (kebijakan "TIDAK PERNAH DINI"): revisi 2026-09-14 di atas
// memakai `ROUND_TOL_DEG=60°` (toleransi NEGATIF — putaran diaanggap selesai
// 60° SEBELUM 360k tercapai) untuk menyerap derau. Review independen
// (handoff 05v) menemukan ini membuat aplikasi mengumumkan "putaran selesai"
// rata-rata ~30 m busur (p50), hingga ~41 m (p95) SEBELUM jamaah benar-benar
// menyelesaikan putaran — ~19% dari satu putaran penuh (r=25 m) — berisiko
// fikih (jamaah berhenti sebelum genap 7 putaran). Kebijakan baru: TIDAK ADA
// toleransi positif terhadap 360k; setiap putaran ke-k HANYA diakui setelah
// estimasi posisi benar-benar melewati 360k° (margin ≥ 0, default 0 — lihat
// EPS_DEG di bawah untuk alasan non-desain kenapa ada epsilon sangat kecil).
//
// Sifat berteleskop (masih berlaku dari revisi sebelumnya): jumlah delta
// ter-unwrap tiap sampel, cumAngle += wrap(θ_k − θ_{k−1}, (−180°,180°]),
// menjamin cumAngle (tanpa derau) = θ_akhir − θ_awal + 360°×n — galat HANYA
// dari derau di titik AWAL (referensi) & titik AKHIR (sampel terkini) tiap
// evaluasi, titik-titik antara saling meniadakan.
//
// Dua mekanisme bias-ke-belakang (SELALU memperlambat, TIDAK PERNAH
// mempercepat pemicuan) dipasang di kedua titik lemah tsb, sesuai arahan
// desain (dievaluasi numerik, parameter dipilih berbasis data — lihat
// docs/laporan-logika-perhitungan.md §3 utk tabel lengkap):
//
// 1. REFERENSI AWAL (titik lemah #1): alih-alih memakai SATU sampel pertama
//    (bising) sebagai titik nol, buffer REF_SAMPLES=3 sampel pertama setelah
//    memasuki band (atau setelah sesi terputus, lihat #3) dan pakai RATA-RATA
//    SIRKULAR-nya sebagai referensi. Karena ketiga sampel ini diambil SAAT
//    jamaah SUDAH berjalan (yaitu SETELAH titik mulai sebenarnya), rata-rata
//    ini sedikit condong ke ARAH JALAN dari titik mulai — referensi jadi
//    "terlalu maju", sehingga SEMUA delta berikutnya (θ_sekarang − referensi)
//    sedikit UNDER-ESTIMATE rotasi total → pemicuan lebih lambat (aman).
//    Konsekuensi: ~1 langkah rotasi di awal sesi "hilang" (tidak dihitung) —
//    dampak dapat diabaikan (~3,6°/700 dari 7 putaran) dan SENGAJA dipilih
//    demi keamanan, bukan bug.
// 2. TIDAK ada toleransi negatif (lihat di atas) — bestCum (rekor tertinggi
//    cumAngle, monoton naik) harus mencapai 360k SEBELUM putaran ke-k diakui.
//    Evaluasi numerik (300+ percobaan/sel, seed=42, r∈{25,60}, σ∈{0,3,5,10,15},
//    skenario "diam di garis selesai" & "lanjut 30° lalu berhenti") menunjukkan
//    desain ini TIDAK PERNAH dini pada σ=0 (deviasi 0 m, bukan mendekati nol)
//    dan mempertahankan proporsi tepat-7 ≥95% pada σ=5 (target wajib proyek)
//    untuk r=25 & r=60, mode default & adaptif — dengan p95 pemicuan-dini
//    aktual ~7–11 m (LEBIH BESAR dari target aspirasional ≤5 m di awal
//    perencanaan — dikonfirmasi TIDAK TERCAPAI oleh evaluasi berbasis data:
//    skema jendela-rata-rata K-sampel & margin positif keduanya dicoba, tapi
//    keduanya menukar sebagian besar keuntungan p95 dengan penurunan tajam
//    proporsi tepat-7 karena jendela "ekor" 30 dtk pasca-selesai terlalu
//    pendek untuk konvergensi rata-rata; ≥95% tepat-7 diprioritaskan karena
//    itu satu-satunya target yang wajib/asersi. Lihat handoff TDD 05c &
//    docs/laporan-logika-perhitungan.md §3 utk tabel lengkap dan diskusi.).
// 3. SESI TERPUTUS / KELUAR-MASUK BAND (titik lemah tersembunyi, temuan M2
//    review 05v): sebelumnya, keluar band membekukan `prevAngle` tanpa
//    mencatat durasi; saat masuk kembali, delta besar (rotasi riil yang
//    terjadi selagi di luar band) DIPOTONG diam-diam oleh MAX_STEP_DEG,
//    menyebabkan kurang-hitung tanpa sinyal ke pengguna. Sekarang durasi
//    keluar-band eksplisit dilacak (`zoneExitAt`, pakai parameter `now`):
//      - keluar ≤ MAX_GAP_SEC (90 dtk): dianggap jeda SEMENTARA dalam sesi
//        yang sama (mis. terdorong kerumunan) — delta dihitung UTUH via
//        unwrap (−180°,180°] TANPA potongan MAX_STEP_DEG (rotasi hingga
//        hampir 180° selagi di luar band tetap terhitung benar; unwrap
//        sendiri sudah membatasi ambiguitas ke ≤180°, jadi aman tanpa guard
//        tambahan untuk jeda sependek ini).
//      - keluar > MAX_GAP_SEC: dianggap SESI TERPUTUS — `prevAngle` DIRESET
//        (referensi diambil ulang via REF_SAMPLES seperti mulai baru) TANPA
//        menambah rotasi apa pun dari jeda tsb ke cumAngle/bestCum/rounds.
//        Konsekuensi: rotasi yang benar-benar terjadi selama sesi terputus
//        TIDAK dihitung (kurang-hitung yang disengaja, aman secara fikih —
//        lebih baik jamaah diminta menambah putaran daripada diberi tahu
//        selesai padahal belum).
//
// Penolakan outlier per-langkah (MAX_STEP_DEG, guard lama, TETAP dipakai
// tapi HANYA saat sampling kontinu dalam band — lihat #3 di atas): nominal
// ~3,6°/langkah (100 langkah/putaran @ 300 dtk/putaran); lompatan lebih besar
// (spike GPS, titik dekat pusat) DIPOTONG agar arah tetap terekam & pelacakan
// tidak macet, tanpa membuat galat unwrap satu langkah mendekati 360°.
//
// Debounce waktu (MIN_INTERVAL dari skema garis lama) TETAP TIDAK DIPAKAI:
// skema kumulatif tak punya "garis" yang bisa dilewati berulang kali secara
// jitter — rounds hanya naik saat bestCum (monoton) melewati ambang 360k.
//
// Desain ini TIDAK bergantung pada azimuth garis Hajar Aswad — hanya rotasi
// total yang dihitung, bebas dari asumsi arah garis riil.

export interface TawafConfig {
  minRadius?: number;      // default 10 m — di bawah ini = di dalam/di atas Ka'bah/noise
  maxRadius?: number;      // default 80 m — dipakai HANYA pada mode non-adaptif
  adaptive?: boolean;      // default false — true = band menyesuaikan radius edar (multi-lantai)
  hardMaxRadius?: number;  // default 300 m — batas absolut mode adaptif (luar mataf)
}

export class TawafTracker {
  private prevAngle: number | null = null;
  private cumAngle = 0;  // rotasi kumulatif ter-unwrap (derajat); + = CCW
  private bestCum = 0;   // rekor tertinggi cumAngle yang pernah dicapai (monoton naik)
  private rounds = 0;
  onChange: ((rounds: number) => void) | null = null;

  // Jumlah sampel awal (setelah masuk band, atau setelah sesi terputus) yang
  // di-rata-rata sirkular untuk membentuk referensi sudut — lihat catatan
  // desain di atas (#1). Dipilih empiris (M=3): cukup untuk memberi bias
  // aman-ke-belakang tanpa kehilangan rotasi awal yang signifikan.
  private static readonly REF_SAMPLES = 3;
  // Penolakan outlier per-langkah (lihat catatan desain di atas, guard lama).
  private static readonly MAX_STEP_DEG = 150;
  // Ambang sesi terputus akibat keluar band (lihat #3). 90 dtk dipilih agar
  // nyaman menaungi jeda realistis (terdorong kerumunan 20–40 dtk, target uji
  // M2/T4) namun tetap cukup ketat untuk tidak mempercayai delta besar dari
  // jeda yang benar-benar panjang (jamaah pergi lama lalu kembali).
  private static readonly MAX_GAP_SEC = 90;
  // Toleransi presisi floating-point MURNI (bukan toleransi "dini" by design)
  // — akumulasi ratusan penjumlahan derajat via atan2(lat/lng) bisa berhenti
  // ~1e-9° di bawah ambang tepat akibat pembulatan biner; epsilon ini jauh
  // di bawah presisi GPS mana pun (≈4×10⁻¹⁰ m pada r=25 m) sehingga TIDAK
  // melanggar kebijakan "tidak pernah dini" secara praktis.
  private static readonly EPS_DEG = 1e-6;

  // --- mode adaptif: jendela jarak terakhir untuk mendeteksi "sedang mengedar" ---
  private readonly cfg: Required<TawafConfig>;
  private dists: number[] = [];
  private readonly WIN = 15; // ~45 dtk pada sampling 3 dtk
  private lastRadius = 0;    // radius edar terestimasi (median), untuk UI

  // --- akuisisi referensi (#1) & pelacakan sesi/jeda band (#3) ---
  private refBuffer: number[] = [];
  private zoneExitAt: number | null = null; // waktu (ms) pertama kali keluar band sejak referensi terakhir; null = sedang di dalam band / belum pernah mulai

  constructor(cfg: TawafConfig = {}) {
    this.cfg = {
      minRadius: cfg.minRadius ?? 10,
      maxRadius: cfg.maxRadius ?? 80,
      adaptive: cfg.adaptive ?? false,
      hardMaxRadius: cfg.hardMaxRadius ?? 300,
    };
  }

  private getAngle(lat: number, lng: number): number {
    // Sudut matematis dari pusat Ka'bah, 0° = timur. NAIK = berlawanan jarum
    // jam (CCW) — konvensi atan2(utara, timur) standar. Angka mentah ini
    // tidak diasumsikan sejajar garis Hajar Aswad; hanya SELISIHNYA antar
    // sampel yang dipakai (lihat update()), sehingga pilihan 0°=timur murni
    // tidak memengaruhi hasil hitung putaran.
    const dLat = lat - KAABAH.lat;
    const dLng = lng - KAABAH.lng;
    return Math.atan2(dLat, dLng) * (180 / Math.PI); // -180 s.d. 180
  }

  // Rata-rata sirkular (bukan aritmetika biasa — sudut wrap di ±180°).
  private static circularMeanDeg(anglesDeg: number[]): number {
    let sx = 0, sy = 0;
    for (const a of anglesDeg) {
      const rad = (a * Math.PI) / 180;
      sx += Math.cos(rad);
      sy += Math.sin(rad);
    }
    return Math.atan2(sy, sx) * (180 / Math.PI);
  }

  /**
   * Apakah titik ini dianggap "sedang tawaf"?
   * - Non-adaptif (default, dipakai pengujian/jurnal): band tetap 10–80 m.
   * - Adaptif: radius mengikuti median jarak terakhir (lantai berapa pun),
   *   dengan syarat radius STABIL (varians kecil = mengedar, bukan berjalan lurus).
   */
  private inTawafZone(dist: number): boolean {
    if (!this.cfg.adaptive) {
      return dist >= this.cfg.minRadius && dist <= this.cfg.maxRadius;
    }
    if (dist < this.cfg.minRadius || dist > this.cfg.hardMaxRadius) return false;

    this.dists.push(dist);
    if (this.dists.length > this.WIN) this.dists.shift();

    // Warm-up: sebelum jendela penuh, terima agar pelacakan sudut mulai berjalan.
    if (this.dists.length < this.WIN) { this.lastRadius = dist; return true; }

    const sorted = [...this.dists].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = this.dists.reduce((a, b) => a + b, 0) / this.dists.length;
    const std = Math.sqrt(this.dists.reduce((a, b) => a + (b - mean) ** 2, 0) / this.dists.length);
    this.lastRadius = median;

    const stable = std < Math.max(10, 0.4 * median); // radius ~konstan → mengedar
    const inBand = dist >= median * 0.5 && dist <= median * 1.7;
    return stable && inBand;
  }

  // Mulai (atau mulai ulang setelah sesi terputus) akuisisi referensi sudut
  // dengan buffer REF_SAMPLES sampel + rata-rata sirkular (#1 di atas).
  private feedReferenceBuffer(angle: number): void {
    this.refBuffer.push(angle);
    if (this.refBuffer.length >= TawafTracker.REF_SAMPLES) {
      this.prevAngle = TawafTracker.circularMeanDeg(this.refBuffer);
      this.refBuffer = [];
    }
  }

  // `now` dipakai untuk mengukur durasi keluar-band (#3) — default Date.now()
  // agar kompatibel dengan pemanggil lama yang tak menyertakannya (mis.
  // apps/mobile/app/tools.tsx). Tidak lagi dipakai untuk debounce jitter
  // (lihat catatan desain di atas — skema kumulatif tak membutuhkannya).
  update(lat: number, lng: number, now: number = Date.now()): void {
    const dist = distanceMeters(lat, lng, KAABAH.lat, KAABAH.lng);
    const inZone = this.inTawafZone(dist);

    if (!inZone) {
      // Catat SAAT PERTAMA KALI keluar band sejak referensi terakhir (bukan
      // setiap sampel di luar band — agar durasi jeda terukur dari awal jeda,
      // bukan dari sampel terakhir sebelum kembali).
      if (this.prevAngle !== null && this.zoneExitAt === null) {
        this.zoneExitAt = now;
      }
      return;
    }

    const angle = this.getAngle(lat, lng);

    if (this.prevAngle === null) {
      this.feedReferenceBuffer(angle); // mulai sesi (cold start / setelah reset())
      return;
    }

    let skipStepClip = false;
    if (this.zoneExitAt !== null) {
      const gapSec = (now - this.zoneExitAt) / 1000;
      this.zoneExitAt = null;
      if (gapSec > TawafTracker.MAX_GAP_SEC) {
        // Sesi terputus (#3): ambil ulang referensi, JANGAN tambah rotasi
        // apa pun dari jeda yang tak diketahui ini ke cumAngle/bestCum.
        this.prevAngle = null;
        this.refBuffer = [];
        this.feedReferenceBuffer(angle);
        return;
      }
      // Jeda pendek (band-exit sementara): percayai unwrap penuh (≤180°)
      // tanpa potongan MAX_STEP_DEG — lihat #3.
      skipStepClip = true;
    }

    let delta = angle - this.prevAngle;
    delta = ((delta + 180) % 360 + 360) % 360 - 180; // unwrap ke (-180°,180°]
    if (!skipStepClip && Math.abs(delta) > TawafTracker.MAX_STEP_DEG) {
      delta = Math.sign(delta) * TawafTracker.MAX_STEP_DEG; // potong outlier
    }

    this.cumAngle += delta;
    this.prevAngle = angle;
    if (this.cumAngle > this.bestCum) this.bestCum = this.cumAngle;

    // margin = 0 (kebijakan "tidak pernah dini"); EPS_DEG murni presisi float.
    const newRounds = Math.max(0, Math.floor((this.bestCum + TawafTracker.EPS_DEG) / 360));
    if (newRounds > this.rounds) {
      this.rounds = newRounds;
      this.onChange?.(this.rounds);
    }
  }

  getRounds(): number { return this.rounds; }
  getRadius(): number { return Math.round(this.lastRadius); } // radius edar terestimasi (m), untuk UI
  reset(): void {
    this.rounds = 0;
    this.prevAngle = null;
    this.cumAngle = 0;
    this.bestCum = 0;
    this.dists = [];
    this.lastRadius = 0;
    this.refBuffer = [];
    this.zoneExitAt = null;
  }
}

// ==================== SAI AUTO COUNTER ====================
// Track alternation between Safa and Marwah zones.

export type SaiZone = 'safa' | 'marwah' | 'between';

export class SaiTracker {
  private lastZone: SaiZone = 'between';
  private legs = 0;
  private started = false;
  private readonly ZONE_RADIUS = 25; // meters
  onChange: ((legs: number, zone: SaiZone) => void) | null = null;

  private detectZone(lat: number, lng: number): SaiZone {
    const dSafa = distanceMeters(lat, lng, SAFA.lat, SAFA.lng);
    const dMarwah = distanceMeters(lat, lng, MARWAH.lat, MARWAH.lng);

    if (dSafa <= this.ZONE_RADIUS) return 'safa';
    if (dMarwah <= this.ZONE_RADIUS) return 'marwah';
    return 'between';
  }

  update(lat: number, lng: number): void {
    const zone = this.detectZone(lat, lng);

    if (zone === 'between') return;
    if (zone === this.lastZone) return;

    // First zone must be Safa (Sa'i starts from Safa)
    if (!this.started) {
      if (zone === 'safa') {
        this.started = true;
        this.lastZone = 'safa';
        this.onChange?.(this.legs, zone);
      }
      return;
    }

    // Alternation detected
    if ((this.lastZone === 'safa' && zone === 'marwah') ||
        (this.lastZone === 'marwah' && zone === 'safa')) {
      this.legs++;
      this.lastZone = zone;
      this.onChange?.(this.legs, zone);
    }
  }

  getLegs(): number { return this.legs; }
  getZone(): SaiZone { return this.lastZone; }
  reset(): void { this.legs = 0; this.lastZone = 'between'; this.started = false; }
}

// ==================== JUMRAH PROXIMITY ====================

export function detectNearestJamarat(lat: number, lng: number): {
  name: string; key: 'ula' | 'wustha' | 'aqabah'; distance: number;
} | null {
  const entries = Object.entries(JAMARAT) as Array<['ula' | 'wustha' | 'aqabah', typeof JAMARAT.ula]>;
  let nearest: { name: string; key: 'ula' | 'wustha' | 'aqabah'; distance: number } | null = null;

  for (const [key, j] of entries) {
    const d = distanceMeters(lat, lng, j.lat, j.lng);
    if (d <= 30 && (!nearest || d < nearest.distance)) {
      nearest = { name: j.name, key, distance: d };
    }
  }

  return nearest;
}
