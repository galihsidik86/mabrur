// Kartu Taksi (permintaan revisi v2 #6): validasi input & bentuk data (murni — bisa dites).
import { z } from 'zod';

export const CITIES = ['makkah', 'madinah'] as const;
export type City = (typeof CITIES)[number];

const ARABIC_LETTER = /[؀-ۿ]/;
// Teks yang ditunjukkan ke sopir/polisi: hanya huruf Arab (+ blok tambahan & bentuk
// presentasi), angka, spasi/baris baru, dan tanda baca umum — tidak dicampur teks Latin.
const ARABIC_TEXT = /^[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ0-9\s.,:;()\/#'"«»-]+$/;
// Kontrol C0/DEL + penanda arah teks (bidi, termasuk ALM U+061C): bisa membalik/menyamarkan isi kartu.
const UNSAFE_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F؜‎‏‪-‮⁦-⁩]/;
// Wajib berkode negara: tombol darurat di HP tidak menebak awalan nomor lokal.
const PHONE = /^\+[0-9][0-9 ()-]{5,24}$/;
// Kamar: angka/huruf/strip/titik/garis miring saja (tidak ada markup).
const ROOM = /^[A-Za-z0-9 ./-]{1,20}$/;

const trimmed = (max: number) => z.string().trim().max(max);
const safeText = (max: number) =>
  trimmed(max).refine((v) => !UNSAFE_CHARS.test(v), 'Teks mengandung karakter kontrol yang tidak diizinkan');
const arabicText = (max: number, label: string) =>
  safeText(max).pipe(
    z.string()
      .min(1, `${label} wajib diisi`)
      .regex(ARABIC_LETTER, `${label} harus ditulis dengan huruf Arab`)
      .regex(ARABIC_TEXT, `${label} hanya boleh huruf Arab, angka, dan tanda baca`),
  );

export const hotelInputSchema = z.object({
  name_ar: arabicText(150, 'Nama hotel (Arab)'),
  name_latin: safeText(150).optional().default(''),
  address_ar: arabicText(500, 'Alamat hotel (Arab)'),
  phone: trimmed(30)
    .refine((v) => v === '' || PHONE.test(v), 'Nomor telepon harus diawali kode negara, mis. +966 12 555 0000')
    .optional().default(''),
});
export type HotelInput = z.infer<typeof hotelInputSchema>;

export const citySchema = z.enum(CITIES);

export const roomInputSchema = z.object({
  city: citySchema,
  room_number: z.string().trim().max(20)
    .refine((v) => v === '' || ROOM.test(v), 'Nomor kamar hanya boleh huruf, angka, titik, strip, atau garis miring')
    .transform((v) => (v === '' ? null : v)),
});

export interface HotelRow {
  city: string;
  name_ar: string;
  name_latin: string | null;
  address_ar: string;
  phone: string | null;
}

export interface TaxiCardHotel {
  name_ar: string;
  name_latin: string | null;
  address_ar: string;
  phone: string | null;
}

export interface TaxiCard {
  group: { name: string; kloter_code: string };
  hotels: Record<City, TaxiCardHotel | null>;
  rooms: Record<City, string | null>;
  leaders: Array<{ name: string; phone: string | null }>;
}

/**
 * Daftar anggota sesuai peminta: nomor kamar hanya untuk admin/muthawwif. Jamaah lain tidak
 * perlu tahu di kamar mana setiap anggota tidur (kartu taksi hanya memuat kamar sendiri).
 */
export function memberListForViewer<T extends { room_makkah?: unknown; room_madinah?: unknown }>(
  rows: T[], canSeeRooms: boolean,
): Array<Omit<T, 'room_makkah' | 'room_madinah'> | T> {
  if (canSeeRooms) return rows;
  return rows.map(({ room_makkah: _makkah, room_madinah: _madinah, ...rest }) => rest);
}

export function shapeTaxiCard(input: {
  group: { name: string; kloter_code: string };
  hotels: HotelRow[];
  membership: { room_makkah: string | null; room_madinah: string | null };
  leaders: Array<{ name: string; phone: string | null }>;
}): TaxiCard {
  const hotelFor = (city: City): TaxiCardHotel | null => {
    const h = input.hotels.find((row) => row.city === city);
    return h ? { name_ar: h.name_ar, name_latin: h.name_latin || null, address_ar: h.address_ar, phone: h.phone || null } : null;
  };
  return {
    group: { name: input.group.name, kloter_code: input.group.kloter_code },
    hotels: { makkah: hotelFor('makkah'), madinah: hotelFor('madinah') },
    rooms: { makkah: input.membership.room_makkah, madinah: input.membership.room_madinah },
    leaders: input.leaders.map((l) => ({ name: l.name, phone: l.phone })),
  };
}
