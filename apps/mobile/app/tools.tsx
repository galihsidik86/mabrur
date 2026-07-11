import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Vibration, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Magnetometer } from 'expo-sensors';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import { getPosition, requestPermission } from '../src/services/location';
import {
  TawafTracker, SaiTracker, detectNearestJamarat,
  watchSacredLocation, checkArafahPosition,
  KAABAH, SAFA, MARWAH, ARAFAH_CENTER,
  type SaiZone, type ArafahResult,
} from '../src/services/sacred-zones';
import { sendLocalNotification } from '../src/services/notification';

type Tab = 'hub' | 'tawaf' | 'sai' | 'tasbih' | 'jumrah' | 'wukuf' | 'qiblat' | 'shalat' | 'checklist' | 'kurs' | 'frasa' | 'kesehatan';

const { width: W } = Dimensions.get('window');

// ==================== RING COUNTER ====================
function RingCounter({ count, target, onTap, label, arabic, subtitle }: {
  count: number; target: number; onTap: () => void; label: string; arabic?: string; subtitle?: string;
}) {
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
          <Text style={rc.doneText}>Selesai! Alhamdulillah</Text>
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
  const [count, setCount] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [saiZone, setSaiZone] = useState<SaiZone>('between');
  const trackerRef = useRef<TawafTracker | SaiTracker | null>(null);
  const watchRef = useRef<{ remove: () => void } | null>(null);

  const label = type === 'tawaf' ? 'Putaran Tawaf' : "Perjalanan Sa'i";
  const direction = type === 'sai'
    ? (count % 2 === 0 ? 'Shafa → Marwah' : 'Marwah → Shafa')
    : `Putaran ${count + 1}`;

  useEffect(() => {
    activateKeepAwakeAsync('counter');
    return () => { deactivateKeepAwake('counter'); watchRef.current?.remove(); };
  }, []);

  const startAuto = async () => {
    const granted = await requestPermission();
    if (!granted) { setGpsStatus('Izin lokasi ditolak'); return; }

    setAutoMode(true);
    setGpsStatus('Mencari GPS...');

    if (type === 'tawaf') {
      const tracker = new TawafTracker();
      tracker.onChange = (rounds) => {
        setCount(rounds);
        Vibration.vibrate([0, 200, 100, 200]);
      };
      trackerRef.current = tracker;

      watchRef.current = watchSacredLocation((lat, lng) => {
        tracker.update(lat, lng);
        const dist = Math.round(
          Math.sqrt((lat - KAABAH.lat) ** 2 + (lng - KAABAH.lng) ** 2) * 111000
        );
        setGpsStatus(`GPS aktif · ${dist}m dari Ka'bah`);
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
        const dS = Math.round(
          Math.sqrt((lat - SAFA.lat) ** 2 + (lng - SAFA.lng) ** 2) * 111000
        );
        const dM = Math.round(
          Math.sqrt((lat - MARWAH.lat) ** 2 + (lng - MARWAH.lng) ** 2) * 111000
        );
        setGpsStatus(`Safa: ${dS}m · Marwah: ${dM}m`);
      });
    }
  };

  const stopAuto = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setAutoMode(false);
    setGpsStatus('');
  };

  return (
    <View style={tc.wrap}>
      {/* Mode toggle */}
      <View style={tc.modeToggle}>
        <TouchableOpacity
          style={[tc.modeToggleBtn, !autoMode && tc.modeToggleBtnActive]}
          onPress={stopAuto}>
          <Ionicons name="hand-left" size={16} color={!autoMode ? '#fff' : colors.textMuted} />
          <Text style={[tc.modeToggleText, !autoMode && { color: '#fff' }]}>Manual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tc.modeToggleBtn, autoMode && tc.modeToggleBtnActive]}
          onPress={startAuto}>
          <Ionicons name="navigate" size={16} color={autoMode ? '#fff' : colors.textMuted} />
          <Text style={[tc.modeToggleText, autoMode && { color: '#fff' }]}>Auto GPS</Text>
        </TouchableOpacity>
      </View>

      {autoMode && gpsStatus ? (
        <View style={tc.gpsBar}>
          <View style={tc.gpsDot} />
          <Text style={tc.gpsText}>{gpsStatus}</Text>
        </View>
      ) : null}

      {autoMode && type === 'sai' && saiZone !== 'between' ? (
        <View style={[tc.zoneIndicator, { backgroundColor: saiZone === 'safa' ? colors.greenLight : colors.goldLight }]}>
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: saiZone === 'safa' ? colors.greenDark : '#97751F' }}>
            📍 Kamu di {saiZone === 'safa' ? 'Bukit Safa' : 'Bukit Marwah'}
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
            ? 'Putaran terhitung otomatis saat melewati Hajar Aswad'
            : 'Perjalanan terhitung otomatis saat sampai di Safa/Marwah'}
        </Text>
      )}

      <View style={tc.btns}>
        <TouchableOpacity style={tc.undoBtn} onPress={() => setCount(Math.max(0, count - 1))}>
          <Ionicons name="arrow-undo" size={18} color={colors.textMuted} /><Text style={tc.undoBtnText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={tc.undoBtn} onPress={() => { setCount(0); if (type === 'tawaf' && trackerRef.current instanceof TawafTracker) trackerRef.current.reset(); if (type === 'sai' && trackerRef.current instanceof SaiTracker) trackerRef.current.reset(); }}>
          <Ionicons name="refresh" size={18} color={colors.textMuted} /><Text style={tc.undoBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==================== TASBIH (6 MODE) ====================
const TASBIH_MODES = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', latin: 'Subhanallah', meaning: 'Maha Suci Allah', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', latin: 'Alhamdulillah', meaning: 'Segala puji bagi Allah', target: 33 },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', latin: 'Allahu Akbar', meaning: 'Allah Maha Besar', target: 33 },
  { id: 'lailaha', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', latin: 'La ilaha illallah', meaning: 'Tiada Tuhan selain Allah', target: 100 },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', latin: 'Allahumma shalli ala Muhammad', meaning: 'Salawat atas Nabi', target: 100 },
  { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ', latin: 'Astaghfirullah', meaning: 'Aku mohon ampun kepada Allah', target: 100 },
];

function TasbihTab() {
  const [mode, setMode] = useState(0);
  const [counts, setCounts] = useState(TASBIH_MODES.map(() => 0));
  const m = TASBIH_MODES[mode];

  useEffect(() => { activateKeepAwakeAsync('tasbih'); return () => { deactivateKeepAwake('tasbih'); }; }, []);

  const tap = () => {
    const next = [...counts];
    if (next[mode] < m.target) { next[mode]++; setCounts(next); Vibration.vibrate(30); }
    if (next[mode] >= m.target) Vibration.vibrate([0, 200, 100, 200]);
  };

  return (
    <View style={tc.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
        {TASBIH_MODES.map((t, i) => (
          <TouchableOpacity key={t.id} onPress={() => setMode(i)}
            style={[tc.modeBtn, mode === i && tc.modeBtnActive]}>
            <Text style={[tc.modeBtnText, mode === i && { color: '#fff' }]}>{t.latin.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <RingCounter count={counts[mode]} target={m.target} onTap={tap}
        arabic={m.arabic} subtitle={m.meaning} label={m.latin} />

      {/* Progress grid */}
      <View style={tc.grid}>
        {TASBIH_MODES.map((t, i) => (
          <View key={t.id} style={[tc.gridItem, counts[i] >= t.target && { borderColor: colors.green }]}>
            <Text style={[tc.gridNum, counts[i] >= t.target && { color: colors.green }]}>{counts[i]}/{t.target}</Text>
            <Text style={tc.gridLabel}>{t.latin.split(' ')[0]}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={tc.undoBtn} onPress={() => { const n = [...counts]; n[mode] = Math.max(0, n[mode] - 1); setCounts(n); }}>
        <Ionicons name="arrow-undo" size={16} color={colors.textMuted} /><Text style={tc.undoBtnText}>Undo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==================== JUMRAH (4 hari × 3 jamarat × 7 batu) ====================
const JAMARAT = [
  { name: 'Jamarat Ula (Kecil)', arabic: 'الجمرة الأولى' },
  { name: 'Jamarat Wustha (Tengah)', arabic: 'الجمرة الوسطى' },
  { name: 'Jamarat Aqabah (Besar)', arabic: 'جمرة العقبة' },
];

function JumrahTab() {
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
    if (!granted) return;
    setAutoMode(true);
    watchRef.current = watchSacredLocation((lat, lng) => {
      const nearest = detectNearestJamarat(lat, lng);
      if (nearest) {
        setNearestJam(`📍 Dekat ${nearest.name} (${nearest.distance}m)`);
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

  const dayLabels = ['10 Dzulhijjah', '11 Dzulhijjah', '12 Dzulhijjah', '13 Dzulhijjah'];
  const jams = day === 0 ? [2] : [0, 1, 2]; // Day 1: only Aqabah

  return (
    <View style={tc.wrap}>
      {/* Auto GPS toggle */}
      {!autoMode ? (
        <TouchableOpacity style={[tc.modeToggleBtn, { alignSelf: 'center', marginBottom: 12 }]} onPress={startAutoJumrah}>
          <Ionicons name="navigate" size={14} color={colors.textMuted} />
          <Text style={tc.modeToggleText}>Aktifkan deteksi jamarat otomatis</Text>
        </TouchableOpacity>
      ) : nearestJam ? (
        <View style={[tc.gpsBar, { backgroundColor: colors.goldLight }]}>
          <Text style={[tc.gpsText, { color: '#97751F' }]}>{nearestJam}</Text>
        </View>
      ) : (
        <View style={tc.gpsBar}><View style={tc.gpsDot} /><Text style={tc.gpsText}>GPS aktif · mendeteksi jamarat terdekat...</Text></View>
      )}

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {dayLabels.map((d, i) => (
          <TouchableOpacity key={i} onPress={() => setDay(i)}
            style={[tc.modeBtn, day === i && tc.modeBtnActive, { paddingHorizontal: 14 }]}>
            <Text style={[tc.modeBtnText, day === i && { color: '#fff' }]}>Hari {i + 1}</Text>
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
                <Text style={jm.name}>{JAMARAT[j].name}</Text>
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
                  {done ? 'Selesai' : `Lempar (${c}/7)`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { const n = stones.map((d) => [...d]); n[day][j] = Math.max(0, n[day][j] - 1); setStones(n); }}
                style={{ padding: 10 }}>
                <Ionicons name="arrow-undo" size={16} color={colors.textFaint} />
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
    if (!granted) return;
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
            result.status === 'outside' ? 'Di Luar Arafah!' : 'Hati-hati: Batas Namirah',
            result.message,
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
        <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, textAlign: 'center' }}>Wukuf di Arafah</Text>
        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
          Masukkan waktu Dzuhur (mulai) dan Subuh (selesai) pada 9 Dzulhijjah. Tanyakan muthawwif untuk waktu pastinya.
        </Text>

        {/* Area Monitor */}
        {!gpsActive ? (
          <TouchableOpacity style={[tc.primaryBtn, { marginTop: 20, backgroundColor: colors.green }]} onPress={startAreaTracking}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={[tc.primaryBtnText, { marginLeft: 6 }]}>Cek Posisi di Arafah</Text>
          </TouchableOpacity>
        ) : arafah ? (
          <View style={[wk.areaCard, { borderColor: statusColor }]}>
            <View style={wk.areaHeader}>
              <Ionicons name={statusIcon as any} size={24} color={statusColor} />
              <Text style={[wk.areaStatus, { color: statusColor }]}>
                {arafah.status === 'inside' ? 'DI DALAM ARAFAH' : arafah.status === 'namirah_danger' ? 'ZONA PERINGATAN' : 'DI LUAR ARAFAH'}
              </Text>
            </View>
            <Text style={wk.areaMessage}>{arafah.message}</Text>
            <View style={wk.areaStats}>
              <Text style={wk.areaStat}>Jabal Rahmah: {(arafah.distToCenter / 1000).toFixed(1)} km</Text>
              <Text style={wk.areaStat}>Masjid Namirah: {Math.round(arafah.distToNamirah)} m</Text>
            </View>
          </View>
        ) : (
          <View style={tc.gpsBar}><View style={tc.gpsDot} /><Text style={tc.gpsText}>Mencari GPS...</Text></View>
        )}

        <Text style={[tc.inputLabel, { marginTop: 20 }]}>Mulai (setelah Dzuhur)</Text>
        <TextInput style={tc.input} value={start} onChangeText={setStart} placeholder="2026-08-09T12:30" placeholderTextColor={colors.textFaint} />
        <Text style={tc.inputLabel}>Selesai (Subuh esok)</Text>
        <TextInput style={tc.input} value={end} onChangeText={setEnd} placeholder="2026-08-10T05:00" placeholderTextColor={colors.textFaint} />
        <TouchableOpacity style={[tc.primaryBtn, { marginTop: 16 }]} onPress={() => { if (start && end) { setPhase('waiting'); if (!gpsActive) startAreaTracking(); } }}>
          <Text style={tc.primaryBtnText}>Mulai Countdown</Text>
        </TouchableOpacity>

        {/* Info penting */}
        <View style={wk.infoBox}>
          <Text style={wk.infoTitle}>Batas Area Arafah</Text>
          <Text style={wk.infoText}>• Wukuf HANYA sah jika berada di dalam batas Padang Arafah</Text>
          <Text style={wk.infoText}>• Masjid Namirah: bagian barat masjid ada di LUAR Arafah — hati-hati!</Text>
          <Text style={wk.infoText}>• Lembah Uranah (barat Arafah) BUKAN bagian Arafah</Text>
          <Text style={wk.infoText}>• Aktifkan GPS agar app memperingatkan jika kamu keluar area</Text>
        </View>
      </View>
    );
  }

  const bgColor = phase === 'active' ? colors.gold : phase === 'done' ? colors.green : colors.primary;

  return (
    <View style={[tc.wrap, { alignItems: 'center' }]}>
      {/* Area status during wukuf */}
      {arafah && phase === 'active' && (
        <View style={[wk.areaCard, { borderColor: statusColor, marginBottom: 12 }]}>
          <View style={wk.areaHeader}>
            <Ionicons name={statusIcon as any} size={22} color={statusColor} />
            <Text style={[wk.areaStatus, { color: statusColor, fontSize: 13 }]}>
              {arafah.status === 'inside' ? 'DI DALAM ARAFAH ✓' : arafah.status === 'namirah_danger' ? 'ZONA PERINGATAN ⚠' : 'DI LUAR ARAFAH ✗'}
            </Text>
          </View>
          {arafah.status !== 'inside' && <Text style={[wk.areaMessage, { fontSize: 12 }]}>{arafah.message}</Text>}
        </View>
      )}

      <View style={[wk.hero, { backgroundColor: bgColor }]}>
        <Text style={wk.heroLabel}>
          {phase === 'waiting' ? 'MENUNGGU WUKUF' : phase === 'active' ? 'WUKUF BERLANGSUNG' : 'WUKUF SELESAI'}
        </Text>
        <Text style={wk.heroTime}>{remaining != null ? fmt(remaining) : '--:--:--'}</Text>
        <Text style={wk.heroSub}>
          {phase === 'waiting' ? 'Menunggu waktu Dzuhur' : phase === 'active' ? 'Perbanyak doa & dzikir' : 'Alhamdulillah, wukuf sempurna'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => { setPhase('setup'); setStart(''); setEnd(''); watchRef2.current?.remove(); setGpsActive(false); setArafah(null); }}>
        <Text style={tc.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

const wk = StyleSheet.create({
  hero: { width: '100%', borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 16 },
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

// ==================== QIBLAT (REAL COMPASS) ====================
function QiblatTab() {
  const [bearing, setBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    (async () => {
      const pos = await getPosition();
      if (pos) {
        const kLat = 21.4225 * Math.PI / 180, kLng = 39.8262 * Math.PI / 180;
        const lat = pos.lat * Math.PI / 180, lng = pos.lng * Math.PI / 180;
        const y = Math.sin(kLng - lng) * Math.cos(kLat);
        const x = Math.cos(lat) * Math.sin(kLat) - Math.sin(lat) * Math.cos(kLat) * Math.cos(kLng - lng);
        setBearing(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
      }
    })();

    const sub = Magnetometer.addListener(({ x, y }) => {
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      angle = (angle + 360) % 360;
      setHeading(360 - angle);
    });
    Magnetometer.setUpdateInterval(100);
    return () => sub.remove();
  }, []);

  const rotation = bearing != null ? heading + bearing : 0;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return (
    <View style={[tc.wrap, { alignItems: 'center' }]}>
      <View style={qb.compassOuter}>
        {/* Cardinal directions */}
        {dirs.map((d, i) => {
          const a = (i * 45 + heading) * Math.PI / 180;
          const r = 115;
          return (
            <Text key={d} style={[qb.cardinal, {
              left: 125 + r * Math.sin(a) - 10,
              top: 125 - r * Math.cos(a) - 8,
            }]}>{d}</Text>
          );
        })}
        {/* Qibla arrow */}
        <View style={[qb.arrow, { transform: [{ rotate: `${rotation}deg` }] }]}>
          <View style={qb.arrowHead} />
          <Text style={qb.kaaba}>🕋</Text>
        </View>
        <View style={qb.center}><Text style={qb.centerDot}>●</Text></View>
      </View>
      <Text style={qb.deg}>{bearing != null ? `${Math.round(bearing)}°` : 'GPS...'}</Text>
      <Text style={qb.hint}>Arah kiblat · Putar HP hingga 🕋 di atas</Text>
    </View>
  );
}

const qb = StyleSheet.create({
  compassOuter: { width: 260, height: 260, borderRadius: 999, borderWidth: 3, borderColor: colors.border, position: 'relative', marginTop: 16, backgroundColor: colors.card },
  cardinal: { position: 'absolute', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted, width: 20, textAlign: 'center' },
  arrow: { position: 'absolute', left: 120, top: 20, width: 20, height: 210, alignItems: 'center' },
  arrowHead: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.green },
  kaaba: { fontSize: 24, marginTop: -8 },
  center: { position: 'absolute', left: 123, top: 123, width: 14, height: 14, borderRadius: 999, backgroundColor: colors.primary },
  centerDot: { color: '#fff', fontSize: 8, textAlign: 'center', lineHeight: 14 },
  deg: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, marginTop: 16 },
  hint: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 4 },
});

// ==================== PRAYER TIMES (ENHANCED) ====================
function ShalatTab() {
  const [times, setTimes] = useState<any>(null);
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; mins: number } | null>(null);

  useEffect(() => {
    (async () => {
      const pos = await getPosition();
      try {
        const t = await api.getPrayerTimes(pos?.lat, pos?.lng);
        setTimes(t);

        // Find next prayer
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const names: Record<string, string> = { fajr: 'Subuh', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };
        const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        for (const key of order) {
          const [h, m] = (t.times[key] as string).split(':').map(Number);
          const prayerMins = h * 60 + m;
          if (prayerMins > nowMins) {
            setNextPrayer({ name: names[key], time: t.times[key], mins: prayerMins - nowMins });
            break;
          }
        }
      } catch {}
    })();
  }, []);

  const names: Record<string, string> = { fajr: 'Subuh', sunrise: 'Syuruq', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };
  const icons: Record<string, string> = { fajr: '🌅', sunrise: '☀️', dhuhr: '🌤', asr: '⛅', maghrib: '🌇', isha: '🌙' };

  return (
    <View style={tc.wrap}>
      {nextPrayer && (
        <View style={sh.nextCard}>
          <Text style={sh.nextLabel}>SHALAT BERIKUTNYA</Text>
          <Text style={sh.nextName}>{nextPrayer.name}</Text>
          <Text style={sh.nextTime}>{nextPrayer.time}</Text>
          <Text style={sh.nextMins}>{nextPrayer.mins} menit lagi</Text>
        </View>
      )}
      {times && Object.entries(times.times).map(([key, time]) => (
        <View key={key} style={sh.row}>
          <Text style={sh.icon}>{icons[key] || '🕌'}</Text>
          <Text style={sh.name}>{names[key] || key}</Text>
          <Text style={sh.time}>{time as string}</Text>
        </View>
      ))}
      {!times && <Text style={tc.loadingText}>Menghitung waktu shalat...</Text>}
    </View>
  );
}

const sh = StyleSheet.create({
  nextCard: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  nextLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)' },
  nextName: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginTop: 4 },
  nextTime: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: '#F5D98A', marginTop: 2 },
  nextMins: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  icon: { fontSize: 20, width: 32 },
  name: { flex: 1, fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  time: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
});

// ==================== CHECKLIST / KURS / FRASA / HEALTH (same as before, condensed) ====================
function ChecklistTab() {
  const [items, setItems] = useState<any[]>([]); const [newText, setNewText] = useState('');
  const load = useCallback(async () => { try { setItems(await api.getChecklist()); } catch {} }, []);
  useEffect(() => { load(); }, [load]);
  const done = items.filter((i: any) => i.checked).length;
  return (
    <View style={tc.wrap}>
      <Text style={tc.checkProgress}>{done}/{items.length} disiapkan</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TextInput style={[tc.input, { flex: 1 }]} value={newText} onChangeText={setNewText} placeholder="Tambah item..." placeholderTextColor={colors.textFaint} />
        <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
          onPress={async () => { if (!newText.trim()) return; try { await api.addChecklist(newText.trim()); setNewText(''); load(); } catch {} }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {items.map((item: any) => (
        <TouchableOpacity key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          onPress={async () => { try { await api.toggleChecklist(item.id, !item.checked); load(); } catch {} }}>
          <Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={22} color={item.checked ? colors.green : colors.textFaint} />
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: item.checked ? colors.textFaint : colors.text, textDecorationLine: item.checked ? 'line-through' : 'none' }}>{item.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ==================== HUB (MAIN MENU) ====================
function HubMenu({ onSelect }: { onSelect: (t: Tab) => void }) {
  const router = useRouter();
  const items: Array<{ id: Tab; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; arabic: string; color: string }> = [
    { id: 'tawaf', icon: 'refresh-circle', label: 'Tawaf', arabic: 'طَوَاف', color: colors.primary },
    { id: 'sai', icon: 'swap-horizontal', label: "Sa'i", arabic: 'سَعْي', color: colors.green },
    { id: 'tasbih', icon: 'ellipsis-horizontal-circle', label: 'Tasbih', arabic: 'تَسْبِيح', color: colors.gold },
    { id: 'jumrah', icon: 'radio-button-on', label: 'Jumrah', arabic: 'جَمَرَات', color: colors.danger },
    { id: 'wukuf', icon: 'timer', label: 'Wukuf', arabic: 'وُقُوف', color: colors.primaryDark },
    { id: 'qiblat', icon: 'compass', label: 'Kiblat', arabic: 'قِبْلَة', color: colors.green },
    { id: 'shalat', icon: 'time', label: 'Shalat', arabic: 'صَلَاة', color: colors.primary },
    { id: 'checklist', icon: 'checkbox', label: 'Checklist', arabic: 'قائمة', color: colors.gold },
    { id: 'kurs', icon: 'cash', label: 'Kurs', arabic: 'عملة', color: colors.green },
    { id: 'frasa', icon: 'language', label: 'Frasa Arab', arabic: 'عربي', color: colors.primaryDark },
    { id: 'kesehatan', icon: 'medkit', label: 'Kesehatan', arabic: 'صحة', color: colors.danger },
  ];
  return (
    <View style={hub.grid}>
      {items.map((item) => (
        <TouchableOpacity key={item.id} style={hub.card} onPress={() => onSelect(item.id)} activeOpacity={0.7}>
          <View style={[hub.iconBox, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon} size={24} color="#fff" />
          </View>
          <Text style={hub.label}>{item.label}</Text>
          <Text style={hub.arabic}>{item.arabic}</Text>
        </TouchableOpacity>
      ))}
      {/* alat riset: perekam trace GPS untuk validasi lapangan naskah */}
      <TouchableOpacity style={hub.card} onPress={() => router.push('/gps-recorder')} activeOpacity={0.7}>
        <View style={[hub.iconBox, { backgroundColor: colors.textMuted }]}>
          <Ionicons name="analytics" size={24} color="#fff" />
        </View>
        <Text style={hub.label}>Perekam GPS</Text>
        <Text style={hub.arabic}>riset</Text>
      </TouchableOpacity>
    </View>
  );
}

const hub = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16, justifyContent: 'center' },
  card: { width: (W - 52) / 3, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  arabic: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
});

// ==================== MAIN ====================
export default function ToolsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('hub');
  const [phrases, setPhrases] = useState<any[]>([]);
  const [healthTips, setHealthTips] = useState<any[]>([]);
  const [currency, setCurrency] = useState<any>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (tab === 'frasa') api.getPhrases().then(setPhrases).catch(() => {});
    if (tab === 'kesehatan') api.getHealthTips().then(setHealthTips).catch(() => {});
    if (tab === 'kurs') api.getCurrency().then(setCurrency).catch(() => {});
  }, [tab]);

  return (
    <SafeAreaView style={tc.safe}>
      <View style={tc.header}>
        <TouchableOpacity onPress={() => tab === 'hub' ? router.back() : setTab('hub')} style={{ padding: 6 }}>
          <Ionicons name={tab === 'hub' ? 'arrow-back' : 'grid'} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={tc.headerTitle}>{tab === 'hub' ? 'Alat Ibadah' : tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === 'hub' && <HubMenu onSelect={setTab} />}
        {tab === 'tawaf' && <TawafSaiTab type="tawaf" />}
        {tab === 'sai' && <TawafSaiTab type="sai" />}
        {tab === 'tasbih' && <TasbihTab />}
        {tab === 'jumrah' && <JumrahTab />}
        {tab === 'wukuf' && <WukufTab />}
        {tab === 'qiblat' && <QiblatTab />}
        {tab === 'shalat' && <ShalatTab />}
        {tab === 'checklist' && <ChecklistTab />}

        {tab === 'kurs' && currency && (
          <View style={tc.wrap}>
            <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, textAlign: 'center' }}>1 SAR = Rp {currency.sar_to_idr.toLocaleString()}</Text>
            <TextInput style={[tc.input, { marginTop: 20, textAlign: 'center', fontSize: 18 }]} value={amount} onChangeText={setAmount} placeholder="Jumlah SAR" keyboardType="numeric" placeholderTextColor={colors.textFaint} />
            {amount ? <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.green, textAlign: 'center', marginTop: 16 }}>= Rp {Math.round(Number(amount) * currency.sar_to_idr).toLocaleString('id')}</Text> : null}
          </View>
        )}

        {tab === 'frasa' && (
          <View style={tc.wrap}>
            {phrases.map((p: any) => (
              <View key={p.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' }}>{p.arabic}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primary, marginTop: 6, fontStyle: 'italic' }}>{p.transliteration}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, marginTop: 2 }}>{p.indonesian}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'kesehatan' && (
          <View style={tc.wrap}>
            {healthTips.map((t: any) => (
              <View key={t.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Ionicons name={t.icon as any} size={20} color={colors.primary} />
                  <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{t.title}</Text>
                </View>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, lineHeight: 20 }}>{t.tips}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const tc = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  wrap: { padding: 20 },
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
  resetText: { textAlign: 'center', marginTop: 16, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textFaint },
  modeToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 3, gap: 2, marginBottom: 12, alignSelf: 'center' },
  modeToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  modeToggleBtnActive: { backgroundColor: colors.primary },
  modeToggleText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  gpsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.greenLight, borderRadius: 10, padding: 10, marginBottom: 12 },
  gpsDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.green },
  gpsText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.greenDark },
  zoneIndicator: { borderRadius: 10, padding: 10, marginBottom: 8, alignItems: 'center' },
  autoHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  checkProgress: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, textAlign: 'center', marginBottom: 12 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  inputLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, marginBottom: 4, marginTop: 12 },
  loadingText: { textAlign: 'center', color: colors.textFaint, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 40 },
});
