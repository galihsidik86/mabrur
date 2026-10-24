import { describe, it, expect } from 'vitest';
import { hotelInputSchema, roomInputSchema, shapeTaxiCard, memberListForViewer } from '../src/services/taxi-card-core';
// Modul murni mobile (tanpa impor Expo) — dites di sini karena apps/mobile tidak punya test runner.
import {
  whatsappNumber,
  dialNumber,
  pickDefaultCity,
  hotelMissingFields,
  TAXI_PHRASES,
  EMERGENCY_NUMBERS,
} from '../../apps/mobile/src/services/taxi-card-core';
import { id as idLocale } from '../../apps/mobile/src/i18n/locales/id';

describe('validasi input hotel (server)', () => {
  const ok = { name_ar: 'فندق صفوة زمزم', name_latin: 'Safwa Zamzam Hotel', address_ar: 'بجوار المسجد الحرام، مكة المكرمة', phone: '+966 12 555 0000' };

  it('menerima data lengkap & merapikan spasi', () => {
    expect(hotelInputSchema.parse({ ...ok, name_latin: '  Safwa  ' }).name_latin).toBe('Safwa');
  });

  it('nama & alamat Arab wajib; telepon harus berformat nomor', () => {
    expect(hotelInputSchema.safeParse({ ...ok, name_ar: '' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, address_ar: ' ' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, phone: 'telp: 123' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, phone: '' }).success).toBe(true);
  });

  it('nama Arab harus mengandung huruf Arab (cegah salah isi kolom)', () => {
    expect(hotelInputSchema.safeParse({ ...ok, name_ar: 'Safwa Hotel' }).success).toBe(false);
  });

  it('kolom Arab hanya huruf Arab, angka, dan tanda baca (tidak dicampur teks Latin menyesatkan)', () => {
    expect(hotelInputSchema.safeParse({ ...ok, address_ar: 'م Call 0800 for help' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, address_ar: 'شارع إبراهيم الخليل، مبنى ١٢، مكة المكرمة - 24231' }).success).toBe(true);
  });

  it('karakter kontrol arah teks (bidi) & kontrol lain ditolak di semua kolom', () => {
    expect(hotelInputSchema.safeParse({ ...ok, name_ar: 'فندق‮زمزم' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, name_latin: 'Safwa‮' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, name_latin: 'Safwa\u0007' }).success).toBe(false);
  });

  it('telepon hotel wajib berkode negara (+…) agar tombol darurat tidak salah sambung', () => {
    expect(hotelInputSchema.safeParse({ ...ok, phone: '012 555 0000' }).success).toBe(false);
    expect(hotelInputSchema.safeParse({ ...ok, phone: '+966 12 555 0000' }).success).toBe(true);
  });

  it('nomor kamar: pendek, huruf/angka/strip; kosong = hapus', () => {
    expect(roomInputSchema.parse({ city: 'makkah', room_number: ' 1523 ' })).toEqual({ city: 'makkah', room_number: '1523' });
    expect(roomInputSchema.parse({ city: 'madinah', room_number: '' })).toEqual({ city: 'madinah', room_number: null });
    expect(roomInputSchema.safeParse({ city: 'jeddah', room_number: '1' }).success).toBe(false);
    expect(roomInputSchema.safeParse({ city: 'makkah', room_number: '<b>1</b>' }).success).toBe(false);
  });
});

describe('memberListForViewer (server)', () => {
  const rows = [
    { id: 'a', name: 'A', role_in_group: 'jamaah', room_makkah: '1523', room_madinah: '210' },
    { id: 'b', name: 'B', role_in_group: 'muthawwif', room_makkah: null, room_madinah: null },
  ];

  it('admin & muthawwif melihat nomor kamar semua anggota', () => {
    expect(memberListForViewer(rows, true)[0].room_makkah).toBe('1523');
  });

  it('jamaah tidak melihat nomor kamar anggota lain (kolom dihapus, tidak sekadar null)', () => {
    const list = memberListForViewer(rows, false);
    expect(list.every((m) => !('room_makkah' in m) && !('room_madinah' in m))).toBe(true);
    expect(rows[0].room_makkah).toBe('1523'); // input tidak dimutasi
  });
});

