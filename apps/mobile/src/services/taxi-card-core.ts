// Kartu Taksi — logika murni (tanpa impor Expo — bisa dites dari vitest).

export type City = 'makkah' | 'madinah';

export interface TaxiCardHotel {
  name_ar: string;
  name_latin: string | null;
  address_ar: string;
  phone: string | null;
}

export interface TaxiCardData {
  group: { name: string; kloter_code: string };
  hotels: Record<City, TaxiCardHotel | null>;
  rooms: Record<City, string | null>;
  leaders: Array<{ name: string; phone: string | null }>;
}

/**
 * Kalimat untuk sopir/polisi — persis dari dokumen permintaan (Permintaan 6).
 * Sengaja TANPA harakat: dibaca penutur Arab. Teks final perlu diperiksa ahli bahasa Arab.
 * meaningKey = kunci i18n untuk arti dalam bahasa aktif.
 */
export const TAXI_PHRASES = [
  { id: 'take_me', arabic: 'من فضلك، أوصلني إلى هذا الفندق', latin: 'Min fadhlik, aushilni ila hadzal funduq', meaningKey: 'taxi.phrase.take_me' },
  {
    id: 'lost',
    arabic: 'أنا معتمر وقد ضللت الطريق عن مجموعتي. أرجو مساعدتي للوصول إلى هذا الفندق أو الاتصال بقائد المجموعة.',
    latin: "Ana mu'tamir wa qad dhalaltu ath-thariqa 'an majmu'ati. Arju musa'adati lil-wushul ila hadzal funduq aw al-ittishal bi-qa'id al-majmu'ah",
    meaningKey: 'taxi.phrase.lost',
  },
  { id: 'call', arabic: 'من فضلك، اتصل بهذا الرقم', latin: 'Min fadhlik, ittashil bihadzar raqm', meaningKey: 'taxi.phrase.call' },
  { id: 'medical', arabic: 'أحتاج إلى مساعدة طبية', latin: "Ahtaju ila musa'adah thibbiyyah", meaningKey: 'taxi.phrase.medical' },
] as const;

/** Label Arab di kartu (tanpa harakat, seperti contoh referensi). */
export const ROOM_LABEL_AR = 'رقم الغرفة';

/**
 * Nomor darurat Arab Saudi. 911 = pusat panggilan darurat terpadu (Makkah, Madinah,
 * Riyadh, Provinsi Timur); 999/997/998 = polisi/ambulans/pemadam (nomor lama, masih
 * dikenal luas). PERLU diverifikasi ulang sebelum rilis (lihat dokumen permintaan).
 */
export const EMERGENCY_NUMBERS = [
  { number: '911', labelKey: 'taxi.emergency.unified' },
  { number: '999', labelKey: 'taxi.emergency.police' },
  { number: '997', labelKey: 'taxi.emergency.ambulance' },
  { number: '998', labelKey: 'taxi.emergency.fire' },
] as const;

/** Nomor untuk tel: — hanya digit, boleh + di depan. */
export function dialNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const plus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return digits ? `${plus ? '+' : ''}${digits}` : null;
}

/**
 * Nomor untuk wa.me (internasional tanpa +). Nomor lokal: 08… = Indonesia (62),
 * 05… = ponsel Arab Saudi (966). Selain itu dianggap sudah berkode negara.
 */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const dial = dialNumber(raw);
  if (!dial) return null;
  if (dial.startsWith('+')) return dial.slice(1);
  if (dial.startsWith('08')) return `62${dial.slice(1)}`;
  if (dial.startsWith('05')) return `966${dial.slice(1)}`;
  return dial;
}

/** Hotel yang ditampilkan: pilihan terakhir (bila masih ada datanya) > Makkah > Madinah. */
export function pickDefaultCity(hotels: Record<City, TaxiCardHotel | null>, lastChosen: City | null): City | null {
  if (lastChosen && hotels[lastChosen]) return lastChosen;
  if (hotels.makkah) return 'makkah';
  if (hotels.madinah) return 'madinah';
  return null;
}

export type MissingField = 'hotel' | 'hotel_phone' | 'room' | 'leader';

/** Bagian kartu yang belum diisi admin/muthawwif (untuk peringatan di layar). */
export function hotelMissingFields(
  hotel: TaxiCardHotel | null,
  room: string | null,
  leaders: Array<{ phone: string | null }>,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!hotel) missing.push('hotel');
  else if (!hotel.phone) missing.push('hotel_phone');
  if (!room) missing.push('room');
  if (!leaders.some((l) => l.phone)) missing.push('leader');
  return missing;
}
