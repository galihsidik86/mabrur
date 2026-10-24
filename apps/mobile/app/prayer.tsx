import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../src/theme';
import { api } from '../src/services/api';
import { getMeta, setMeta } from '../src/services/db';
import { getPosition, requestPermission } from '../src/services/location';
import { useI18n, type TranslationKey } from '../src/services/i18n';
import QiblaCompass from '../src/components/QiblaCompass';
import {
  buildSchedule,
  currentSlot,
  nextPrayer,
  qiblaBearing,
  toHijri,
  placeLabel,
  localDateKey,
  type PrayerKey,
} from '../src/services/prayer-core';

const CACHE_KEY = 'prayer_cache';
const TICK_MS = 30_000;
const GRID_COLUMNS = 4;
const GRID_GAP = 10;
const SCREEN_PADDING = 20;

const SLOT_ICONS: Record<PrayerKey, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  fajr: 'weather-night',
  sunrise: 'weather-sunset-up',
  dhuha: 'white-balance-sunny',
  dhuhr: 'weather-sunny',
  asr: 'weather-partly-cloudy',
  maghrib: 'weather-sunset-down',
  isha: 'moon-waning-crescent',
};

interface Coords { lat: number; lng: number }

// Disimpan di sync_meta agar layar tetap berisi saat offline.
interface PrayerCache {
  dateKey: string;
  times: Record<string, string>;
  methodLabel: string | null;
  place: string | null;
  coords: Coords | null;
}

function parseCache(raw: string | null): PrayerCache | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PrayerCache>;
    if (typeof v.dateKey !== 'string' || !buildSchedule(v.times)) return null;
    const coords = v.coords && Number.isFinite(v.coords.lat) && Number.isFinite(v.coords.lng) ? v.coords : null;
    return {
      dateKey: v.dateKey,
      times: v.times as Record<string, string>,
      methodLabel: typeof v.methodLabel === 'string' ? v.methodLabel : null,
      place: typeof v.place === 'string' ? v.place : null,
      coords,
    };
  } catch {
    return null;
  }
}

// Fix GPS akurat bisa lama di dalam gedung; jangan biarkan jadwal menunggu lebih dari ini.
const GPS_TIMEOUT_MS = 8000;

async function locate(): Promise<Coords | null> {
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), GPS_TIMEOUT_MS); });
  const fix = await Promise.race([getPosition(), timeout]);
  clearTimeout(timer);
  if (fix) return { lat: fix.lat, lng: fix.lng };
  return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
}

async function resolvePlace(coords: Coords): Promise<string | null> {
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    return placeLabel(addr);
  } catch {
    return null; // geocoder butuh internet/Play Services — cukup tampilkan koordinat
  }
}

