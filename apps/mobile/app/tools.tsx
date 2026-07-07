import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Dimensions, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import { getPosition } from '../src/services/location';

type Tab = 'counter' | 'qiblat' | 'shalat' | 'checklist' | 'kurs' | 'frasa' | 'kesehatan';

// ==================== COUNTER ====================
function CounterTab() {
  const [type, setType] = useState<'tawaf' | 'sai' | 'dzikir'>('tawaf');
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(7);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const label = type === 'tawaf' ? 'Tawaf' : type === 'sai' ? "Sa'i" : 'Dzikir';

  const start = async () => {
    setCount(0);
    setTarget(type === 'dzikir' ? 33 : 7);
    try {
      const s = await api.createCounter(type, type === 'dzikir' ? 33 : 7, label);
      setSessionId(s.id);
    } catch { setSessionId('local'); }
  };

  const increment = async () => {
    const t = type === 'dzikir' ? 33 : 7;
    if (count >= t) return;
    const next = count + 1;
    setCount(next);
    Vibration.vibrate(50);
    if (next >= t) Vibration.vibrate([0, 200, 100, 200]);
    if (sessionId && sessionId !== 'local') {
      try { await api.incrementCounter(sessionId); } catch {}
    }
  };

  return (
    <View style={s.tabContent}>
      <View style={s.counterTypes}>
        {(['tawaf', 'sai', 'dzikir'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => { setType(t); setCount(0); setSessionId(null); }}
            style={[s.typeBtn, type === t && s.typeBtnActive]}>
            <Text style={[s.typeBtnText, type === t && { color: colors.textOnPrimary }]}>
              {t === 'tawaf' ? 'Tawaf' : t === 'sai' ? "Sa'i" : 'Dzikir'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.counterCircle}>
        <Text style={s.counterNum}>{count}</Text>
        <Text style={s.counterTarget}>/ {type === 'dzikir' ? 33 : 7}</Text>
      </View>

      {count >= (type === 'dzikir' ? 33 : 7) ? (
        <View style={s.doneBox}>
          <Ionicons name="checkmark-circle" size={28} color={colors.green} />
          <Text style={s.doneText}>{label} selesai! Alhamdulillah.</Text>
        </View>
      ) : (
        <>
          {!sessionId ? (
            <TouchableOpacity style={s.primaryBtn} onPress={start}>
              <Text style={s.primaryBtnText}>Mulai {label}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.bigCountBtn} onPress={increment} activeOpacity={0.7}>
              <Ionicons name="add" size={36} color={colors.textOnPrimary} />
              <Text style={s.bigCountText}>Ketuk untuk menghitung</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <TouchableOpacity onPress={() => { setCount(0); setSessionId(null); }}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==================== QIBLAT ====================
function QiblatTab() {
  const [bearing, setBearing] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const pos = await getPosition();
      if (pos) {
        const kaabaLat = 21.4225 * Math.PI / 180;
        const kaabaLng = 39.8262 * Math.PI / 180;
        const lat = pos.lat * Math.PI / 180;
        const lng = pos.lng * Math.PI / 180;
        const dLng = kaabaLng - lng;
        const y = Math.sin(dLng) * Math.cos(kaabaLat);
        const x = Math.cos(lat) * Math.sin(kaabaLat) - Math.sin(lat) * Math.cos(kaabaLat) * Math.cos(dLng);
        const b = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
        setBearing(Math.round(b));
      }
    })();
  }, []);

  return (
    <View style={s.tabContent}>
      <View style={s.qiblatCircle}>
        <View style={[s.qiblatArrow, bearing != null && { transform: [{ rotate: `${bearing}deg` }] }]}>
          <Ionicons name="navigate" size={60} color={colors.primary} />
        </View>
      </View>
      <Text style={s.qiblatDeg}>{bearing != null ? `${bearing}°` : 'Menghitung...'}</Text>
      <Text style={s.qiblatLabel}>Arah kiblat dari posisi Anda</Text>
      <Text style={s.qiblatHint}>Hadapkan bagian atas HP ke arah panah</Text>
    </View>
  );
}

// ==================== SHALAT ====================
function ShalatTab() {
  const [times, setTimes] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const pos = await getPosition();
      try {
        const t = await api.getPrayerTimes(pos?.lat, pos?.lng);
        setTimes(t);
      } catch {}
    })();
  }, []);

  const names: Record<string, string> = { fajr: 'Subuh', sunrise: 'Syuruq', dhuhr: 'Dzuhur', asr: 'Ashar', maghrib: 'Maghrib', isha: 'Isya' };

  return (
    <View style={s.tabContent}>
      {times ? (
        <>
          <Text style={s.shalatDate}>{times.date}</Text>
          {Object.entries(times.times).map(([key, time]) => (
            <View key={key} style={s.shalatRow}>
              <Text style={s.shalatName}>{names[key] || key}</Text>
              <Text style={s.shalatTime}>{time as string}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={s.loadingText}>Menghitung waktu shalat...</Text>
      )}
    </View>
  );
}

// ==================== CHECKLIST ====================
function ChecklistTab() {
  const [items, setItems] = useState<any[]>([]);
  const [newText, setNewText] = useState('');

  const load = useCallback(async () => {
    try { setItems(await api.getChecklist()); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newText.trim()) return;
    try { await api.addChecklist(newText.trim()); setNewText(''); load(); } catch {}
  };
  const toggle = async (id: string, checked: boolean) => {
    try { await api.toggleChecklist(id, !checked); load(); } catch {}
  };

  const done = items.filter((i: any) => i.checked).length;

  return (
    <View style={s.tabContent}>
      <Text style={s.checkProgress}>{done}/{items.length} disiapkan</Text>
      <View style={s.checkInputRow}>
        <TextInput style={s.checkInput} value={newText} onChangeText={setNewText}
          placeholder="Tambah item..." placeholderTextColor={colors.textFaint} />
        <TouchableOpacity style={s.checkAddBtn} onPress={add}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {items.map((item: any) => (
        <TouchableOpacity key={item.id} style={s.checkItem} onPress={() => toggle(item.id, item.checked)}>
          <Ionicons name={item.checked ? 'checkbox' : 'square-outline'} size={22}
            color={item.checked ? colors.green : colors.textFaint} />
          <Text style={[s.checkText, item.checked && s.checkTextDone]}>{item.text}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ==================== MAIN ====================
export default function ToolsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('counter');
  const [phrases, setPhrases] = useState<any[]>([]);
  const [healthTips, setHealthTips] = useState<any[]>([]);
  const [currency, setCurrency] = useState<any>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (tab === 'frasa') api.getPhrases().then(setPhrases).catch(() => {});
    if (tab === 'kesehatan') api.getHealthTips().then(setHealthTips).catch(() => {});
    if (tab === 'kurs') api.getCurrency().then(setCurrency).catch(() => {});
  }, [tab]);

  const tabs: Array<{ id: Tab; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = [
    { id: 'counter', icon: 'refresh-circle', label: 'Counter' },
    { id: 'qiblat', icon: 'compass', label: 'Kiblat' },
    { id: 'shalat', icon: 'time', label: 'Shalat' },
    { id: 'checklist', icon: 'checkbox', label: 'Ceklis' },
    { id: 'kurs', icon: 'cash', label: 'Kurs' },
    { id: 'frasa', icon: 'language', label: 'Arab' },
    { id: 'kesehatan', icon: 'medkit', label: 'Sehat' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Alat Ibadah</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setTab(t.id)}
            style={[s.tabChip, tab === t.id && s.tabChipActive]}>
            <Ionicons name={t.icon} size={16} color={tab === t.id ? '#fff' : colors.textMuted} />
            <Text style={[s.tabChipText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scrollContent}>
        {tab === 'counter' && <CounterTab />}
        {tab === 'qiblat' && <QiblatTab />}
        {tab === 'shalat' && <ShalatTab />}
        {tab === 'checklist' && <ChecklistTab />}

        {tab === 'kurs' && currency && (
          <View style={s.tabContent}>
            <Text style={s.kursRate}>1 SAR = Rp {currency.sar_to_idr.toLocaleString()}</Text>
            <TextInput style={s.kursInput} value={amount} onChangeText={setAmount}
              placeholder="Masukkan jumlah SAR" keyboardType="numeric" placeholderTextColor={colors.textFaint} />
            {amount && (
              <Text style={s.kursResult}>
                = Rp {Math.round(Number(amount) * currency.sar_to_idr).toLocaleString('id')}
              </Text>
            )}
          </View>
        )}

        {tab === 'frasa' && (
          <View style={s.tabContent}>
            {phrases.map((p: any) => (
              <View key={p.id} style={s.phraseCard}>
                <Text style={s.phraseArabic}>{p.arabic}</Text>
                <Text style={s.phraseTranslit}>{p.transliteration}</Text>
                <Text style={s.phraseIndo}>{p.indonesian}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 'kesehatan' && (
          <View style={s.tabContent}>
            {healthTips.map((t: any) => (
              <View key={t.id} style={s.healthCard}>
                <View style={s.healthHeader}>
                  <Ionicons name={t.icon as any} size={20} color={colors.primary} />
                  <Text style={s.healthTitle}>{t.title}</Text>
                </View>
                <Text style={s.healthTips}>{t.tips}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const w = Dimensions.get('window').width;
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  tabScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  scrollContent: { paddingBottom: 40 },
  tabContent: { padding: 20 },
  // Counter
  counterTypes: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  typeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  counterCircle: { width: 160, height: 160, borderRadius: 999, borderWidth: 4, borderColor: colors.primary, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  counterNum: { fontSize: 56, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary },
  counterTarget: { fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: -4 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: 24 },
  primaryBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  bigCountBtn: { backgroundColor: colors.primary, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 24, gap: 4 },
  bigCountText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.8)' },
  doneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 16, backgroundColor: colors.greenLight, borderRadius: 12 },
  doneText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.greenDark },
  resetText: { textAlign: 'center', marginTop: 16, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textFaint },
  // Qiblat
  qiblatCircle: { width: 200, height: 200, borderRadius: 999, borderWidth: 3, borderColor: colors.border, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  qiblatArrow: {},
  qiblatDeg: { fontSize: 32, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, textAlign: 'center', marginTop: 16 },
  qiblatLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  qiblatHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint, textAlign: 'center', marginTop: 8 },
  // Shalat
  shalatDate: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  shalatRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  shalatName: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  shalatTime: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  loadingText: { textAlign: 'center', color: colors.textFaint, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 40 },
  // Checklist
  checkProgress: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, textAlign: 'center', marginBottom: 12 },
  checkInputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  checkInput: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  checkAddBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  checkText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  checkTextDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  // Kurs
  kursRate: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, textAlign: 'center' },
  kursInput: { marginTop: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 18, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text, textAlign: 'center' },
  kursResult: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.green, textAlign: 'center', marginTop: 16 },
  // Phrases
  phraseCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  phraseArabic: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  phraseTranslit: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primary, marginTop: 6, fontStyle: 'italic' },
  phraseIndo: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, marginTop: 2 },
  // Health
  healthCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 10 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  healthTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  healthTips: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, lineHeight: 20 },
});
