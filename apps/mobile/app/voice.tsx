// Layar kontrol "Suara Rombongan": sambung / putus. Koneksi LiveKit sesungguhnya
// dipasang global di VoiceHost (root) sehingga tetap hidup saat pengguna membuka
// Tawaf/Sa'i (auto-GPS berjalan bersamaan). Kontrol bicara ada di bilah mengambang.
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { useVoice } from '../src/stores/voice';

export default function VoiceScreen() {
  const router = useRouter();
  const { active, connecting, error, role, start, stop } = useVoice();

  return (
    <Shell onClose={() => router.back()}>
      {active ? (
        <>
          <View style={[s.circle, { backgroundColor: colors.green }]}>
            <Ionicons name={role === 'speaker' ? 'mic' : 'volume-high'} size={44} color="#fff" />
          </View>
          <Text style={s.title}>{role === 'speaker' ? 'Siap menyiarkan' : 'Tersambung — mendengarkan'}</Text>
          <Text style={s.msg}>
            {role === 'speaker'
              ? 'Tekan "Bicara" di bilah bawah untuk memandu doa. Anda bisa membuka Tawaf/Sa\'i — hitungan GPS tetap berjalan dan suara tetap tersiar.'
              : 'Suara muthawwif terdengar otomatis. Silakan buka Tawaf/Sa\'i — hitungan GPS berjalan sambil Anda mendengar.'}
          </Text>
          <TouchableOpacity style={s.outlineBtn} onPress={stop}>
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={s.outlineText}>Putuskan</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={s.circle}><Ionicons name="megaphone-outline" size={44} color="#fff" /></View>
          <Text style={s.title}>Suara Rombongan</Text>
          <Text style={s.msg}>
            Sambungkan untuk memandu/mendengar doa. Setelah tersambung, koneksi tetap hidup
            meski Anda pindah layar — Tawaf/Sa'i tetap menghitung otomatis.
          </Text>
          <TouchableOpacity style={s.connectBtn} onPress={start} disabled={connecting}>
            {connecting ? <ActivityIndicator color="#fff" /> : (
              <><Ionicons name="wifi" size={22} color="#fff" /><Text style={s.connectText}>Sambungkan</Text></>
            )}
          </TouchableOpacity>
          {error ? <Text style={[s.msg, { color: '#FFD9D2' }]}>{error}</Text> : null}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.hLabel}>SUARA ROMBONGAN</Text>
          <Text style={s.hTitle}>Prototipe</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={s.body}>{children}</View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark ?? '#6E2424' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18 },
  hLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1.6, color: 'rgba(255,255,255,0.7)' },
  hTitle: { fontSize: 24, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff', marginTop: 2 },
  closeBtn: { width: 38, height: 38, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  circle: { width: 120, height: 120, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginTop: 6 },
  msg: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  connectText: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  outlineText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
});
