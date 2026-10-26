import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../theme';
import { useI18n, type TranslationKey } from '../services/i18n';
import { headingDelta, nextAligned, smoothHeading } from '../services/prayer-core';

type Props = { bearing: number | null };

const SIZE = 260;
const CENTER = SIZE / 2;
const DIAL_RADIUS = 105;
// Bila tidak ada satu pun bacaan heading dalam waktu ini, anggap perangkat tak punya kompas.
const NO_COMPASS_TIMEOUT_MS = 4000;
// expo-location: accuracy 0–3 (3 = terkalibrasi baik).
const LOW_ACCURACY = 1;

const DIRECTIONS: Array<{ key: TranslationKey; angle: number }> = [
  { key: 'prayer.dir_n', angle: 0 },
  { key: 'prayer.dir_e', angle: 90 },
  { key: 'prayer.dir_s', angle: 180 },
  { key: 'prayer.dir_w', angle: 270 },
];

// Kompas kiblat besar: penanda tetap di atas = arah hadap HP; panah berputar = arah kiblat.
// Keduanya sejajar → "Tepat". Heading dihaluskan supaya panah tidak bergetar.
export default function QiblaCompass({ bearing }: Props) {
  const t = useI18n((st) => st.t);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hasCompass, setHasCompass] = useState(true);
  const [aligned, setAligned] = useState(false);
  const bearingRef = useRef(bearing);
  const headingRef = useRef<number | null>(null);

  useEffect(() => {
    bearingRef.current = bearing;
    const h = headingRef.current;
    if (bearing != null && h != null) setAligned((prev) => nextAligned(prev, headingDelta(bearing, h)));
  }, [bearing]);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let received = false;
    const timer = setTimeout(() => { if (!received && !cancelled) setHasCompass(false); }, NO_COMPASS_TIMEOUT_MS);

    (async () => {
      try {
        const s = await Location.watchHeadingAsync((h) => {
          received = true;
          // trueHeading = -1 bila deklinasi belum tersedia → pakai magHeading.
          const raw = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          const next = smoothHeading(headingRef.current, raw);
          headingRef.current = next;
          setHeading(next);
          setAccuracy(h.accuracy);
          setHasCompass(true);
          const b = bearingRef.current;
          if (b != null) setAligned((was) => nextAligned(was, headingDelta(b, next)));
        });
        if (cancelled) s.remove(); else sub = s;
      } catch {
        if (!cancelled) setHasCompass(false);
      }
    })();

    return () => { cancelled = true; clearTimeout(timer); sub?.remove(); };
  }, []);

  const delta = bearing != null && heading != null ? headingDelta(bearing, heading) : null;
  const ringColor = aligned ? colors.green : colors.gold;
  const pointerColor = aligned ? colors.green : colors.primary;
  const deg = bearing != null ? Math.round(bearing) : null;

  let hint: string;
  if (deg == null) hint = t('prayer.waiting_gps');
  else if (!hasCompass) hint = t('prayer.no_compass', { deg });
  else if (delta == null) hint = t('prayer.qibla_degrees', { deg });
  else if (aligned) hint = t('prayer.hint_aligned');
  else if (delta > 0) hint = t('prayer.hint_turn_right', { deg: Math.round(delta) });
  else hint = t('prayer.hint_turn_left', { deg: Math.round(-delta) });

  return (
    <View style={s.wrap}>
      <View
        // Cahaya hanya saat menghadap kiblat: penanda keadaan "pas", bukan hiasan permanen.
        style={[s.ring, { borderColor: ringColor }, aligned && { shadowColor: ringColor, ...s.ringGlow }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('prayer.compass_label')}>
        {/* Piringan arah mata angin, berputar berlawanan dengan arah hadap HP */}
        <View style={[s.layer, { transform: [{ rotate: `${-(heading ?? 0)}deg` }] }]}>
          {DIRECTIONS.map((d) => {
            const a = (d.angle * Math.PI) / 180;
            return (
              <Text key={d.key} style={[s.cardinal, d.angle === 0 && s.cardinalNorth, {
                left: CENTER + DIAL_RADIUS * Math.sin(a) - 12,
                top: CENTER - DIAL_RADIUS * Math.cos(a) - 10,
                transform: [{ rotate: `${heading ?? 0}deg` }],
              }]}>{t(d.key)}</Text>
            );
          })}
        </View>

        {/* Panah kiblat: rotasi 0 saat HP tepat menghadap kiblat */}
        {delta != null && hasCompass && (
          <View style={[s.layer, { transform: [{ rotate: `${delta}deg` }] }]}>
            <View style={[s.pointerTip, { borderBottomColor: pointerColor }]} />
            <View style={[s.pointerStem, { backgroundColor: pointerColor }]} />
          </View>
        )}

        {/* Penanda tetap = arah hadap HP */}
        <View style={[s.notch, { borderTopColor: ringColor }]} />

        <View style={[s.hub, { borderColor: ringColor }]}>
          <Text style={s.kaaba}>🕋</Text>
        </View>
      </View>

      <View style={[s.badge, aligned ? s.badgeOn : s.badgeOff]} accessibilityLiveRegion="polite">
        {aligned ? (
          <>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={s.badgeTextOn}>{t('prayer.aligned')}</Text>
          </>
        ) : (
          <Text style={s.badgeTextOff}>{deg != null ? `${deg}°` : '—'}</Text>
        )}
      </View>
      <Text style={s.hint}>{hint}</Text>
      {hasCompass && accuracy != null && accuracy <= LOW_ACCURACY && (
        <View style={s.calibrate}>
          <Ionicons name="infinite" size={16} color={colors.textSecondary} />
          <Text style={s.calibrateText}>{t('prayer.calibrate')}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  ring: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 10,
    backgroundColor: '#FFFBF0', alignItems: 'center', justifyContent: 'center',
  },
  ringGlow: { shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  // Lapisan berputar seukuran cincin luar (offset -10 = tebal border cincin).
  layer: { position: 'absolute', top: -10, left: -10, width: SIZE, height: SIZE, alignItems: 'center' },
  cardinal: { position: 'absolute', width: 24, textAlign: 'center', fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  cardinalNorth: { color: colors.primary, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  pointerTip: {
    marginTop: 40, width: 0, height: 0,
    borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 30,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  pointerStem: { width: 8, height: 46, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  notch: {
    position: 'absolute', top: -2, width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 16,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  hub: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 6, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  kaaba: { fontSize: 38 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  badgeOn: { backgroundColor: colors.green },
  badgeOff: { backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.gold },
  badgeTextOn: { color: '#fff', fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  badgeTextOff: { color: colors.textSecondary, fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  hint: { marginTop: 10, paddingHorizontal: 24, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  calibrate: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginHorizontal: 20,
    backgroundColor: colors.surfaceWarm, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  calibrateText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
});
