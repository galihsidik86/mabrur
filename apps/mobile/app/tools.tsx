import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Vibration, Dimensions, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import CurrencyConverter from '../src/components/CurrencyConverter';
import PhrasesList from '../src/components/PhrasesList';
import { requestPermission } from '../src/services/location';
import {
  TawafTracker, SaiTracker, detectNearestJamarat,
  watchSacredLocation, checkArafahPosition, distanceMetersExport,
  KAABAH, SAFA, MARWAH, ARAFAH_CENTER,
  type SaiZone, type ArafahResult,
} from '../src/services/sacred-zones';
import { sendLocalNotification } from '../src/services/notification';
import { isBarometerAvailable, watchFloor } from '../src/services/floor';
import { startRecording, stopRecording, uploadSession, isRecording } from '../src/services/trace-recorder';
import { useI18n, type TranslationKey } from '../src/services/i18n';
import { useAuthStore } from '../src/stores/auth';
import { canUseResearchTools } from '../src/services/research-access';
import StateNotice from '../src/components/StateNotice';
import DateTimeField from '../src/components/DateTimeField';
import type { TFunction } from '../src/services/i18n';

// Izin lokasi ditolak: jelaskan sebabnya dan beri jalan ke Pengaturan, jangan diam saja.
function alertLocationDenied(t: TFunction) {
  Alert.alert(t('monitor.perm_title'), t('monitor.perm_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('monitor.open_settings'), onPress: () => Linking.openSettings() },
  ]);
}

const TABS = ['hub', 'tawaf', 'sai', 'tasbih', 'jumrah', 'wukuf', 'checklist', 'kurs', 'frasa', 'kesehatan'] as const;
type Tab = typeof TABS[number];

// ?tab=frasa dari pintasan beranda; nilai tak dikenal → hub.
function initialTab(param: unknown): Tab {
  return TABS.find((x) => x === param) ?? 'hub';
}

const { width: W } = Dimensions.get('window');

// ==================== RING COUNTER ====================
function RingCounter({ count, target, onTap, label, arabic, subtitle }: {
  count: number; target: number; onTap: () => void; label: string; arabic?: string; subtitle?: string;
}) {
  const t = useI18n((st) => st.t);
  const pct = Math.min(count / target, 1);
  const done = count >= target;
  return (
    <View style={{ alignItems: 'center', marginTop: 16 }}>
      {arabic && <Text style={rc.arabic}>{arabic}</Text>}
      {subtitle && <Text style={rc.subtitle}>{subtitle}</Text>}
      <TouchableOpacity style={rc.ring} onPress={onTap} activeOpacity={0.7} disabled={done}>
        <View style={[rc.progress, { height: `${pct * 100}%`, backgroundColor: done ? colors.green : colors.primary }]} />
        <View style={rc.inner}>
          <Text style={[rc.num, done && { color: colors.green }]}>{count}</Text>
          <Text style={rc.target}>/ {target}</Text>
        </View>
      </TouchableOpacity>
      <Text style={rc.label}>{label}</Text>
      {done && (
        <View style={rc.doneBox}>
          <Ionicons name="checkmark-circle" size={22} color={colors.green} />
          <Text style={rc.doneText}>{t('tools.done_alhamdulillah')}</Text>
        </View>
      )}
    </View>
  );
}

const rc = StyleSheet.create({
  arabic: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4, writingDirection: 'rtl' },
  subtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginBottom: 12 },
  ring: { width: 180, height: 180, borderRadius: 999, borderWidth: 5, borderColor: colors.border, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' },
  progress: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.15 },
  inner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 52, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary },
  target: { fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: -6 },
  label: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, marginTop: 12 },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: colors.greenLight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  doneText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.greenDark },
});