describe('shapeTaxiCard (server)', () => {
  it('menyusun kartu: hotel per kota, kamar milik anggota, kontak muthawwif', () => {
    const card = shapeTaxiCard({
      group: { name: 'KBIH Barokah', kloter_code: 'SOC-15' },
      hotels: [{ city: 'makkah', name_ar: 'فندق', name_latin: 'Hotel', address_ar: 'مكة', phone: '+966' }],
      membership: { room_makkah: '1523', room_madinah: null },
      leaders: [{ name: 'Ust. Ahmad', phone: '0812' }],
    });
    expect(card.group).toEqual({ name: 'KBIH Barokah', kloter_code: 'SOC-15' });
    expect(card.hotels.makkah?.name_ar).toBe('فندق');
    expect(card.hotels.madinah).toBeNull();
    expect(card.rooms).toEqual({ makkah: '1523', madinah: null });
    expect(card.leaders).toEqual([{ name: 'Ust. Ahmad', phone: '0812' }]);
  });
});

describe('nomor telepon untuk tombol (mobile)', () => {
  it('WhatsApp: format internasional tanpa +, termasuk nomor lokal Indonesia & Saudi', () => {
    expect(whatsappNumber('0812-3456-789')).toBe('628123456789');
    expect(whatsappNumber('+62 812 3456 789')).toBe('628123456789');
    expect(whatsappNumber('0551234567')).toBe('966551234567');
    expect(whatsappNumber('+966 55 123 4567')).toBe('966551234567');
    expect(whatsappNumber('')).toBeNull();
  });

  it('telepon: hanya digit dan + di depan', () => {
    expect(dialNumber('+966 12 555-0000')).toBe('+966125550000');
    expect(dialNumber('abc')).toBeNull();
  });
});

describe('kartu taksi (mobile)', () => {
  const hotel = { name_ar: 'فندق', name_latin: 'Hotel', address_ar: 'مكة', phone: null };

  it('hotel default: yang terakhir dipilih bila ada, else Makkah, else Madinah', () => {
    expect(pickDefaultCity({ makkah: hotel, madinah: hotel }, 'madinah')).toBe('madinah');
    expect(pickDefaultCity({ makkah: hotel, madinah: hotel }, null)).toBe('makkah');
    expect(pickDefaultCity({ makkah: null, madinah: hotel }, 'makkah')).toBe('madinah');
    expect(pickDefaultCity({ makkah: null, madinah: null }, null)).toBeNull();
  });

  it('data belum lengkap terdeteksi per bagian', () => {
    expect(hotelMissingFields(null, null, [])).toEqual(['hotel', 'room', 'leader']);
    expect(hotelMissingFields(hotel, '1523', [{ name: 'A', phone: '0812' }])).toEqual(['hotel_phone']);
  });

  it('kalimat untuk sopir sama persis dengan dokumen (tanpa harakat) & punya arti id/en', () => {
    expect(TAXI_PHRASES[0].arabic).toBe('من فضلك، أوصلني إلى هذا الفندق');
    expect(TAXI_PHRASES.map((p) => p.arabic)).toContain('أحتاج إلى مساعدة طبية');
    for (const p of TAXI_PHRASES) expect(/[ً-ْ]/.test(p.arabic)).toBe(false);
  });

  it('nomor darurat Arab Saudi: 911 terpadu + polisi/ambulans/pemadam', () => {
    expect(EMERGENCY_NUMBERS.map((e) => e.number)).toEqual(['911', '999', '997', '998']);
  });

  it('setiap kunci arti/label kartu ada di file bahasa', () => {
    const keys = [...TAXI_PHRASES.map((p) => p.meaningKey), ...EMERGENCY_NUMBERS.map((e) => e.labelKey)];
    for (const k of keys) expect(Object.keys(idLocale), k).toContain(k);
  });
});
