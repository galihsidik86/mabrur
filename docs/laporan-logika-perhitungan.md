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

**File**: `apps/mobile/src/services/sacred-zones.ts:122-164`

### Koordinat Referensi

```
Ka'bah:       21.42251°N, 39.82620°E
Hajar Aswad:  21.42244°N, 39.82631°E (sudut tenggara, titik awal tawaf)
```

### Algoritma

Tawaf dilakukan **berlawanan arah jarum jam** (counterclockwise) mengelilingi Ka'bah. Sistem mendeteksi putaran dengan menghitung sudut posisi user relatif terhadap Ka'bah.

```
1. HITUNG sudut posisi user terhadap Ka'bah:
   dLat = lat_user - lat_kaabah
   dLng = lng_user - lng_kaabah
   sudut = atan2(dLat, dLng) × 180/π    // hasil: -180° sampai 180°
   // 0° = arah timur (sisi Hajar Aswad)

2. FILTER: hanya proses jika 10m ≤ jarak_ke_kaabah ≤ 80m
   (di luar range ini = bukan sedang tawaf)

3. DETEKSI PUTARAN: persilangan 0° dari positif ke negatif
   JIKA sudut_sebelumnya > 0° DAN < 90°
   DAN sudut_sekarang < 0° DAN > -90°
   MAKA: putaran terdeteksi (melewati garis Hajar Aswad)

4. DEBOUNCE: minimal 120 detik antar putaran
   (mencegah double-count jika GPS berfluktuasi)

5. VIBRASI: pola [0, 200, 100, 200] ms saat putaran terdeteksi
```

### Diagram Arah Sudut

```
              90° (Utara)
               |
    180°  -----Ka'bah----- 0° (Timur = Hajar Aswad)
               |
             -90° (Selatan)

    Arah tawaf: 0° → 90° → 180° → -90° → 0° (counterclockwise)
    Deteksi: saat sudut cross dari positif ke negatif (melewati 0°)
```

### Batasan

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Radius min | 10 m | Terlalu dekat = di dalam Ka'bah |
| Radius max | 80 m | Terlalu jauh = bukan tawaf |
| Debounce | 120 detik | Waktu minimum antar putaran |
| Total putaran | 7 | Jumlah standar tawaf |
| Presisi GPS | 2 m / 3 detik | Mode BestForNavigation |

---

## 4. Pelacakan Sa'i Otomatis

**File**: `apps/mobile/src/services/sacred-zones.ts:171-215`

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

**File**: `apps/mobile/src/services/sacred-zones.ts:219-233`

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

**File**: `apps/mobile/src/services/sacred-zones.ts:32-93`

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

**File**: `server/src/routes/worship.ts:187-244`

Menggunakan metode astronomi sederhana berdasarkan posisi matahari. Default lokasi: Makkah (21.4225°N, 39.8262°E).

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
timezone = bulatkan(bujur / 15)    // estimasi dari longitude
solar_noon = 12 - bujur/15 - EoT/60 + timezone
```

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

| Shalat | Formula | Sudut Altitude |
|--------|---------|---------------|
| **Subuh** | solar_noon - hourAngle(-18°) | -18° (fajar astronomis) |
| **Syuruq** | solar_noon - hourAngle(-0,833°) | -0,833° (terbit) |
| **Dzuhur** | solar_noon + 0,05 jam | Titik tertinggi + buffer |
| **Ashar** | solar_noon + hourAngle(asrAlt) | Dihitung dari rasio bayangan |
| **Maghrib** | solar_noon + hourAngle(-0,833°) | -0,833° (terbenam) |
| **Isya** | solar_noon + hourAngle(-17,5°) | -17,5° (senja astronomis) |

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
| Radius zona tawaf (min) | 10 | meter | Tawaf tracker |
| Radius zona tawaf (max) | 80 | meter | Tawaf tracker |
| Debounce tawaf | 120 | detik | Cegah double-count |
| Radius zona Sa'i | 25 | meter | Deteksi Safa/Marwah |
| Radius deteksi Jamarat | 30 | meter | Proximity jamarat |
| Radius peringatan Namirah | 200 | meter | Zona bahaya Arafah |
| Cooldown notifikasi background | 300 | detik | Anti-spam notifikasi |
| Sudut Subuh | -18,0 | derajat | Waktu shalat |
| Sudut Syuruq/Maghrib | -0,833 | derajat | Waktu shalat |
| Sudut Isya | -17,5 | derajat | Waktu shalat |
| Deklinasi maks matahari | 23,45 | derajat | Waktu shalat |

---

*Dokumen ini dibuat dari analisis kode sumber Mabrur pada 9 Juli 2026.*