// ==================== TAWAF (GPS-ASSISTED) ====================
function TawafSaiTab({ type }: { type: 'tawaf' | 'sai' }) {
  const t = useI18n((st) => st.t);
  const [count, setCount] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [saiZone, setSaiZone] = useState<SaiZone>('between');
  const [floorNumber, setFloorNumber] = useState<number | null>(null);
  const floorLabel = floorNumber == null ? '' : floorNumber >= 3 ? t('tools.floor.roof')
    : floorNumber === 0 ? t('tools.floor.ground') : t('tools.floor.n', { n: floorNumber });
  const trackerRef = useRef<TawafTracker | SaiTracker | null>(null);
  const watchRef = useRef<{ remove: () => void } | null>(null);
  const floorWatchRef = useRef<{ remove: () => void } | null>(null);
  const autoRecRef = useRef<number | null>(null); // sesi rekam trace (uji akurasi)

  // Stop rekam trace lalu coba unggah; bila gagal (offline) sesi tetap tersimpan
  // di SQLite dan diunggah otomatis saat app kembali aktif (retryPendingUploads).
  const finishAutoRecording = () => {
    const recId = autoRecRef.current;
    autoRecRef.current = null;
    if (recId != null) stopRecording().then(() => uploadSession(recId)).catch(() => {});
  };

  const label = type === 'tawaf' ? t('tools.counter.tawaf_label') : t('tools.counter.sai_label');
  const direction = type === 'sai'
    ? (count % 2 === 0 ? 'Shafa → Marwah' : 'Marwah → Shafa')
    : t('tools.counter.round', { n: count + 1 });

  useEffect(() => {
    activateKeepAwakeAsync('counter');
    return () => { deactivateKeepAwake('counter'); watchRef.current?.remove(); floorWatchRef.current?.remove(); finishAutoRecording(); };
  }, []);

  const startAuto = async () => {
    if (autoMode) return; // sudah aktif — cegah watcher/barometer ganda saat tombol ditekan lagi
    const granted = await requestPermission();
    if (!granted) { setGpsStatus(t('tools.gps.permission_denied')); return; }

    // Defensif terhadap tap-ganda cepat (dua panggilan lolos guard sebelum state commit):
    // buang langganan lama sebelum memasang yang baru.
    watchRef.current?.remove(); watchRef.current = null;
    floorWatchRef.current?.remove(); floorWatchRef.current = null;

    setAutoMode(true);
    setGpsStatus(t('tools.gps.searching'));

    // Rekam trace mentah (lat/lng/akurasi) ke SQLite lokal untuk uji akurasi —
    // diunggah otomatis ke server saat Stop, tanpa perlu buka menu Record.
    try {
      if (!isRecording()) {
        autoRecRef.current = await startRecording(type === 'tawaf' ? 'Tawaf (auto)' : "Sa'i (auto)", () => {});
      }
    } catch { autoRecRef.current = null; }

    if (type === 'tawaf') {
      // Mode adaptif: band radius menyesuaikan lantai (dasar/1/atap), tak lagi
      // terkunci 10–80 m. Barometer memberi info lantai bila tersedia.
      const tracker = new TawafTracker({ adaptive: true });
      tracker.onChange = (rounds) => {
        setCount(rounds);
        Vibration.vibrate([0, 200, 100, 200]);
      };
      trackerRef.current = tracker;

      if (await isBarometerAvailable()) {
        floorWatchRef.current = watchFloor((est) => setFloorNumber(est.floor));
      }

      watchRef.current = watchSacredLocation((lat, lng) => {
        tracker.update(lat, lng);
        // Jarak yang sama (Haversine) dengan yang dipakai algoritma penghitung.
        const dist = Math.round(distanceMetersExport(lat, lng, KAABAH.lat, KAABAH.lng));
        const r = tracker.getRadius();
        setGpsStatus(t('tools.tawaf.gps_status', { dist }) + (r ? t('tools.tawaf.gps_radius', { r }) : ''));
      });
    } else {
      const tracker = new SaiTracker();
      tracker.onChange = (legs, zone) => {
        setCount(legs);
        setSaiZone(zone);
        Vibration.vibrate([0, 200, 100, 200]);
      };
      trackerRef.current = tracker;

      watchRef.current = watchSacredLocation((lat, lng) => {
        tracker.update(lat, lng);
        const dS = Math.round(distanceMetersExport(lat, lng, SAFA.lat, SAFA.lng));
        const dM = Math.round(distanceMetersExport(lat, lng, MARWAH.lat, MARWAH.lng));
        setGpsStatus(`Safa: ${dS}m · Marwah: ${dM}m`);
      });
    }
  };

  const stopAuto = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    floorWatchRef.current?.remove();
    floorWatchRef.current = null;
    finishAutoRecording();
    setAutoMode(false);
    setGpsStatus('');
    setFloorNumber(null);
  };

  return (
    <View style={tc.wrap}>
      {/* Mode toggle */}
      <View style={tc.modeToggle}>
        <TouchableOpacity
          style={[tc.modeToggleBtn, !autoMode && tc.modeToggleBtnActive]}
          onPress={stopAuto}>
          <Ionicons name="hand-left" size={16} color={!autoMode ? '#fff' : colors.textMuted} />
          <Text style={[tc.modeToggleText, !autoMode && { color: '#fff' }]}>{t('tools.mode.manual')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tc.modeToggleBtn, autoMode && tc.modeToggleBtnActive]}
          onPress={startAuto}>
          <Ionicons name="navigate" size={16} color={autoMode ? '#fff' : colors.textMuted} />
          <Text style={[tc.modeToggleText, autoMode && { color: '#fff' }]}>{t('tools.mode.auto')}</Text>
        </TouchableOpacity>
      </View>

      {autoMode && gpsStatus ? (
        <View style={tc.gpsBar}>
          <View style={tc.gpsDot} />
          <Text style={tc.gpsText}>{gpsStatus}</Text>
        </View>
      ) : null}

      {autoMode && type === 'tawaf' && floorLabel ? (
        <View style={[tc.zoneIndicator, { backgroundColor: colors.surfaceWarm }]}>
          <Ionicons name="layers-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary }}>
            {floorLabel}
          </Text>
        </View>
      ) : null}

      {autoMode && type === 'sai' && saiZone !== 'between' ? (
        <View style={[tc.zoneIndicator, { backgroundColor: saiZone === 'safa' ? colors.greenLight : colors.goldLight }]}>
          <Ionicons name="location" size={16} color={saiZone === 'safa' ? colors.greenDark : colors.goldText} />
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: saiZone === 'safa' ? colors.greenDark : colors.goldText }}>
            {saiZone === 'safa' ? t('tools.sai.at_safa') : t('tools.sai.at_marwah')}
          </Text>
        </View>
      ) : null}

      <RingCounter count={count} target={7} label={label}
        arabic={type === 'tawaf' ? 'طَوَاف' : 'سَعْي'}
        subtitle={count < 7 ? direction : undefined}
        onTap={() => {
          if (autoMode) return; // auto mode handles counting
          if (count < 7) { setCount(count + 1); Vibration.vibrate(50); if (count + 1 >= 7) Vibration.vibrate([0, 200, 100, 200]); }
        }}
      />

      {autoMode && (
        <Text style={tc.autoHint}>
          {type === 'tawaf'
            ? t('tools.tawaf.auto_hint')
            : t('tools.sai.auto_hint')}
        </Text>
      )}

      <View style={tc.btns}>
        <TouchableOpacity style={tc.undoBtn} onPress={() => setCount(Math.max(0, count - 1))}>
          <Ionicons name="arrow-undo" size={18} color={colors.textMuted} /><Text style={tc.undoBtnText}>{t('tools.undo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tc.undoBtn} onPress={() => { setCount(0); if (type === 'tawaf' && trackerRef.current instanceof TawafTracker) trackerRef.current.reset(); if (type === 'sai' && trackerRef.current instanceof SaiTracker) trackerRef.current.reset(); }}>
          <Ionicons name="refresh" size={18} color={colors.textMuted} /><Text style={tc.undoBtnText}>{t('tools.reset')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== TASBIH (6 MODE) ====================
const TASBIH_MODES = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', latin: 'Subhanallah', meaningKey: 'tools.tasbih.subhanallah', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', latin: 'Alhamdulillah', meaningKey: 'tools.tasbih.alhamdulillah', target: 33 },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', latin: 'Allahu Akbar', meaningKey: 'tools.tasbih.allahuakbar', target: 33 },
  { id: 'lailaha', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', latin: 'La ilaha illallah', meaningKey: 'tools.tasbih.lailaha', target: 100 },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', latin: 'Allahumma shalli ala Muhammad', meaningKey: 'tools.tasbih.salawat', target: 100 },
  { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ', latin: 'Astaghfirullah', meaningKey: 'tools.tasbih.istighfar', target: 100 },
] as const satisfies ReadonlyArray<{ id: string; arabic: string; latin: string; meaningKey: TranslationKey; target: number }>;

function TasbihTab() {
  const t = useI18n((st) => st.t);
  const [mode, setMode] = useState(0);
  const [counts, setCounts] = useState(TASBIH_MODES.map(() => 0));
  const m = TASBIH_MODES[mode];

  useEffect(() => { activateKeepAwakeAsync('tasbih'); return () => { deactivateKeepAwake('tasbih'); }; }, []);

  const tap = () => {
    if (counts[mode] >= m.target) return; // sudah selesai — jangan getar berulang
    const next = [...counts];
    next[mode]++;
    setCounts(next);
    // Getar "selesai" hanya tepat saat mencapai target; selain itu getar biasa.
    Vibration.vibrate(next[mode] >= m.target ? [0, 200, 100, 200] : 30);
  };

  return (
    <View style={tc.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
        {TASBIH_MODES.map((tm, i) => (
          <TouchableOpacity key={tm.id} onPress={() => setMode(i)}
            style={[tc.modeBtn, mode === i && tc.modeBtnActive]}>
            <Text style={[tc.modeBtnText, mode === i && { color: '#fff' }]}>{tm.latin.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <RingCounter count={counts[mode]} target={m.target} onTap={tap}
        arabic={m.arabic} subtitle={t(m.meaningKey)} label={m.latin} />

      {/* Progress grid */}
      <View style={tc.grid}>
        {TASBIH_MODES.map((tm, i) => (
          <View key={tm.id} style={[tc.gridItem, counts[i] >= tm.target && { borderColor: colors.green }]}>
            <Text style={[tc.gridNum, counts[i] >= tm.target && { color: colors.green }]}>{counts[i]}/{tm.target}</Text>
            <Text style={tc.gridLabel}>{tm.latin.split(' ')[0]}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={tc.undoBtn} onPress={() => { const n = [...counts]; n[mode] = Math.max(0, n[mode] - 1); setCounts(n); }}>
        <Ionicons name="arrow-undo" size={16} color={colors.textMuted} /><Text style={tc.undoBtnText}>{t('tools.undo')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==================== JUMRAH (4 hari × 3 jamarat × 7 batu) ====================
const JAMARAT = [
  { nameKey: 'tools.jumrah.ula', arabic: 'الجمرة الأولى' },
  { nameKey: 'tools.jumrah.wustha', arabic: 'الجمرة الوسطى' },
  { nameKey: 'tools.jumrah.aqabah', arabic: 'جمرة العقبة' },
] as const satisfies ReadonlyArray<{ nameKey: TranslationKey; arabic: string }>;

function JumrahTab() {
  const t = useI18n((st) => st.t);
  const [day, setDay] = useState(0);
  const [stones, setStones] = useState(() =>
    Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => 0))
  );
  const [nearestJam, setNearestJam] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const watchRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    activateKeepAwakeAsync('jumrah');
    return () => { deactivateKeepAwake('jumrah'); watchRef.current?.remove(); };
  }, []);

  const startAutoJumrah = async () => {
    const granted = await requestPermission();
    if (!granted) { alertLocationDenied(t); return; }
    setAutoMode(true);
    watchRef.current = watchSacredLocation((lat, lng) => {
      const nearest = detectNearestJamarat(lat, lng);
      if (nearest) {
        setNearestJam(`${t('tools.jumrah.near', { name: t(`tools.jumrah.${nearest.key}`), distance: nearest.distance })}`);
      } else {
        setNearestJam(null);
      }
    });
  };

  const throwStone = (j: number) => {
    const next = stones.map((d) => [...d]);
    if (next[day][j] < 7) { next[day][j]++; setStones(next); Vibration.vibrate(80); }
    if (next[day][j] >= 7) Vibration.vibrate([0, 150, 80, 150]);
  };

  const dayLabels = [10, 11, 12, 13].map((d) => t('tools.jumrah.date', { d }));
  const jams = day === 0 ? [2] : [0, 1, 2]; // Day 1: only Aqabah

  return (
    <View style={tc.wrap}>
      {/* Auto GPS toggle */}
      {!autoMode ? (
        <TouchableOpacity style={[tc.modeToggleBtn, { alignSelf: 'center', marginBottom: 12 }]} onPress={startAutoJumrah}>
          <Ionicons name="navigate" size={14} color={colors.textMuted} />
          <Text style={tc.modeToggleText}>{t('tools.jumrah.auto_enable')}</Text>
        </TouchableOpacity>
      ) : nearestJam ? (
        <View style={[tc.gpsBar, { backgroundColor: colors.goldLight }]}>
          <Text style={[tc.gpsText, { color: colors.goldText }]}>{nearestJam}</Text>
        </View>
      ) : (
        <View style={tc.gpsBar}><View style={tc.gpsDot} /><Text style={tc.gpsText}>{t('tools.jumrah.detecting')}</Text></View>
      )}

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {dayLabels.map((d, i) => (
          <TouchableOpacity key={i} onPress={() => setDay(i)}
            style={[tc.modeBtn, day === i && tc.modeBtnActive, { paddingHorizontal: 14 }]}>
            <Text style={[tc.modeBtnText, day === i && { color: '#fff' }]}>{t('tools.jumrah.day', { n: i + 1 })}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, textAlign: 'center', marginBottom: 12 }}>{dayLabels[day]}</Text>

      {jams.map((j) => {
        const c = stones[day][j];
        const done = c >= 7;
        return (
          <View key={j} style={[jm.card, done && { borderColor: colors.green }]}>
            <View style={jm.header}>
              <View>
                <Text style={jm.name}>{t(JAMARAT[j].nameKey)}</Text>
                <Text style={jm.arabic}>{JAMARAT[j].arabic}</Text>
              </View>
              {done && <Ionicons name="checkmark-circle" size={24} color={colors.green} />}
            </View>
            <View style={jm.pips}>
              {Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={[jm.pip, i < c && jm.pipFilled]} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[jm.throwBtn, done && { backgroundColor: colors.greenLight }]}
                onPress={() => throwStone(j)} disabled={done} activeOpacity={0.7}>
                <Text style={[jm.throwText, done && { color: colors.greenDark }]}>
                  {done ? t('tools.jumrah.done') : t('tools.jumrah.throw', { count: c })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { const n = stones.map((d) => [...d]); n[day][j] = Math.max(0, n[day][j] - 1); setStones(n); }}
                style={{ padding: 14 }} accessibilityRole="button" accessibilityLabel={t('a11y.undo_stone')}>
                <Ionicons name="arrow-undo" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const jm = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  arabic: { fontSize: 16, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  pips: { flexDirection: 'row', gap: 8, marginVertical: 12, justifyContent: 'center' },
  pip: { width: 28, height: 28, borderRadius: 999, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg },
  pipFilled: { backgroundColor: colors.gold, borderColor: colors.gold },
  throwBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  throwText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});

// ==================== WUKUF TIMER + ARAFAH GEOFENCE ====================
function WukufTab() {
  const t = useI18n((st) => st.t);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [phase, setPhase] = useState<'setup' | 'waiting' | 'active' | 'done'>('setup');
  const [arafah, setArafah] = useState<ArafahResult | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const watchRef2 = useRef<{ remove: () => void } | null>(null);
  const lastNotifRef = useRef(0);

  useEffect(() => {
    if (!start || !end) return;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    // Guard input tak valid: cegah countdown "SELESAI" palsu bila waktu salah ketik.
    if (!isFinite(s) || !isFinite(e) || e <= s) { setPhase('setup'); setRemaining(null); return; }
    const timer = setInterval(() => {
      const now = Date.now();
      if (now < s) { setPhase('waiting'); setRemaining(s - now); }
      else if (now < e) { setPhase('active'); setRemaining(e - now); activateKeepAwakeAsync('wukuf'); }
      else { setPhase('done'); setRemaining(0); deactivateKeepAwake('wukuf'); clearInterval(timer); }
    }, 1000);
    return () => { clearInterval(timer); deactivateKeepAwake('wukuf'); };
  }, [start, end]);

  const startAreaTracking = async () => {
    const granted = await requestPermission();
    if (!granted) { alertLocationDenied(t); return; }
    setGpsActive(true);
    watchRef2.current = watchSacredLocation((lat, lng) => {
      const result = checkArafahPosition(lat, lng);
      setArafah(result);
      // Kirim notifikasi jika di luar Arafah (cooldown 3 menit)
      if (result.status === 'outside' || result.status === 'namirah_danger') {
        const now = Date.now();
        if (now - lastNotifRef.current > 3 * 60 * 1000) {
          lastNotifRef.current = now;
          sendLocalNotification(
            result.status === 'outside' ? t('tools.wukuf.notif_outside') : t('tools.wukuf.notif_namirah'),
            t(`tools.wukuf.msg_${result.status}`),
          );
          Vibration.vibrate([0, 500, 200, 500]);
        }
      }
    });
  };

  useEffect(() => { return () => { watchRef2.current?.remove(); }; }, []);

  const fmt = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s2 = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s2.toString().padStart(2, '0')}`;
  };

  const statusColor = arafah?.status === 'inside' ? colors.green
    : arafah?.status === 'namirah_danger' ? colors.gold
    : arafah?.status === 'outside' ? colors.danger : colors.textMuted;

  const statusIcon = arafah?.status === 'inside' ? 'checkmark-circle'
    : arafah?.status === 'namirah_danger' ? 'warning'
    : arafah?.status === 'outside' ? 'alert-circle' : 'location';

  if (phase === 'setup') {
    return (
      <View style={tc.wrap}>
        <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, textAlign: 'center' }}>{t('tools.wukuf.title')}</Text>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
          {t('tools.wukuf.intro')}
        </Text>

        {/* Area Monitor */}
        {!gpsActive ? (
          <TouchableOpacity style={[tc.primaryBtn, { marginTop: 20 }]} onPress={startAreaTracking}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={[tc.primaryBtnText, { marginLeft: 6 }]}>{t('tools.wukuf.check_position')}</Text>
          </TouchableOpacity>
        ) : arafah ? (
          <View style={[wk.areaCard, { borderColor: statusColor }]}>
            <View style={wk.areaHeader}>
              <Ionicons name={statusIcon as any} size={24} color={statusColor} />
              <Text style={[wk.areaStatus, { color: statusColor }]}>
                {arafah.status === 'inside' ? t('tools.wukuf.status_inside') : arafah.status === 'namirah_danger' ? t('tools.wukuf.status_warning') : t('tools.wukuf.status_outside')}
              </Text>
            </View>
            <Text style={wk.areaMessage}>{t(`tools.wukuf.msg_${arafah.status}`)}</Text>
            <View style={wk.areaStats}>
              <Text style={wk.areaStat}>{t('tools.wukuf.stat_jabal', { km: (arafah.distToCenter / 1000).toFixed(1) })}</Text>
              <Text style={wk.areaStat}>{t('tools.wukuf.stat_namirah', { m: Math.round(arafah.distToNamirah) })}</Text>
            </View>
          </View>
        ) : (
          <View style={tc.gpsBar}><View style={tc.gpsDot} /><Text style={tc.gpsText}>{t('tools.gps.searching')}</Text></View>
        )}

        <View style={{ marginTop: 10 }}>
          <DateTimeField label={t('tools.wukuf.start_label')} value={start} onChange={setStart} />
          <DateTimeField label={t('tools.wukuf.end_label')} value={end} onChange={setEnd} />
        </View>
        <TouchableOpacity style={[tc.primaryBtn, { marginTop: 16 }]} onPress={() => {
          const s = new Date(start).getTime(), e = new Date(end).getTime();
          if (!start || !end || !isFinite(s) || !isFinite(e) || e <= s) {
            Alert.alert(t('tools.wukuf.invalid_title'), t('tools.wukuf.invalid_body'));
            return;
          }
          setPhase('waiting'); if (!gpsActive) startAreaTracking();
        }}>
          <Text style={tc.primaryBtnText}>{t('tools.wukuf.start_countdown')}</Text>
        </TouchableOpacity>

        {/* Info penting */}
        <View style={wk.infoBox}>
          <Text style={wk.infoTitle}>{t('tools.wukuf.info_title')}</Text>
          <Text style={wk.infoText}>• {t('tools.wukuf.info_1')}</Text>
          <Text style={wk.infoText}>• {t('tools.wukuf.info_2')}</Text>
          <Text style={wk.infoText}>• {t('tools.wukuf.info_3')}</Text>
          <Text style={wk.infoText}>• {t('tools.wukuf.info_4')}</Text>
        </View>
      </View>
    );
  }

  // Teks putih di atas emas hanya 2,29:1 — fase aktif pakai zamrud tua, emas jadi garis aksen saja.
  const bgColor = phase === 'active' ? colors.primaryDark : phase === 'done' ? colors.greenDark : colors.primary;

  return (
    <View style={[tc.wrap, { alignItems: 'center' }]}>
      {/* Area status during wukuf */}
      {arafah && phase === 'active' && (
        <View style={[wk.areaCard, { borderColor: statusColor, marginBottom: 12 }]}>
          <View style={wk.areaHeader}>
            <Ionicons name={statusIcon as any} size={22} color={statusColor} />
            <Text style={[wk.areaStatus, { color: statusColor, fontSize: 13 }]}>
              {arafah.status === 'inside' ? t('tools.wukuf.status_inside') : arafah.status === 'namirah_danger' ? t('tools.wukuf.status_warning') : t('tools.wukuf.status_outside')}
            </Text>
          </View>
          {arafah.status !== 'inside' && <Text style={[wk.areaMessage, { fontSize: 12 }]}>{t(`tools.wukuf.msg_${arafah.status}`)}</Text>}
        </View>
      )}

      <View style={[wk.hero, { backgroundColor: bgColor }, phase === 'active' && wk.heroActive]}>
        <Text style={wk.heroLabel}>
          {phase === 'waiting' ? t('tools.wukuf.hero_waiting') : phase === 'active' ? t('tools.wukuf.hero_active') : t('tools.wukuf.hero_done')}
        </Text>
        <Text style={wk.heroTime}>{remaining != null ? fmt(remaining) : '--:--:--'}</Text>
        <Text style={wk.heroSub}>
          {phase === 'waiting' ? t('tools.wukuf.sub_waiting') : phase === 'active' ? t('tools.wukuf.sub_active') : t('tools.wukuf.sub_done')}
        </Text>
      </View>
      <TouchableOpacity onPress={() => { setPhase('setup'); setStart(''); setEnd(''); watchRef2.current?.remove(); setGpsActive(false); setArafah(null); }}>
        <Text style={tc.resetText}>{t('tools.reset')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const wk = StyleSheet.create({
  hero: { width: '100%', borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 16 },
  heroActive: { borderWidth: 3, borderColor: colors.gold },
  heroLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.5, color: 'rgba(255,255,255,0.8)' },
  heroTime: { fontSize: 48, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginTop: 8 },
  heroSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.9)', marginTop: 8 },

  areaCard: { width: '100%', borderWidth: 2, borderRadius: 14, padding: 14, backgroundColor: colors.card, marginTop: 12 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaStatus: { fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  areaMessage: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, marginTop: 8, lineHeight: 19 },
  areaStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  areaStat: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },

  infoBox: { marginTop: 20, backgroundColor: colors.surfaceWarm, borderRadius: 12, padding: 14 },
  infoTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, marginBottom: 8 },
  infoText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, lineHeight: 20 },
});

// ==================== CHECKLIST / KURS / FRASA / HEALTH (same as before, condensed) ====================
function ChecklistTab() {
  const t = useI18n((st) => st.t);
  const [items, setItems] = useState<any[]>([]); const [newText, setNewText] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const load = useCallback(async () => {
    try { setItems(await api.getChecklist()); setStatus('ready'); } catch { setStatus('failed'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const done = items.filter((i: any) => i.checked).length;
  if (status !== 'ready' && items.length === 0) {
    return (
      <StateNotice
        kind={status === 'loading' ? 'loading' : 'error'}
        message={status === 'loading' ? t('common.loading') : t('common.load_failed')}
        actionLabel={status === 'failed' ? t('common.retry') : undefined}
        onAction={() => { setStatus('loading'); load(); }}
      />
    );
  }
  return (
    <View style={tc.wrap}>
      {items.length > 0 && <Text style={tc.checkProgress}>{t('tools.checklist.progress', { done, total: items.length })}</Text>}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput style={[tc.input, { flex: 1 }]} value={newText} onChangeText={setNewText} placeholder={t('tools.checklist.add_placeholder')} placeholderTextColor={colors.textFaint} />
        <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button" accessibilityLabel={t('a11y.checklist_add')}
          onPress={async () => { if (!newText.trim()) return; try { await api.addChecklist(newText.trim()); setNewText(''); load(); } catch { Alert.alert(t('tools.checklist.save_fail_title'), t('tools.checklist.save_fail_body')); } }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {items.map((item: any) => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={async () => { try { await api.toggleChecklist(item.id, !item.checked); load(); } catch { Alert.alert(t('tools.checklist.fail_title'), t('tools.checklist.toggle_fail')); } }}>
            <Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={22} color={item.checked ? colors.green : colors.textFaint} />
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: item.checked ? colors.textMuted : colors.text, textDecorationLine: item.checked ? 'line-through' : 'none' }}>{item.text}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button" accessibilityLabel={t('a11y.checklist_delete', { item: item.text })}
            onPress={() => Alert.alert(t('tools.checklist.delete_confirm'), item.text, [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('tools.checklist.delete'), style: 'destructive', onPress: async () => { try { await api.deleteChecklist(item.id); load(); } catch { Alert.alert(t('tools.checklist.fail_title'), t('tools.checklist.delete_fail')); } } },
            ])}>
            <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      ))}
      {items.length === 0 && <Text style={tc.emptyHint}>{t('tools.checklist.empty')}</Text>}
    </View>
  );
}

function HealthTab() {
  const t = useI18n((st) => st.t);
  const [tips, setTips] = useState<any[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const load = useCallback(() => {
    setStatus('loading');
    api.getHealthTips().then((d) => { setTips(d); setStatus('ready'); }).catch(() => setStatus('failed'));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (tips.length === 0) {
    return (
      <StateNotice
        kind={status === 'loading' ? 'loading' : status === 'failed' ? 'error' : 'empty'}
        message={status === 'loading' ? t('common.loading') : status === 'failed' ? t('common.load_failed') : t('tools.health.empty')}
        actionLabel={status === 'failed' ? t('common.retry') : undefined}
        onAction={load}
      />
    );
  }
  return (
    <View style={tc.wrap}>
      {tips.map((tip: any) => (
        <View key={tip.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Ionicons name={tip.icon as any} size={20} color={colors.primary} />
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{tip.title}</Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, lineHeight: 20 }}>{tip.tips}</Text>
        </View>
      ))}
    </View>
  );
}

// ==================== HUB (MAIN MENU) ====================
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type HubItem = { key: string; icon: IconName; label: string; sub?: string; onPress: () => void };

// Dua kelompok dengan bobot berbeda: penghitung ritual (dipakai saat ibadah, butuh target besar)
// tampil sebagai kartu; utilitas perjalanan tampil sebagai daftar. Satu warna ikon (zamrud).
function HubMenu({ onSelect }: { onSelect: (t: Tab) => void }) {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const role = useAuthStore((st) => st.user?.role);
  const rituals: Array<{ id: Tab; icon: IconName; label: string; arabic: string }> = [
    { id: 'tawaf', icon: 'refresh-circle', label: t('tools.hub.tawaf'), arabic: 'طَوَاف' },
    { id: 'sai', icon: 'swap-horizontal', label: t('tools.hub.sai'), arabic: 'سَعْي' },
    { id: 'jumrah', icon: 'radio-button-on', label: t('tools.hub.jumrah'), arabic: 'جَمَرَات' },
    { id: 'wukuf', icon: 'timer', label: t('tools.hub.wukuf'), arabic: 'وُقُوف' },
    { id: 'tasbih', icon: 'ellipsis-horizontal-circle', label: t('tools.hub.tasbih'), arabic: 'تَسْبِيح' },
  ];
  const utilities: HubItem[] = [
    { key: 'prayer', icon: 'compass', label: t('tools.hub.prayer'), onPress: () => router.push('/prayer') },
    { key: 'checklist', icon: 'checkbox', label: t('tools.hub.checklist'), onPress: () => onSelect('checklist') },
    { key: 'kurs', icon: 'cash', label: t('tools.hub.kurs'), onPress: () => onSelect('kurs') },
    { key: 'frasa', icon: 'language', label: t('tools.hub.frasa'), onPress: () => onSelect('frasa') },
    { key: 'kesehatan', icon: 'medkit', label: t('tools.hub.kesehatan'), onPress: () => onSelect('kesehatan') },
    { key: 'voice', icon: 'megaphone', label: t('tools.hub.voice'), sub: t('tools.hub.voice_sub'), onPress: () => router.push('/voice') },
  ];
  // alat riset: perekam trace GPS untuk validasi lapangan naskah — bukan untuk jamaah
  if (canUseResearchTools(role)) {
    utilities.push({ key: 'gps', icon: 'analytics', label: t('tools.hub.gps_recorder'), sub: t('tools.hub.gps_recorder_sub'), onPress: () => router.push('/gps-recorder') });
  }
  return (
    <View style={hub.wrap}>
      <Text style={hub.section} accessibilityRole="header">{t('tools.hub.section_ritual')}</Text>
      <View style={hub.grid}>
        {rituals.map((item) => (
          <TouchableOpacity key={item.id} style={hub.card} onPress={() => onSelect(item.id)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={item.label}>
            <View style={hub.iconBox}>
              <Ionicons name={item.icon} size={26} color={colors.primary} />
            </View>
            <Text style={hub.label}>{item.label}</Text>
            <Text style={hub.arabic} importantForAccessibility="no">{item.arabic}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={hub.section} accessibilityRole="header">{t('tools.hub.section_travel')}</Text>
      <View style={hub.list}>
        {utilities.map((item, i) => (
          <TouchableOpacity key={item.key} style={[hub.row, i > 0 && hub.rowBorder]} onPress={item.onPress} activeOpacity={0.7} accessibilityRole="button">
            <Ionicons name={item.icon} size={22} color={colors.primary} />
            <Text style={hub.rowLabel}>{item.label}</Text>
            {item.sub && <Text style={hub.rowSub}>{item.sub}</Text>}
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const hub = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 8 },
  section: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary, marginTop: 14, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: (W - 42) / 2, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 6, minHeight: 112 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  label: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  arabic: { fontSize: 16, fontFamily: 'Amiri_400Regular', color: colors.textMuted },
  list: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  rowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
});

// ==================== MAIN ====================
export default function ToolsScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [entryTab] = useState<Tab>(() => initialTab(params.tab));
  const [tab, setTab] = useState<Tab>(entryTab);
  // Dibuka langsung ke satu alat (pintasan beranda) → tombol kembali pulang ke layar sebelumnya.
  const backLeavesScreen = tab === 'hub' || tab === entryTab;

  return (
    <SafeAreaView style={tc.safe}>
      <View style={tc.header}>
        <TouchableOpacity
          onPress={() => backLeavesScreen ? router.back() : setTab('hub')}
          style={{ padding: 6 }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backLeavesScreen ? t('common.back') : t('a11y.tools_menu')}
        >
          <Ionicons name={backLeavesScreen ? 'arrow-back' : 'grid'} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={tc.headerTitle}>{tab === 'hub' ? t('tools.title') : t(`tools.tab.${tab}`)}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === 'hub' && <HubMenu onSelect={setTab} />}
        {tab === 'tawaf' && <TawafSaiTab type="tawaf" />}
        {tab === 'sai' && <TawafSaiTab type="sai" />}
        {tab === 'tasbih' && <TasbihTab />}
        {tab === 'jumrah' && <JumrahTab />}
        {tab === 'wukuf' && <WukufTab />}
        {tab === 'checklist' && <ChecklistTab />}

        {tab === 'kurs' && <CurrencyConverter />}

        {tab === 'frasa' && <PhrasesList />}

        {tab === 'kesehatan' && <HealthTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const tc = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  wrap: { padding: 20 },
  emptyHint: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  btns: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  undoBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
  gridItem: { width: (W - 64) / 3, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, alignItems: 'center', backgroundColor: colors.card },
  gridNum: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  gridLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  resetText: { textAlign: 'center', marginTop: 16, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  modeToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 3, gap: 2, marginBottom: 12, alignSelf: 'center' },
  modeToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  modeToggleBtnActive: { backgroundColor: colors.primary },
  modeToggleText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  gpsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.greenLight, borderRadius: 10, padding: 10, marginBottom: 12 },
  gpsDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.green },
  gpsText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.greenDark },
  zoneIndicator: { borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  autoHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  checkProgress: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  inputLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, marginBottom: 4, marginTop: 12 },
  loadingText: { textAlign: 'center', color: colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 40 },
});