export default function PrayerScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => new Date());
  const [data, setData] = useState<PrayerCache | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const hasDataRef = useRef(false);
  const dayKey = localDateKey(now);

  useEffect(() => { hasDataRef.current = data != null; }, [data]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Muat ulang saat layar dibuka, saat ganti hari, atau saat "Coba lagi".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadFailed(false);
      const cached = parseCache(await getMeta(CACHE_KEY).catch(() => null));
      if (cancelled) return;
      if (cached) setData(cached);

      const granted = await requestPermission().catch(() => false);
      if (cancelled) return;
      setHasPermission(granted);
      const pos = granted ? await locate() : null;
      if (cancelled) return;
      // Tanpa GPS: pakai lokasi terakhir yang tersimpan sebelum jatuh ke Makkah (bawaan server).
      const coords: Coords | null = pos ?? cached?.coords ?? null;
      if (coords) setBearing(qiblaBearing(coords.lat, coords.lng));

      try {
        const [pt, place] = await Promise.all([
          api.getPrayerTimes(coords?.lat, coords?.lng, -new Date().getTimezoneOffset() / 60),
          pos && coords ? resolvePlace(coords) : Promise.resolve(cached?.place ?? null),
        ]);
        if (!buildSchedule(pt?.times)) throw new Error('jadwal salat tidak valid');
        const fresh: PrayerCache = {
          dateKey: dayKey,
          times: pt.times,
          methodLabel: typeof pt.methodLabel === 'string' ? pt.methodLabel : null,
          place,
          coords,
        };
        if (cancelled) return;
        setData(fresh);
        setIsOffline(false);
        setMeta(CACHE_KEY, JSON.stringify(fresh)).catch(() => { /* cache opsional */ });
      } catch {
        if (cancelled) return;
        const hasData = !!cached || hasDataRef.current;
        setIsOffline(hasData);
        setLoadFailed(!hasData);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dayKey, reloadKey]);

  const schedule = data ? buildSchedule(data.times) : null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const current = schedule ? currentSlot(schedule, nowMinutes) : null;
  const next = schedule ? nextPrayer(schedule, nowMinutes) : null;

  const hijri = toHijri(now);
  const hijriText = t('prayer.hijri_date', {
    day: hijri.day,
    month: t(`prayer.hijri_month.${hijri.month}` as TranslationKey),
    year: hijri.year,
  });
  const gregorianText = now.toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  let locationText: string;
  if (data?.place) locationText = data.place;
  else if (data?.coords) locationText = t('prayer.location_coords', { lat: data.coords.lat.toFixed(3), lng: data.coords.lng.toFixed(3) });
  else if (isLoading) locationText = t('prayer.locating');
  else locationText = t('prayer.location_unknown');

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? t('prayer.duration_hm', { h, m }) : t('prayer.duration_m', { m });
  };

  const tileWidth = Math.floor((width - SCREEN_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('prayer.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.dateBlock}>
          <Text style={s.hijri}>{hijriText}</Text>
          <Text style={s.gregorian}>{gregorianText}</Text>
          <View style={s.locationRow}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={s.locationText} numberOfLines={1}>{locationText}</Text>
          </View>
        </View>

        {/* Dipasang ulang setelah izin lokasi diputuskan: sensor heading butuh izin di sebagian perangkat */}
        <QiblaCompass key={String(hasPermission)} bearing={bearing} />

        {isOffline && data && (
          <View style={s.offline}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
            <Text style={s.offlineText}>{t('prayer.offline_cached', { date: data.dateKey })}</Text>
          </View>
        )}

        {schedule && current && next ? (
          <>
            <View style={s.nowCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.nowLabel}>{t('prayer.now')}</Text>
                <Text style={s.nowName}>{t(`prayer.name.${current}`)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[s.nowLabel, { textAlign: 'right' }]}>{t('prayer.next_in', { duration: formatDuration(next.minutesUntil) })}</Text>
                <Text style={s.nowName}>{t(`prayer.name.${next.key}`)}</Text>
              </View>
            </View>

            <View style={s.grid}>
              {schedule.map((slot) => {
                const isCurrent = slot.key === current;
                const isNext = slot.key === next.key;
                const name = t(`prayer.name.${slot.key}`);
                const a11y = t('prayer.slot_label', { name, time: slot.time }) + (isCurrent ? `, ${t('prayer.slot_current')}` : '');
                return (
                  <View
                    key={slot.key}
                    style={[s.tile, { width: tileWidth }, isCurrent && s.tileCurrent, isNext && s.tileNext]}
                    accessible
                    accessibilityLabel={a11y}>
                    <MaterialCommunityIcons name={SLOT_ICONS[slot.key]} size={22} color={isCurrent ? colors.primaryDark : colors.textMuted} />
                    <Text style={[s.tileName, isCurrent && s.tileTextCurrent]} numberOfLines={1}>{name}</Text>
                    <Text style={[s.tileTime, isCurrent && s.tileTextCurrent]}>{slot.time}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={s.footnote}>
              {data?.methodLabel ? `${t('prayer.method', { method: data.methodLabel })}\n` : ''}{t('prayer.dhuha_note')}
            </Text>
          </>
        ) : loadFailed ? (
          <View style={s.stateBox}>
            <Text style={s.stateText}>{t('prayer.load_failed')}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setReloadKey((k) => k + 1)} accessibilityRole="button">
              <Text style={s.retryText}>{t('prayer.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.stateBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.stateText}>{t('prayer.loading')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 40 },
  dateBlock: { alignItems: 'center', marginBottom: 18 },
  hijri: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primaryDark, textAlign: 'center' },
  gregorian: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, maxWidth: '90%' },
  locationText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary },
  offline: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18,
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  offlineText: { flex: 1, fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
  nowCard: {
    flexDirection: 'row', marginTop: 22, padding: 16, borderRadius: 16,
    backgroundColor: colors.goldLight, borderWidth: 1.5, borderColor: colors.gold,
  },
  nowLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  nowName: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primaryDark, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: 14 },
  tile: {
    alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tileCurrent: { backgroundColor: colors.goldLight, borderColor: colors.gold, borderWidth: 2 },
  tileNext: { borderColor: colors.primary, borderWidth: 1.5 },
  tileName: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  tileTime: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  tileTextCurrent: { color: colors.primaryDark, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  footnote: { marginTop: 16, fontSize: 11, lineHeight: 17, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, textAlign: 'center' },
  stateBox: { alignItems: 'center', gap: 12, marginTop: 28, paddingHorizontal: 12 },
  stateText: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 10 },
  retryText: { color: colors.textOnPrimary, fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});
