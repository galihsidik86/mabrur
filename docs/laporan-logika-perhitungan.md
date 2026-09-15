# Laporan Logika Perhitungan Sistem Mabrur

**Dokumen Teknis** — Semua formula matematika, konstanta, koordinat, dan algoritma yang digunakan dalam fitur GPS, geofence, tawaf, sa'i, jumrah, dan waktu shalat.

---

## Daftar Isi

1. [Formula Haversine (Jarak GPS)](#1-formula-haversine)
2. [Geofence Miqat & Deteksi Ihram](#2-geofence-miqat)
3. [Pelacakan Tawaf Otomatis](#3-pelacakan-tawaf)
4. [Pelacakan Sa'i Otomatis](#4-pelacakan-sai)
5. [Deteksi Jamarat (Jumrah)](#5-deteksi-jamarat)
6. [Deteksi Posisi Arafah](#6-deteksi-posisi-arafah)
7. [Perhitungan Waktu Shalat](#7-perhitungan-waktu-shalat)
8. [Background GPS & Notifikasi](#8-background-gps)
9. [Referensi Koordinat](#9-referensi-koordinat)
10. [Konstanta Sistem](#10-konstanta-sistem)

---

## 1. Formula Haversine

**File**: `server/src/services/geofence.service.ts:14-23`, `apps/mobile/src/services/location.ts:3-16`

Formula haversine menghitung jarak great-circle antara dua titik di permukaan bumi berdasarkan koordinat lintang dan bujur. Digunakan di seluruh sistem untuk menghitung jarak ke miqat, Ka'bah, Safa, Marwah, dan Jamarat.

### Formula

```
R = 6.371.000 meter (radius bumi)

dLat = (lat2 - lat1) × π / 180
dLng = (lng2 - lng1) × π / 180

a = sin²(dLat/2) + cos(lat1 × π/180) × cos(lat2 × π/180) × sin²(dLng/2)

jarak = R × 2 × atan2(√a, √(1-a))
```

### Implementasi (identik di server dan mobile)

```typescript
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### Format Tampilan Jarak

```typescript
// ≥ 1000m → tampilkan dalam km (1 desimal, koma sebagai pemisah)
// < 1000m → bulatkan ke kelipatan 10 meter
formatDistance(8600)  → "8,6 km"
formatDistance(450)   → "450 m"
```

---

## 2. Geofence Miqat

**File**: `server/src/services/geofence.service.ts:25-51`, `apps/mobile/src/services/background.ts`

### Zona Miqat (5 titik + 1 zona haram)

| Miqat | Lat | Lng | Radius | Warning |
|-------|-----|-----|--------|---------|
| Dzulhulaifah (Bir Ali) | 24.4097 | 39.5433 | 1.000 m | 3.000 m |
| Al-Juhfah (Rabigh) | 22.7267 | 39.0778 | 1.000 m | 3.000 m |
| Qarnul Manazil | 21.6219 | 40.4344 | 1.000 m | 3.000 m |
| Yalamlam | 20.5489 | 39.8733 | 1.000 m | 3.000 m |
| Dhat Irq | 21.9269 | 40.4161 | 1.000 m | 3.000 m |
| **Tanah Haram** | 21.4225 | 39.8262 | 12.000 m | 1.000 m |

### Algoritma Deteksi Miqat Terdekat

```
UNTUK SETIAP zona miqat:
  hitung jarak = haversine(posisi_user, posisi_zona)
  jika jarak < jarak_minimum:
    zona_terdekat = zona ini

HASIL:
  zona_terdekat
  jarak_meter = jarak ke zona terdekat (dibulatkan)
  dalam_peringatan = jarak ≤ 3.000 m (warning_radius)
  dalam_batas = jarak ≤ 1.000 m (radius_meters)
```

### Progress Bar Jarak

```
Skala referensi: 12.000 m (0%) sampai 0 m (100%)
progress = max(0, min(1, 1 - jarak / 12000))
```

### Logika Ihram

```
Status ihram disimpan per user:
  - is_ihram: boolean
  - niat_type: 'umrah' | 'haji'
  - changed_at: timestamp

Toggle ihram:
  JIKA belum ada record → INSERT
  JIKA sudah ada → UPDATE (upsert via onConflict)
```

---

## 3. Pelacakan Tawaf Otomatis

**File**: `apps/mobile/src/services/sacred-zones-core.ts` (algoritma murni, `TawafTracker`), `sacred-zones.ts` (re-export + watcher GPS), `floor-core.ts` + `floor.ts` (deteksi lantai barometer)

### Koordinat Referensi

```
Ka'bah:       21.42251°N, 39.82620°E
Hajar Aswad:  21.42244°N, 39.82631°E (sudut tenggara, titik awal tawaf)
```

### Algoritma

> **Revisi 2026-09-14 (perbaikan bug kritis arah)**: skema lama mendeteksi
> "putaran" saat sudut melintasi 0° dari rentang (0°,90°) ke (−90°,0°) — itu
> **searah jarum jam (CW)**, bukan berlawanan (CCW) seperti disyaratkan tawaf
> yang sah. Dibuktikan dengan lintasan sintetis: 7 putaran CCW penuh (r=25 m)
> menghasilkan **0** pada skema lama; 7 putaran CW (arah salah) menghasilkan
> **7** — persis terbalik. Skema akumulasi rotasi (bukan persilangan satu
> garis tetap) menggantikannya, sehingga otomatis hanya menambah hitungan
> untuk gerak CCW, dan **tidak lagi bergantung pada azimuth garis Hajar
> Aswad**.
>
> **Revisi 2026-09-15 (kebijakan "TIDAK PERNAH DINI")**: revisi 2026-09-14
> memakai `ROUND_TOL_DEG=60°` — toleransi NEGATIF, putaran dianggap selesai
> 60° **SEBELUM** 360k tercapai, untuk menyerap derau. Review independen
> (handoff `05v-code-reviewer-tawaf.md`) menemukan ini membuat aplikasi
> mengumumkan "putaran selesai" rata-rata **~30 m busur (p50), hingga ~41 m
> (p95)** SEBELUM jamaah benar-benar menyelesaikan putaran ke-7 — ~19% dari
> satu putaran penuh (r=25 m), berisiko fikih (jamaah berhenti sebelum genap
> 7 putaran). **`ROUND_TOL_DEG` dihapus** dan diganti dua mekanisme yang
> HANYA memperlambat pemicuan (tidak pernah mempercepatnya) — lihat langkah
> 1 dan 3b di bawah, serta tabel ketahanan derau yang diperbarui.

Tawaf dilakukan **berlawanan arah jarum jam** (counterclockwise) mengelilingi Ka'bah. Sistem mendeteksi putaran dengan menjumlahkan rotasi sudut posisi user relatif terhadap Ka'bah, sampel demi sampel.

```
0. REFERENSI AWAL (saat masuk band pertama kali, atau setelah sesi
   terputus — lihat langkah 3c): buffer REF_SAMPLES=3 sudut sampel
   pertama, pakai RATA-RATA SIRKULARnya sebagai referensi (sudut_0).
   Efek: karena 3 sampel ini diambil SAAT jamaah sudah mulai berjalan
   (setelah titik mulai sebenarnya), rata-ratanya sedikit condong ke arah
   jalan → referensi "terlalu maju" → SEMUA delta berikutnya sedikit
   under-estimate rotasi total → pemicuan LEBIH LAMBAT (aman), tidak pernah
   lebih cepat.

1. HITUNG sudut posisi user terhadap Ka'bah (tiap sampel k):
   dLat = lat_user - lat_kaabah
   dLng = lng_user - lng_kaabah
   sudut_k = atan2(dLat, dLng) × 180/π    // hasil: -180° sampai 180°
   // 0° = arah timur (referensi matematis, BUKAN diasumsikan = garis Hajar
   // Aswad — hanya SELISIH antar sampel yang dipakai)

2. FILTER: hanya proses jika 10m ≤ jarak_ke_kaabah ≤ 80m (mode non-adaptif)
   atau band adaptif (lihat "Dua Mode Band Radius" di bawah)
   (di luar range ini = bukan sedang tawaf; lihat langkah 3c untuk apa
   yang terjadi saat KEMBALI ke band setelah sempat keluar)

3a. AKUMULASI ROTASI (unwrap + jumlahkan, per sampel k>0, sesi kontinu):
   delta_k = wrap(sudut_k - sudut_(k-1), ke rentang (-180°, 180°])
   JIKA sesi kontinu (tidak baru kembali dari luar band) DAN |delta_k| > 150°:
      delta_k = tanda(delta_k) × 150°     // potong outlier (spike GPS/dekat pusat)
   cumAngle += delta_k                     // + = CCW, - = CW
   bestCum = MAKS(bestCum, cumAngle)       // rekor tertinggi, tak pernah turun

3b. HITUNG PUTARAN (margin = 0, TIDAK ADA toleransi positif, monoton,
    sekali per kenaikan):
   putaran_baru = MAKS(0, LANTAI((bestCum + ε) / 360°))   // ε=1e-6° murni presisi float
   JIKA putaran_baru > putaran_sekarang:
      putaran_sekarang = putaran_baru
      trigger onChange(putaran_sekarang)

3c. KELUAR-MASUK BAND (sesi/jeda — lihat "Keluar-Masuk Band" di bawah):
   JIKA kembali ke band setelah sempat keluar:
     gap = waktu_sekarang - waktu_pertama_keluar
     JIKA gap ≤ MAX_GAP_SEC (90 dtk): delta dihitung UTUH (langkah 3a
       TANPA potongan 150° — unwrap sendiri sudah membatasi ke ≤180°)
     JIKA gap > MAX_GAP_SEC: SESI TERPUTUS — ambil ulang referensi
       (langkah 0), rotasi selama jeda TIDAK dihitung sama sekali

4. VIBRASI: pola [0, 200, 100, 200] ms saat putaran terdeteksi
```

Sifat berteleskop dari langkah 3a (Σ delta_k = sudut_akhir − sudut_awal + 360°×n bila tak ada langkah yang melompat >180°) berarti galat HANYA berasal dari derau sudut di titik-titik ujung tiap segmen — derau di titik-titik antara saling meniadakan secara matematis. Dua titik ujung yang tersisa (referensi awal & sampel terkini) masing-masing diberi bias aman-ke-belakang oleh langkah 0 (rata-rata sirkular) dan langkah 3b (tanpa toleransi positif) — **keduanya HANYA memperlambat pemicuan, tidak pernah mempercepatnya**.

**Evaluasi numerik parameter (handoff TDD `05c-tdd-guide-tawaf-never-early.md`)**: `REF_SAMPLES=3` dipilih dari sapuan M∈{1,3,5,7}; kombinasi K-jendela-rata-rata (M∈{1,3,5},K∈{1..20}) dan margin positif (0–60°) SEMUANYA DICOBA sebagai kandidat "titik lemah #2" tapi **ditolak**: keduanya memperbaiki p95 pemicuan-dini hanya dengan menukar sebagian besar proporsi tepat-7 (jendela "ekor" 30 detik pasca-selesai terlalu pendek untuk konvergensi rata-rata pada σ=5 m/r=25 m). Desain akhir memakai `REF_SAMPLES=3` + **tanpa toleransi/jendela tambahan** (margin=0 murni) karena ini satu-satunya kombinasi yang mempertahankan proporsi tepat-7 ≥95% (target wajib) sekaligus **tidak pernah dini sama sekali pada σ=0** (diverifikasi 0 m deviasi, bukan mendekati nol). Konsekuensinya, p95 pemicuan-dini pada σ=5 m aktual **~7–11 m** — LEBIH BESAR dari target aspirasional ≤5 m yang ditetapkan di awal perencanaan tugas ini; evaluasi numerik membuktikan target ≤5 m TIDAK TERCAPAI bersamaan dengan syarat tepat-7 ≥95% pada radius sekecil 25 m dengan jendela ekor 30 detik apa pun yang dicoba (lihat tabel di bawah).

**Debounce waktu (dulu 120 detik, skema garis lama) TETAP TIDAK DIPAKAI.** Skema kumulatif tidak punya "garis" yang bisa terlewati berulang secara jitter — kenaikan hanya terjadi saat `bestCum` (yang tak pernah turun) melewati ambang `360k`. Terverifikasi lewat skenario "mulai & selesai tepat di titik yang sama, diam 30 detik di awal dan akhir, 7 putaran penuh di antaranya" → hasil tepat 7 (bukan 8, bukan 6) **tanpa debounce apa pun**.

### Keluar-Masuk Band (Sesi & Jeda)

> **Temuan review (M2, handoff `05v-code-reviewer-tawaf.md`)**: sebelum revisi
> 2026-09-15, keluar band membekukan `prevAngle` tanpa mencatat durasi; saat
> kembali, delta besar (rotasi riil yang terjadi selagi di luar band) DIPOTONG
> diam-diam oleh `MAX_STEP_DEG=150°`, menyebabkan **kurang-hitung tanpa
> sinyal ke pengguna** — mis. jamaah terdorong keluar band oleh kerumunan
> lalu masuk kembali setelah berputar 170° akan kehilangan 20° tanpa
> pemberitahuan apa pun.

Durasi keluar band kini eksplisit dilacak (parameter `now` pada `update()`):

| Durasi keluar band | Perlakuan | Alasan |
|---|---|---|
| ≤ `MAX_GAP_SEC` (90 dtk) | Delta dihitung UTUH via unwrap (−180°,180°], **tanpa** potongan `MAX_STEP_DEG` | Jeda sementara dalam sesi yang sama (mis. terdorong kerumunan 20–40 dtk); unwrap sendiri sudah membatasi ambiguitas ke ≤180°, aman tanpa guard tambahan untuk jeda sependek ini |
| > `MAX_GAP_SEC` (90 dtk) | Referensi diambil ulang (langkah 0); rotasi selama jeda **tidak dihitung sama sekali** | Sesi dianggap terputus — lebih aman meminta jamaah menambah putaran daripada diam-diam salah hitung dari data yang tak diketahui |

`MAX_GAP_SEC=90` dtk dipilih agar menaungi jeda realistis kerumunan (target uji 20–40 dtk) dengan margin, namun tetap cukup ketat untuk tidak mempercayai delta dari jeda yang benar-benar panjang.

### Konsekuensi yang Harus Dipahami Pengguna

Karena tidak ada toleransi positif, **jika pelacakan GPS dihentikan TEPAT saat jamaah tiba di titik selesai** (tanpa sampel lanjutan), estimasi mungkin belum mencapai ambang 360k dan **putaran terakhir bisa belum tercatat**. Ini BUKAN bug — ini konsekuensi langsung dari kebijakan "tidak pernah dini" (lebih aman meng-under-count sesaat daripada meng-over-count/dini). Mitigasi: UI (`apps/mobile/app/tools.tsx`) mengarahkan pengguna membiarkan GPS aktif beberapa detik setelah merasa selesai, sampai getaran putaran ke-7 benar-benar muncul.

### Diagram Arah Sudut

```
              90° (Utara)
               |
    180°  -----Ka'bah----- 0° (Timur, referensi matematis)
               |
             -90° (Selatan)

    Arah tawaf sah: sudut NAIK (CCW) — 0° → 90° → 180° → -90°(=270°) → 360°(=0°)
    Deteksi: akumulasi kenaikan sudut mencapai kelipatan 360° (bukan lagi
    persilangan satu garis tetap — lihat "Akumulasi Rotasi" di atas)
```

### Batasan

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Radius min | 10 m | Terlalu dekat = di dalam Ka'bah |
| Radius max | 80 m | Terlalu jauh = bukan tawaf (mode non-adaptif) |
| Referensi awal (`REF_SAMPLES`) | 3 sampel | Rata-rata sirkular, bias aman-ke-belakang (2026-09-15) |
| Toleransi hitung putaran | **0 (dihapus 2026-09-15)** | `ROUND_TOL_DEG=60°` lama TERBUKTI membuat pemicuan dini ~30 m (p50); diganti margin=0 murni — lihat "Konsekuensi" di atas |
| Batas outlier per-langkah (`MAX_STEP_DEG`) | 150° | Lompatan sudut lebih besar dipotong — HANYA berlaku pada sesi kontinu (lihat "Keluar-Masuk Band") |
| Ambang sesi terputus (`MAX_GAP_SEC`) | 90 dtk | Keluar band > ini = referensi diambil ulang, rotasi selama jeda tak dihitung |
| Debounce waktu (jitter garis) | **dihapus** (2026-09-14) | Terbukti tak diperlukan pada skema kumulatif |
| Total putaran | 7 | Jumlah standar tawaf |
| Presisi GPS | 2 m / 3 detik | Mode BestForNavigation |

### Ketahanan Derau (Tabel Empiris, Revisi 2026-09-15)

Simulasi deterministik (mulberry32 seed=42, Gaussian i.i.d. per sumbu σ), 300 percobaan/sel, `TawafTracker` produksi diimpor langsung (bukan disalin). Skenario mengikuti kebijakan "GPS tetap aktif ≥30 dtk setelah selesai": diam 30 dtk di titik mulai, 7 putaran CCW bising, lalu **varian b** = diam 30 dtk lagi di titik selesai, atau **varian c** = lanjut CCW 30° lalu diam 30 dtk. `dini` = pemicuan putaran ke-7 SEBELUM posisi benar mencapai 360°×7 (harus 0 pada σ=0); `terlambat` = sebaliknya (aman).

| r (m) | σ (m) | mode | varian | tepat-7 | dini p50 (m) | dini p95 (m) | terlambat p50 (m) | terlambat p95 (m) |
|---|---|---|---|---|---|---|---|---|
| 25 | 0  | default | b | 100,00% | 0,00 | 0,00 | 0,00 | 0,00 |
| 25 | 0  | default | c | 100,00% | 0,00 | 0,00 | 0,00 | 0,00 |
| 25 | 3  | default | b | 99,00%  | 1,57 | 6,28 | 0,00 | 0,00 |
| 25 | 3  | default | c | 100,00% | 1,57 | 6,28 | 3,14 | 6,28 |
| 25 | 5  | default | b | 98,33%  | 4,71 | 11,00 | 0,00 | 0,00 |
| 25 | 5  | default | c | 100,00% | 3,14 | 11,00 | 3,14 | 7,85 |
| 25 | 5  | adaptif | b | 98,33%  | 4,71 | 11,00 | 0,00 | 0,00 |
| 25 | 5  | adaptif | c | 100,00% | 3,14 | 11,00 | 3,14 | 7,85 |
| 25 | 10 | default | b | 94,67%  | 12,57 | 28,27 | 0,00 | 0,00 |
| 25 | 10 | adaptif | c | 96,33%  | 11,00 | 29,85 | 4,71 | 13,09 |
| 25 | 15 | default | b | 24,00%  | 25,13 | 163,36 | 0,00 | 0,00 |
| 25 | 15 | adaptif | c | 28,67%  | 25,13 | 164,93 | 12,57 | 13,09 |
| 60 | 0  | default | b | 100,00% | 0,00 | 0,00 | 0,00 | 0,00 |
| 60 | 5  | default | b | 99,00%  | 3,77 | 11,31 | 0,00 | 0,00 |
| 60 | 5  | adaptif | c | 100,00% | 3,77 | 7,54 | 3,77 | 11,31 |
| 60 | 10 | default | b | 98,33%  | 7,54 | 22,62 | 0,00 | 0,00 |
| 60 | 15 | default | b | 98,00%  | 11,31 | 33,93 | 0,00 | 0,00 |

Tabel lengkap (semua kombinasi σ∈{0,3,5,10,15}×r∈{25,60}×mode×varian, 40 baris) di handoff TDD `05c-tdd-guide-tawaf-never-early.md`.

**Target wajib (dites otomatis)**: σ=5 m, r∈{25,60}, mode default & adaptif, varian b & c → proporsi tepat-7 ≥ 0,95 — **tercapai** (min 98,33%). σ=0 → **tidak pernah dini** (0,00 m di semua sel, bukan mendekati nol) — **tercapai**. σ=5 → p95 dini aktual **7–11 m**, TERBUKTI TIDAK mencapai target aspirasional ≤5 m yang ditetapkan di awal perencanaan (lihat pembahasan evaluasi parameter di atas) — didokumentasikan sebagai keterbatasan yang melekat pada presisi GPS konsumer (σ≈5 m) relatif terhadap radius edar sekecil 25 m dan jendela ekor 30 detik, bukan kegagalan implementasi. Baris σ=10/15 dilaporkan sebagai referensi (degradasi diharapkan: pada r=25 m, derau tangensial σ/r≈0,6 rad≈34° per titik pada σ=15 m — mendekati skala satu putaran per beberapa sampel, jauh di luar presisi GPS *BestForNavigation* riil ~2 m), bukan target kelulusan.

### Dua Mode Band Radius

`TawafTracker` menerima konfigurasi (`TawafConfig`) yang menentukan bagaimana filter jarak (langkah 2 di atas) bekerja. **Deteksi putaran (akumulasi rotasi, langkah 1/3/4) identik pada kedua mode** — konfigurasi hanya mengubah titik mana yang lolos filter untuk diproses.

| Mode | `adaptive` | Filter jarak | Dipakai oleh |
|------|-----------|--------------|--------------|
| **Non-adaptif** (default) | `false` | Band tetap **10–80 m** | Harness pengujian / naskah jurnal — perilaku **dibekukan** agar angka reproduksibel (138/138 sel) |
| **Adaptif** | `true` | Band mengikuti radius edar terestimasi | Aplikasi (`app/tools.tsx`) — mendukung tawaf lantai atas |

Parameter default (`TawafConfig`):

| Parameter | Default | Keterangan |
|-----------|---------|------------|
| `minRadius` | 10 m | Di bawah ini = di dalam/di atas Ka'bah atau noise |
| `maxRadius` | 80 m | Batas atas band **mode non-adaptif saja** |
| `adaptive` | `false` | `true` = band menyesuaikan lantai |
| `hardMaxRadius` | 300 m | Batas absolut mode adaptif (di luar mataf) |

### Mode Adaptif (Multi-Lantai)

Tawaf sah dilakukan di lantai mana pun (mataf/dasar, lantai 1, lantai 2, atap). Di lantai atas jarak horizontal ke Ka'bah bisa **jauh melebihi 80 m**, sehingga band tetap 10–80 m gagal menghitung. Mode adaptif menggantikan band tetap dengan band relatif terhadap **radius edar yang diestimasi** dari riwayat jarak terakhir, plus syarat kestabilan (membedakan "sedang mengedar" dari "berjalan lurus melintas").

```
Jendela geser jarak: WIN = 15 sampel (~45 detik pada sampling 3 detik)

UNTUK setiap update GPS (mode adaptif):
  1. TOLAK bila jarak < minRadius (10 m) ATAU jarak > hardMaxRadius (300 m)

  2. Dorong jarak ke jendela geser (buang tertua bila > WIN)

  3. WARM-UP (jendela belum penuh, < 15 sampel):
     terima titik (agar pelacakan sudut mulai berjalan)
     radius_estimasi = jarak saat ini

  4. JENDELA PENUH:
     median = median(jendela)
     std    = simpangan baku(jendela)
     radius_estimasi = median

     stabil  = std < max(10, 0,4 × median)      // radius ~konstan → mengedar
     inBand  = median×0,5 ≤ jarak ≤ median×1,7   // masih di lintasan edar

     terima titik HANYA JIKA (stabil DAN inBand)
```

- **Kestabilan** menolak lintasan lurus yang kebetulan melintas dekat Ka'bah: pada lintasan lurus, jarak berubah drastis (jauh→dekat→jauh) sehingga `std` besar → ditolak.
- **`getRadius()`** mengembalikan `round(median)` sebagai radius edar terestimasi, ditampilkan di UI sebagai `edar ~Xm`.
- Saat berpindah lantai, jendela sementara mencampur radius lama & baru → `std` melonjak → penghitungan **berhenti sementara** (konservatif) hingga jendela terisi radius baru.

> **Catatan reproduktifitas**: mode adaptif **tidak** dipakai harness jurnal. Harness (`docs/accuracy-test/`) menyalin `TawafTracker` dengan default non-adaptif (band 10–80 m). Perubahan mode adaptif tidak mengubah keluaran simulasi Monte Carlo.

### Deteksi Lantai via Barometer

**File**: `apps/mobile/src/services/floor-core.ts` (matematika murni), `floor.ts` (langganan sensor `expo-sensors`)

Info lantai bersifat **best-effort** (tidak semua ponsel punya barometer; tekanan indoor terpengaruh AC) dan hanya untuk **label informatif** — **tidak** memengaruhi penghitungan putaran (band adaptif memakai jarak GPS, bukan tekanan).

```
1. KETINGGIAN dari tekanan (formula barometrik internasional):
   altitude = 44330 × (1 − (p / p0)^0,190295)      // p, p0 dalam hPa

2. BASELINE p0 = tekanan TERTINGGI yang pernah teramati
   (titik terendah yang pernah dilewati → lantai relatif)

3. LANTAI dari ketinggian (tinggi antar-lantai Masjidil Haram ~5,5 m):
   floor = max(0, round(altitude / 5,5))
   label:  0 → "Lantai dasar (mataf)"
           1 → "Lantai 1"
           2 → "Lantai 2"
          ≥3 → "Atap"
```

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Tinggi antar-lantai | 5,5 m | Ambang setengah-lantai agar tak mudah lompat |
| Interval barometer | 2 detik | `Barometer.setUpdateInterval` |
| Baseline | Tekanan tertinggi teramati | Lantai terendah = acuan (relatif, bukan MSL) |

**Keterbatasan**: bila pengguna memulai di lantai atas dan tak pernah ke bawah, atau ada spike noise tekanan, baseline bisa salah → label lantai bergeser. Karena label tidak dipakai penghitung, kesalahan ini tidak berdampak pada jumlah putaran.

---

## 4. Pelacakan Sa'i Otomatis

**File**: `apps/mobile/src/services/sacred-zones-core.ts` (algoritma murni, `SaiTracker`), `sacred-zones.ts` (re-export + watcher GPS)

### Koordinat Referensi

```
Safa:    21.42266°N, 39.82649°E
Marwah:  21.42640°N, 39.82698°E
Jarak antara keduanya: ~415 meter (garis lurus)
```

### Algoritma

Sa'i adalah perjalanan bolak-balik antara bukit Safa dan Marwah. Sistem mendeteksi pergerakan user masuk ke zona masing-masing bukit.

```
1. DETEKSI ZONA: untuk setiap update GPS
   jarak_ke_safa   = haversine(posisi_user, SAFA)
   jarak_ke_marwah = haversine(posisi_user, MARWAH)

   JIKA jarak_ke_safa   ≤ 25m → zona = "safa"
   JIKA jarak_ke_marwah ≤ 25m → zona = "marwah"
   SELAIN ITU               → zona = "between" (abaikan)

2. MULAI: harus dimulai dari Safa
   JIKA belum started DAN zona = "safa" → started = true

3. HITUNG PERJALANAN: setiap pergantian zona
   JIKA zona_lama = "safa"   DAN zona_baru = "marwah" → legs++
   JIKA zona_lama = "marwah" DAN zona_baru = "safa"   → legs++

4. TOTAL: 7 legs
   Leg 1: Safa → Marwah
   Leg 2: Marwah → Safa
   Leg 3: Safa → Marwah
   ...
   Leg 7: Safa → Marwah (selesai di Marwah)
```

### Batasan

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Radius zona | 25 m | Deteksi masuk area Safa/Marwah |
| Total legs | 7 | 4× Safa→Marwah, 3× Marwah→Safa |
| Titik mulai | Safa | Wajib mulai dari Safa |
| Titik akhir | Marwah | Selesai di Marwah |
| Presisi GPS | 2 m / 3 detik | Mode BestForNavigation |

---

## 5. Deteksi Jamarat (Jumrah)

**File**: `apps/mobile/src/services/sacred-zones-core.ts` (algoritma murni, `detectNearestJamarat`), `sacred-zones.ts` (re-export + watcher GPS)

### Koordinat Tiga Jamarat

| Jamarat | Lat | Lng | Nama |
|---------|-----|-----|------|
| Ula (Kecil) | 21.4212 | 39.8717 | Jamarat Ula |
| Wustha (Tengah) | 21.4207 | 39.8722 | Jamarat Wustha |
| Aqabah (Besar) | 21.4203 | 39.8727 | Jamarat Aqabah |

### Algoritma Deteksi Kedekatan

```
UNTUK SETIAP jamarat:
  jarak = haversine(posisi_user, posisi_jamarat)
  JIKA jarak ≤ 30m DAN jarak < jarak_terdekat:
    jamarat_terdekat = jamarat ini

HASIL: nama jamarat terdekat + jarak (atau null jika > 30m)
```

### Aturan Pelemparan per Hari

```
Hari ke-1 (10 Dzulhijjah): Hanya Jamarat Aqabah (besar)
Hari ke-2 (11 Dzulhijjah): Ula → Wustha → Aqabah (urut)
Hari ke-3 (12 Dzulhijjah): Ula → Wustha → Aqabah (urut)
Hari ke-4 (13 Dzulhijjah): Ula → Wustha → Aqabah (opsional)
```

| Parameter | Nilai |
|-----------|-------|
| Radius deteksi | 30 m |
| Lemparan per jamarat | 7 batu |
| Presisi GPS | 2 m / 3 detik |

---

## 6. Deteksi Posisi Arafah

**File**: `apps/mobile/src/services/sacred-zones-core.ts` (algoritma murni, `isPointInPolygon`, `checkArafahPosition`), `sacred-zones.ts` (re-export + watcher GPS)

### Koordinat Referensi

```
Jabal Rahmah (pusat):  21.3549°N, 39.9842°E
Masjid Namirah:        21.3630°N, 39.9760°E

Batas wilayah Arafah (poligon 5 titik):
  Barat Laut:  21.3750°N, 39.9600°E
  Timur Laut:  21.3780°N, 40.0100°E
  Tenggara:    21.3400°N, 40.0200°E
  Selatan:     21.3250°N, 39.9900°E
  Barat Daya:  21.3350°N, 39.9550°E
```

### Algoritma Point-in-Polygon (Ray Casting)

```
Untuk menentukan apakah titik (lat, lng) berada di dalam poligon Arafah:

inside = false
n = jumlah_titik_poligon

UNTUK i = 0 sampai n-1:
  j = titik sebelumnya (wrap-around)
  yi = poligon[i].lat,  xi = poligon[i].lng
  yj = poligon[j].lat,  xj = poligon[j].lng

  JIKA (yi > lat) ≠ (yj > lat)
  DAN  lng < (xj - xi) × (lat - yi) / (yj - yi) + xi
  MAKA inside = !inside    // toggle status

HASIL: inside = true → di dalam Arafah
```

### Status Posisi

```
1. Hitung posisi:
   dalam_arafah  = isPointInPolygon(lat, lng, ARAFAH_BOUNDARY)
   jarak_namirah = haversine(posisi_user, NAMIRAH_BOUNDARY)

2. Tentukan status:
   JIKA tidak dalam arafah    → status = "outside"
       Pesan: "Kamu di luar batas Arafah"
   JIKA jarak_namirah ≤ 200m  → status = "namirah_danger"
       Pesan: "Peringatan: dekat Masjid Namirah — wukuf di sini tidak sah"
   SELAIN ITU                 → status = "inside"
       Pesan: "Kamu berada di dalam Arafah"
```

| Parameter | Nilai |
|-----------|-------|
| Radius peringatan Namirah | 200 m |
| Metode deteksi area | Ray casting polygon |
| Jumlah titik poligon | 5 |

---

## 7. Perhitungan Waktu Shalat

**File**: `server/src/routes/worship.ts` (rute `GET /prayer-times`)

Menggunakan metode astronomi sederhana berdasarkan posisi matahari. Default lokasi: Makkah (21.4225°N, 39.8262°E). Parameter query: `lat`, `lng`, `tz` (opsional; fallback `bulatkan(bujur/15)`), `method` & `ramadan` (opsional, override — lihat Langkah 5).

### Langkah 1: Deklinasi Matahari

```
hari = hari ke-N dalam tahun (1 Jan = 1, dst)

deklinasi = 23,45° × sin(2π/365 × (hari - 81))
```

Deklinasi adalah sudut matahari terhadap ekuator. Berkisar -23,45° (21 Des) sampai +23,45° (21 Jun).

### Langkah 2: Equation of Time

```
EoT = 9,87 × sin(2 × 2π/365 × (hari - 81))
    - 7,53 × cos(2π/365 × (hari - 81))
    - 1,5  × sin(2π/365 × (hari - 81))
```

EoT mengompensasi ketidakteraturan orbit bumi (dalam menit).

### Langkah 3: Solar Noon (Tengah Hari Matahari)

```
timezone = offset zona waktu (jam), urutan penentuan:
   1. query ?tz= bila diberikan
   2. lookup koordinat → zona IANA (tz-lookup) → offset DST-aware (Intl)
   3. fallback: bulatkan(bujur / 15)
solar_noon = 12 - bujur/15 - EoT/60 + timezone
```

Lookup koordinat dipakai karena `bulatkan(bujur/15)` salah bila zona politik ≠ zona
matahari — mis. Jawa Timur (Surabaya, bujur ~112,7) sebenarnya WIB (+7) tetapi
`bulatkan(112,7/15) = 8` → azan meleset 1 jam; juga menangani DST dan zona
setengah jam (mis. India +5,5). Karena berbasis koordinat GPS, tetap benar untuk
musafir walau jam HP belum menyesuaikan lokasi.

### Langkah 4: Hour Angle (Sudut Jam)

```
FUNGSI hourAngle(altitude):
  cosH = (sin(altitude) - sin(lintang) × sin(deklinasi))
       / (cos(lintang) × cos(deklinasi))

  JIKA cosH > 1  → return 0    (matahari tidak pernah cukup rendah)
  JIKA cosH < -1 → return 12   (matahari tidak pernah terbenam)
  SELAIN ITU     → return acos(cosH) × 180/π / 15
```

### Langkah 5: Waktu Shalat

| Shalat | Formula | Altitude / Aturan |
|--------|---------|---------------|
| **Subuh** | solar_noon - hourAngle(sudut_subuh) | sudut_subuh bergantung metode (lihat bawah) |
| **Syuruq** | solar_noon - hourAngle(-0,833°) | -0,833° (terbit) |
| **Dzuhur** | solar_noon + 0,05 jam | Titik tertinggi + buffer |
| **Ashar** | solar_noon + hourAngle(asrAlt) | Dihitung dari rasio bayangan |
| **Maghrib** | solar_noon + hourAngle(-0,833°) | -0,833° (terbenam) |
| **Isya** | interval Maghrib **atau** solar_noon + hourAngle(sudut_isya) | bergantung metode (lihat bawah) |

Dzuhur, Ashar, Syuruq, dan Maghrib **tidak** bergantung metode. Hanya **Subuh** dan **Isya** yang berbeda antar-wilayah.

### Pemilihan Metode Subuh/Isya (per wilayah)

Metode dipilih otomatis dari lokasi (bisa dioverride via `?method=`):

```
JIKA jarak < 300 km dari Ka'bah (21,4225; 39,8262) ATAU Masjid Nabawi (24,4686; 39,6142)
    → "ummalqura"
SELAIN ITU JIKA lat ∈ [-11, 6] DAN lng ∈ [95, 141]   // kotak wilayah Indonesia
    → "kemenag"
SELAIN ITU
    → "mwl"
```

| Metode | Subuh | Isya | Dipakai |
|--------|-------|------|---------|
| **Umm al-Qura** | -18,5° | **Maghrib + 90 menit** (120 menit saat Ramadan) | Mekkah & Madinah — cocok dengan azan Masjidil Haram/Nabawi |
| **Kemenag** | -20° | -18° | Wilayah Indonesia |
| **MWL / umum** | -18° | -17,5° | Lokasi lain (perilaku lama) |

- Isya Umm al-Qura memakai **interval tetap dari Maghrib**, bukan sudut senja.
- **Ramadan** (bulan Hijriah ke-9) dideteksi via kalender Umm al-Qura bawaan ICU (`Intl.DateTimeFormat` calendar `islamic-umalqura`); bisa dioverride `?ramadan=true|false`.
- Respons menyertakan `method`, `methodLabel`, dan `ramadan` (hanya untuk Umm al-Qura).
- Aplikasi mobile mengirim `lat`/`lng` perangkat → metode terpilih otomatis tanpa perubahan aplikasi.

> **Catatan akurasi**: matematika inti (deklinasi, EoT, solar noon, hour angle) sudah tervalidasi — Dzuhur/Ashar/Maghrib cocok dengan waktu resmi Mekkah dalam ±2 menit. Sebelum revisi ini Subuh/Isya memakai sudut generik sehingga meleset ~10 menit dari Umm al-Qura di Mekkah; kini selaras.

### Perhitungan Ashar (Mazhab Syafi'i)

```
sudut_bayangan_dzuhur = |lintang - deklinasi|
altitude_ashar = arctan(1 / (1 + tan(sudut_bayangan_dzuhur)))
```

Mazhab Syafi'i: waktu Ashar dimulai saat panjang bayangan = panjang benda + bayangan saat dzuhur.

### Format Output

```
JIKA jam tidak terhingga (NaN/Infinity) → "--:--"
SELAIN ITU → "HH:MM" (format 24 jam, zero-padded)
```

---

## 8. Background GPS & Notifikasi

**File**: `apps/mobile/src/services/background.ts`

### Konfigurasi Background Location

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Akurasi | Balanced | Hemat baterai, cukup akurat |
| Interval waktu | 30 detik | Update posisi tiap 30 detik |
| Interval jarak | 100 meter | Update jika bergerak ≥ 100m |
| Foreground service | Ya | Notifikasi permanen di status bar |

### Konfigurasi Foreground / Sacred Location

| Mode | Akurasi | Interval Jarak | Interval Waktu | Digunakan Untuk |
|------|---------|----------------|----------------|-----------------|
| Foreground | High | 50 m | 10 detik | Peta, beranda |
| Sacred | BestForNavigation | 2 m | 3 detik | Tawaf, sa'i, jumrah |
| Background | Balanced | 100 m | 30 detik | Peringatan miqat |

### Logika Background Task

```
SETIAP update lokasi background:
  1. Ambil posisi terbaru

  2. Cari miqat terdekat:
     UNTUK SETIAP miqat di MIQAT_ZONES:
       jarak = haversine(posisi_user, posisi_miqat)
       simpan yang terdekat

  3. Cek peringatan (jarak ≤ 3.000m):
     JIKA dalam zona peringatan:
       JIKA cooldown > 5 menit sejak notifikasi terakhir:
         Kirim notifikasi lokal:
           "Pakai ihram sekarang!"
           "Kamu X km dari batas miqat [nama]. Berihram & niat sebelum melewati garis."
         Update waktu notifikasi terakhir

  4. Kirim lokasi ke server:
     POST /locations { lat, lng, accuracy }
```

### Channel Notifikasi Android

| Channel | Prioritas | Keterangan |
|---------|-----------|------------|
| `default` | HIGH | Notifikasi umum |
| `sos` | MAX | SOS darurat, vibrasi panjang [0, 500, 250, 500] |
| `geofence` | HIGH | Peringatan miqat, vibrasi standar |

---

## 9. Referensi Koordinat

### Tempat Suci

| Lokasi | Lintang (°N) | Bujur (°E) |
|--------|-------------|------------|
| Ka'bah | 21.42251 | 39.82620 |
| Hajar Aswad | 21.42244 | 39.82631 |
| Bukit Safa | 21.42266 | 39.82649 |
| Bukit Marwah | 21.42640 | 39.82698 |
| Jabal Rahmah (Arafah) | 21.35490 | 39.98420 |
| Masjid Namirah | 21.36300 | 39.97600 |
| Jamarat Ula | 21.42120 | 39.87170 |
| Jamarat Wustha | 21.42070 | 39.87220 |
| Jamarat Aqabah | 21.42030 | 39.87270 |

### Miqat

| Miqat | Lintang (°N) | Bujur (°E) |
|-------|-------------|------------|
| Dzulhulaifah (Bir Ali) | 24.40970 | 39.54330 |
| Al-Juhfah (Rabigh) | 22.72670 | 39.07780 |
| Qarnul Manazil | 21.62190 | 40.43440 |
| Yalamlam | 20.54890 | 39.87330 |
| Dhat Irq | 21.92690 | 40.41610 |

---

## 10. Konstanta Sistem

| Konstanta | Nilai | Satuan | Digunakan Di |
|-----------|-------|--------|-------------|
| Radius Bumi (R) | 6.371.000 | meter | Semua perhitungan haversine |
| Radius peringatan miqat | 3.000 | meter | Geofence miqat |
| Radius batas miqat | 1.000 | meter | Geofence miqat |
| Radius Tanah Haram | 12.000 | meter | Zona haram |
| Radius zona tawaf (min) | 10 | meter | Tawaf tracker (kedua mode) |
| Radius zona tawaf (max) | 80 | meter | Tawaf tracker — mode non-adaptif (jurnal) |
| Radius tawaf hard-max | 300 | meter | Tawaf tracker — batas absolut mode adaptif |
| Jendela adaptif tawaf | 15 | sampel (~45 dtk) | Estimasi radius edar mode adaptif |
| Referensi awal tawaf (`REF_SAMPLES`) | 3 | sampel | Rata-rata sirkular, bias aman-ke-belakang, sejak revisi 2026-09-15 |
| Toleransi hitung putaran tawaf | 0 (dihapus) | derajat | `ROUND_TOL_DEG=60°` lama DIHAPUS 2026-09-15 (terbukti memicu dini ~30 m); margin=0 murni |
| Batas outlier per-langkah tawaf (`MAX_STEP_DEG`) | 150 | derajat | Lompatan sudut dipotong — hanya sesi kontinu, sejak revisi 2026-09-14 |
| Ambang sesi terputus tawaf (`MAX_GAP_SEC`) | 90 | detik | Keluar band > ini = referensi diambil ulang, sejak revisi 2026-09-15 |
| Tinggi antar-lantai (barometer) | 5,5 | meter | Estimasi lantai dari ketinggian |
| Interval barometer | 2 | detik | Update tekanan deteksi lantai |
| Radius zona Sa'i | 25 | meter | Deteksi Safa/Marwah |
| Radius deteksi Jamarat | 30 | meter | Proximity jamarat |
| Radius peringatan Namirah | 200 | meter | Zona bahaya Arafah |
| Cooldown notifikasi background | 300 | detik | Anti-spam notifikasi |
| Sudut Subuh | -18,5 / -20 / -18 | derajat | Umm al-Qura / Kemenag / MWL |
| Sudut Syuruq/Maghrib | -0,833 | derajat | Waktu shalat (semua metode) |
| Sudut Isya | -18 / -17,5 | derajat | Kemenag / MWL (Umm al-Qura pakai interval) |
| Interval Isya Umm al-Qura | 90 (120 Ramadan) | menit | Maghrib + interval |
| Radius auto Umm al-Qura | 300 | km | Dari Ka'bah/Masjid Nabawi |
| Deklinasi maks matahari | 23,45 | derajat | Waktu shalat |

---

*Dokumen ini dibuat dari analisis kode sumber Mabrur pada 9 Juli 2026.*
*Revisi 29 Juli 2026: tambah mode adaptif multi-lantai tawaf + deteksi lantai barometer (Bagian 3).*
*Revisi 30 Juli 2026: metode Subuh/Isya per wilayah — Umm al-Qura/Kemenag/MWL (Bagian 7).*
*Revisi 14 September 2026: perbaikan bug kritis arah TawafTracker (Bagian 3) — skema lama menghitung putaran SEARAH jarum jam (CW), bukan BERLAWANAN (CCW) seperti disyaratkan tawaf yang sah (dibuktikan lintasan sintetis CCW 7 putaran → 0 pada skema lama). Diganti dengan akumulasi rotasi kumulatif (bebas dari asumsi azimuth garis Hajar Aswad, yang di skema lama tak pernah diverifikasi) + toleransi derau `ROUND_TOL_DEG` yang menggantikan debounce waktu 120 detik (terbukti tak diperlukan lagi). Lihat tabel ketahanan derau di Bagian 3.*
*Revisi 15 September 2026: kebijakan "tidak pernah dini" (Bagian 3) — review independen (handoff `05v-code-reviewer-tawaf.md`) menemukan `ROUND_TOL_DEG=60°` (revisi 14 September) membuat aplikasi mengumumkan putaran selesai rata-rata ~30 m busur (p50, hingga ~41 m p95) SEBELUM jamaah benar-benar menyelesaikannya — risiko fikih. `ROUND_TOL_DEG` DIHAPUS, diganti referensi awal rata-rata sirkular (`REF_SAMPLES=3`) + margin=0 murni (tanpa toleransi positif) — keduanya HANYA memperlambat pemicuan, tidak pernah mempercepatnya; diverifikasi 0 m dini pada σ=0 (bukan mendekati nol). Ditambah perbaikan M2: keluar-masuk band kini melacak durasi jeda eksplisit (`MAX_GAP_SEC=90 dtk`) alih-alih membekukan referensi secara diam-diam (dulu berisiko kurang-hitung tanpa sinyal). Evaluasi numerik (handoff `05c-tdd-guide-tawaf-never-early.md`) membuktikan target aspirasional p95 dini ≤5 m TIDAK TERCAPAI bersamaan dengan syarat tepat-7 ≥95% pada r=25 m/σ=5 m (p95 aktual ~7–11 m) — didokumentasikan sebagai keterbatasan presisi GPS konsumer, bukan kegagalan implementasi. Tabel ketahanan derau & tabel konstanta di Bagian 3 diperbarui.*
