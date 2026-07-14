import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { colors, radius } from '../src/theme';
import { requestPermission } from '../src/services/location';
import {
  startRecording, stopRecording, isRecording, listSessions,
  deleteSession, exportSession, uploadSession, TraceSession, LivePoint,
} from '../src/services/trace-recorder';

const SCENARIOS = [
  { key: 'A-lapangan-terbuka', label: 'A. Lapangan terbuka', hint: 'Jalan lurus ±300 m, langit terbuka' },
  { key: 'B-padat-bangunan', label: 'B. Padat bangunan', hint: 'Gang / koridor antar gedung' },
  { key: 'C-bolak-balik', label: 'C. Bolak-balik ×7', hint: 'Lintasan lurus ±400 m, 7 kali' },
];

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function GpsRecorderScreen() {
  const router = useRouter();
  const [scenario, setScenario] = useState(SCENARIOS[0].key);
  const [recording, setRecording] = useState(isRecording());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [last, setLast] = useState<LivePoint | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sessions, setSessions] = useState<TraceSession[]>([]);

  const refresh = useCallback(() => { listSessions().then(setSessions).catch(() => {}); }, []);
  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  // jangan biarkan layar mati saat merekam
  useEffect(() => {
    if (recording) activateKeepAwakeAsync('gps-recorder');
    return () => { deactivateKeepAwake('gps-recorder'); };
  }, [recording]);

  const onStart = async () => {
    const ok = await requestPermission();
    if (!ok) { Alert.alert('Izin lokasi ditolak', 'Perekaman membutuhkan izin lokasi.'); return; }
    setCount(0); setLast(null);
    await startRecording(scenario, (p, c) => { setLast(p); setCount(c); });
    setStartedAt(Date.now());
    setRecording(true);
  };

  const onStop = async () => {
    await stopRecording();
    setRecording(false);
    setStartedAt(null);
    refresh();
  };

  const onDelete = (s: TraceSession) => {
    Alert.alert('Hapus sesi?', `${s.label} (${s.point_count} titik) akan dihapus permanen.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteSession(s.id).then(refresh) },
    ]);
  };

  const onExport = async (s: TraceSession) => {
    try { await exportSession(s.id); }
    catch (e) { Alert.alert('Gagal ekspor', e instanceof Error ? e.message : 'Kesalahan tidak dikenal'); }
  };

  const [uploading, setUploading] = useState<number | null>(null);
  const onUpload = async (s: TraceSession) => {
    setUploading(s.id);
    try {
      await uploadSession(s.id);
      Alert.alert('Terunggah', 'Sesi terkirim ke server — bisa dianalisis dari panel admin (menu Validasi GPS).');
      refresh();
    } catch (e) {
      Alert.alert('Gagal unggah', e instanceof Error ? e.message : 'Kesalahan tidak dikenal');
    } finally { setUploading(null); }
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Perekam GPS (Riset)</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={st.infoBox}>
          <Ionicons name="flask" size={16} color={colors.textMuted} />
          <Text style={st.infoText}>
            Merekam trace GPS 1 titik/detik (BestForNavigation — stack yang sama dengan
            deteksi ritual) untuk validasi lapangan naskah. Ekspor GPX → taruh di
            field_logs/ → npm run replay.
          </Text>
        </View>

        {/* pilih skenario */}
        {!recording && (
          <View style={{ gap: 8, marginTop: 14 }}>
            {SCENARIOS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[st.scenario, scenario === s.key && st.scenarioActive]}
                onPress={() => setScenario(s.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={scenario === s.key ? 'radio-button-on' : 'radio-button-off'}
                  size={20} color={scenario === s.key ? colors.primary : colors.textFaint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={st.scenarioLabel}>{s.label}</Text>
                  <Text style={st.scenarioHint}>{s.hint}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* status live */}
        {recording && (
          <View style={st.liveBox}>
            <View style={st.liveDotRow}>
              <View style={st.liveDot} />
              <Text style={st.liveLabel}>MEREKAM — {scenario}</Text>
            </View>
            <View style={st.statRow}>
              <View style={st.stat}><Text style={st.statNum}>{count}</Text><Text style={st.statLabel}>titik</Text></View>
              <View style={st.stat}><Text style={st.statNum}>{startedAt ? fmtDur(now - startedAt) : '0:00'}</Text><Text style={st.statLabel}>durasi</Text></View>
              <View style={st.stat}><Text style={st.statNum}>{last?.acc != null ? `${last.acc.toFixed(0)} m` : '—'}</Text><Text style={st.statLabel}>akurasi</Text></View>
            </View>
            <Text style={st.liveCoord}>
              {last ? `${last.lat.toFixed(6)}, ${last.lon.toFixed(6)}` : 'menunggu fix GPS…'}
            </Text>
          </View>
        )}

        {/* tombol utama */}
        <TouchableOpacity
          style={[st.mainBtn, recording && { backgroundColor: colors.danger }]}
          onPress={recording ? onStop : onStart}
          activeOpacity={0.8}
        >
          <Ionicons name={recording ? 'stop-circle' : 'play-circle'} size={22} color="#fff" />
          <Text style={st.mainBtnText}>{recording ? 'Berhenti & Simpan' : 'Mulai Merekam'}</Text>
        </TouchableOpacity>
        {!recording && (
          <Text style={st.tip}>
            Tunggu 1–2 menit setelah GPS mendapat fix sebelum mulai berjalan. Layar dijaga
            tetap menyala selama perekaman.
          </Text>
        )}

        {/* daftar sesi */}
        <Text style={st.sectionTitle}>Sesi tersimpan</Text>
        {sessions.length === 0 && <Text style={st.empty}>Belum ada rekaman.</Text>}
        {sessions.map((s) => (
          <View key={s.id} style={st.session}>
            <View style={{ flex: 1 }}>
              <Text style={st.sessionLabel}>{s.label}</Text>
              <Text style={st.sessionMeta}>
                {new Date(s.started_at).toLocaleString('id-ID')} · {s.point_count} titik
                {s.ended_at ? ` · ${fmtDur(s.ended_at - s.started_at)}` : ' · (terputus)'}
                {s.uploaded_at ? ' · terunggah' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onUpload(s)} style={st.iconBtn} disabled={uploading === s.id}>
              <Ionicons
                name={s.uploaded_at ? 'cloud-done' : 'cloud-upload-outline'}
                size={20}
                color={uploading === s.id ? colors.textFaint : s.uploaded_at ? colors.green : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onExport(s)} style={st.iconBtn}>
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(s)} style={st.iconBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  infoBox: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.surfaceWarm,
    borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.borderLight,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  scenario: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12,
  },
  scenarioActive: { borderColor: colors.primary, backgroundColor: colors.surfaceWarm },
  scenarioLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  scenarioHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 1 },
  liveBox: {
    marginTop: 14, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center',
  },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  liveLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.danger },
  statRow: { flexDirection: 'row', gap: 26, marginTop: 14 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.text },
  statLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  liveCoord: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, marginTop: 12 },
  mainBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, marginTop: 16,
  },
  mainBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  tip: { fontSize: 11.5, lineHeight: 16, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, marginTop: 10, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 24, marginBottom: 8 },
  empty: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint },
  session: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 8,
  },
  sessionLabel: { fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  sessionMeta: { fontSize: 11.5, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 8 },
});
