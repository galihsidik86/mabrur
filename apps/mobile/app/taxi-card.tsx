import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { colors } from '../src/theme';
import { api } from '../src/services/api';
import { getGroups, getMeta, setMeta } from '../src/services/db';
import { useI18n, type TranslationKey } from '../src/services/i18n';
import {
  TAXI_PHRASES,
  EMERGENCY_NUMBERS,
  ROOM_LABEL_AR,
  dialNumber,
  whatsappNumber,
  pickDefaultCity,
  hotelMissingFields,
  type City,
  type TaxiCardData,
} from '../src/services/taxi-card-core';

const CARD_KEY = 'taxi_card';
const CITY_KEY = 'taxi_city';
const CITIES: City[] = ['makkah', 'madinah'];

// Kartu ditunjukkan ke sopir/polisi: kontras tinggi (hitam di atas putih), tidak ikut tema.
const INK = '#000000';
const PAPER = '#FFFFFF';

function isCardData(value: unknown): value is TaxiCardData {
  const v = value as Partial<TaxiCardData> | null;
  return !!v && typeof v.hotels === 'object' && v.hotels !== null && typeof v.rooms === 'object' && Array.isArray(v.leaders);
}

export default function TaxiCardScreen() {
  useKeepAwake(); // layar tetap menyala selama kartu dibuka
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const [card, setCard] = useState<TaxiCardData | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [offline, setOffline] = useState(false);
  const [noGroup, setNoGroup] = useState(false);

  // Offline-first: kartu tersimpan dulu, lalu segarkan dari server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cachedRaw, cityRaw] = await Promise.all([
        getMeta(CARD_KEY).catch(() => null),
        getMeta(CITY_KEY).catch(() => null),
      ]);
      const lastCity = cityRaw === 'makkah' || cityRaw === 'madinah' ? cityRaw : null;
      let cached: unknown = null;
      try { cached = cachedRaw ? JSON.parse(cachedRaw) : null; } catch { /* cache rusak diabaikan */ }
      if (!cancelled && isCardData(cached)) {
        setCard(cached);
        setCity(pickDefaultCity(cached.hotels, lastCity));
      }

      try {
        const groups = await getGroups();
        if (groups.length === 0) {
          if (!cancelled) setNoGroup(!isCardData(cached));
          return;
        }
        const fresh: unknown = await api.getTaxiCard(groups[0].id);
        if (cancelled || !isCardData(fresh)) return;
        setCard(fresh);
        setCity((current) => pickDefaultCity(fresh.hotels, current ?? lastCity));
        setOffline(false);
        await setMeta(CARD_KEY, JSON.stringify(fresh)).catch(() => {});
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const chooseCity = (next: City) => {
    setCity(next);
    setMeta(CITY_KEY, next).catch(() => {});
  };

  const call = (raw: string | null) => {
    const number = dialNumber(raw);
    if (!number) return;
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert(t('sos.err.title'), t('sos.err.phone')));
  };

  const whatsapp = (raw: string | null) => {
    const number = whatsappNumber(raw);
    if (!number) return;
    Linking.openURL(`https://wa.me/${number}`).catch(() => Alert.alert(t('sos.err.title'), t('taxi.whatsapp_failed')));
  };

  const hotel = card && city ? card.hotels[city] : null;
  const room = card && city ? card.rooms[city] : null;
  const leaders = card?.leaders ?? [];
  const missing = hotelMissingFields(hotel, room, leaders);
  const phrase = TAXI_PHRASES[phraseIndex];
  const availableCities = card ? CITIES.filter((c) => card.hotels[c]) : [];
  const groupName = card?.group.name ?? '';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('taxi.title')}</Text>
          <Text style={s.subtitle}>{t('taxi.subtitle')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={22} color={INK} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Nomor darurat — paling atas, sekali ketuk */}
        <Text style={s.sectionTitle}>{t('taxi.emergency_title')}</Text>
        <View style={s.emergencyRow}>
          {EMERGENCY_NUMBERS.map((e) => (
            <TouchableOpacity key={e.number} style={s.emergencyBtn} onPress={() => call(e.number)}
              accessibilityLabel={`${t(e.labelKey as TranslationKey)} ${e.number}`}>
              <Text style={s.emergencyNumber}>{e.number}</Text>
              <Text style={s.emergencyLabel}>{t(e.labelKey as TranslationKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Kontak muthawwif / ketua rombongan */}
        {leaders.filter((l) => l.phone).map((l) => (
          <View key={`${l.name}-${l.phone}`} style={s.leaderCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.leaderLabel}>{t('taxi.leader_title')}</Text>
              <Text style={s.leaderName}>{l.name}</Text>
            </View>
            <TouchableOpacity style={s.callBtn} onPress={() => call(l.phone)}>
              <Ionicons name="call" size={18} color={PAPER} />
              <Text style={s.btnText}>{t('taxi.call')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.waBtn} onPress={() => whatsapp(l.phone)}>
              <Ionicons name="logo-whatsapp" size={18} color={PAPER} />
              <Text style={s.btnText}>{t('taxi.whatsapp')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Pilih hotel Makkah / Madinah */}
        {availableCities.length > 1 && (
          <View style={s.cityRow}>
            {availableCities.map((c) => (
              <TouchableOpacity key={c} style={[s.cityBtn, city === c && s.cityBtnActive]} onPress={() => chooseCity(c)}
                accessibilityState={{ selected: city === c }}>
                <Text style={[s.cityText, city === c && s.cityTextActive]}>{t(`taxi.city.${c}` as TranslationKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(offline || noGroup || missing.length > 0) && (
          <View style={s.warnBox}>
            {offline && <Text style={s.warnText}>{t('taxi.offline')}</Text>}
            {noGroup && <Text style={s.warnText}>{t('taxi.no_group')}</Text>}
            {missing.length > 0 && !noGroup && (
              <Text style={s.warnText}>
                {t('taxi.missing', { fields: missing.map((f) => t(`taxi.missing.${f}` as TranslationKey)).join(', ') })}
              </Text>
            )}
          </View>
        )}

        {/* Kartu yang ditunjukkan ke sopir */}
        <View style={s.card}>
          <Text style={s.cardPhrase}>{phrase.arabic}</Text>
          <Text style={s.cardMeaning}>{t(phrase.meaningKey as TranslationKey)}</Text>

          {hotel && (
            <>
              <View style={s.cardDivider} />
              <Text style={s.hotelAr}>{hotel.name_ar}</Text>
              {hotel.name_latin ? <Text style={s.hotelLatin}>{hotel.name_latin}</Text> : null}
              <Text style={s.addressAr}>{hotel.address_ar}</Text>
            </>
          )}
          {room && <Text style={s.roomAr}>{`${ROOM_LABEL_AR}: ${room}`}</Text>}
          {groupName ? (
            <Text style={s.roomLatin}>
              {room ? t('taxi.room_line', { room, group: groupName }) : t('taxi.group_line', { group: groupName })}
            </Text>
          ) : null}
          {hotel?.phone && (
            <TouchableOpacity style={s.hotelPhoneBtn} onPress={() => call(hotel.phone)}>
              <Ionicons name="call-outline" size={18} color={INK} />
              <Text style={s.hotelPhoneText}>{t('taxi.hotel_phone')}: {hotel.phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kalimat lain untuk ditampilkan di kartu */}
        <Text style={s.sectionTitle}>{t('taxi.choose_phrase')}</Text>
        {TAXI_PHRASES.map((p, i) => (
          <TouchableOpacity key={p.id} style={[s.phraseRow, i === phraseIndex && s.phraseRowActive]} onPress={() => setPhraseIndex(i)}
            accessibilityState={{ selected: i === phraseIndex }}>
            <Text style={s.phraseAr}>{p.arabic}</Text>
            <Text style={s.phraseLatin}>{p.latin}</Text>
            <Text style={s.phraseMeaning}>{t(p.meaningKey as TranslationKey)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 2, borderBottomColor: INK },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK },
  subtitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#333333', marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 999, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#333333', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4, marginBottom: 8 },
  emergencyRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  emergencyBtn: { flex: 1, minHeight: 64, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  emergencyNumber: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: PAPER },
  emergencyLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: PAPER },
  leaderCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: INK, borderRadius: 12, padding: 12, marginBottom: 10 },
  leaderLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#333333' },
  leaderName: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 10, backgroundColor: INK },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#128C7E' },
  btnText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: PAPER },
  cityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cityBtn: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  cityBtnActive: { backgroundColor: INK },
  cityText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: INK },
  cityTextActive: { color: PAPER },
  warnBox: { backgroundColor: '#FFF4CC', borderWidth: 1, borderColor: '#B8860B', borderRadius: 10, padding: 12, marginBottom: 12, gap: 4 },
  warnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#5C4400', lineHeight: 19 },
  card: { borderWidth: 3, borderColor: INK, borderRadius: 16, padding: 18, marginBottom: 18, backgroundColor: PAPER },
  cardPhrase: { fontFamily: 'Amiri_700Bold', fontSize: 30, lineHeight: 54, color: INK, textAlign: 'right', writingDirection: 'rtl' },
  cardMeaning: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#333333', marginTop: 2 },
  cardDivider: { height: 2, backgroundColor: INK, marginVertical: 14 },
  hotelAr: { fontFamily: 'Amiri_700Bold', fontSize: 36, lineHeight: 62, color: INK, textAlign: 'right', writingDirection: 'rtl' },
  hotelLatin: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: INK },
  addressAr: { fontFamily: 'Amiri_400Regular', fontSize: 24, lineHeight: 44, color: INK, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  roomAr: { fontFamily: 'Amiri_700Bold', fontSize: 28, lineHeight: 50, color: INK, textAlign: 'right', writingDirection: 'rtl', marginTop: 10 },
  roomLatin: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#333333', marginTop: 2 },
  hotelPhoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 44, borderWidth: 2, borderColor: INK, borderRadius: 10, paddingHorizontal: 12 },
  hotelPhoneText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: INK },
  phraseRow: { borderWidth: 1, borderColor: '#999999', borderRadius: 12, padding: 12, marginBottom: 8 },
  phraseRowActive: { borderWidth: 3, borderColor: INK },
  phraseAr: { fontFamily: 'Amiri_700Bold', fontSize: 22, lineHeight: 40, color: INK, textAlign: 'right', writingDirection: 'rtl' },
  phraseLatin: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#333333', fontStyle: 'italic', marginTop: 2 },
  phraseMeaning: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: INK, marginTop: 2 },
});
