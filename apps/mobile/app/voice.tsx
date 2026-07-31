// Prototipe "Suara Rombongan" — broadcast satu-arah muthawwif → jamaah (LiveKit).
// Muthawwif (role=speaker) bisa menyalakan mikrofon untuk memandu doa/dzikir;
// jamaah (role=listener) hanya mendengar. Broadcast satu-arah ditegakkan oleh
// token dari server (jamaah tak diberi hak publish).
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  LiveKitRoom, AudioSession, useLocalParticipant, useParticipants, useConnectionState,
} from '@livekit/react-native';
import { colors } from '../src/theme';
import { api } from '../src/services/api';

type Info = { url: string; token: string; room: string; role: 'speaker' | 'listener' };

export default function VoiceScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await api.getVoiceToken();
        if (mounted) setInfo(d);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Fitur suara belum tersedia');
      }
    })();
    AudioSession.startAudioSession();
    // Jaga layar tetap nyala selama di saluran suara — cegah koneksi WebRTC drop
    // saat layar meredup/tidur (penyebab umum status "menghubungkan" berulang).
    activateKeepAwakeAsync('voice');
    return () => { AudioSession.stopAudioSession(); deactivateKeepAwake('voice'); mounted = false; };
  }, []);

  if (error) {
    return (
      <Shell onClose={() => router.back()}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
        <Text style={s.msg}>{error}</Text>
      </Shell>
    );
  }
  if (!info) {
    return (
      <Shell onClose={() => router.back()}>
        <ActivityIndicator color="#fff" />
        <Text style={s.msg}>Menyiapkan saluran…</Text>
      </Shell>
    );
  }

  return (
    <LiveKitRoom serverUrl={info.url} token={info.token} connect audio={false} video={false}>
      <RoomUI role={info.role} onClose={() => router.back()} />
    </LiveKitRoom>
  );
}

function RoomUI({ role, onClose }: { role: 'speaker' | 'listener'; onClose: () => void }) {
  const conn = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [talking, setTalking] = useState(false);
  const connected = String(conn) === 'connected';
  const isSpeaker = role === 'speaker';

  const toggleTalk = async () => {
    const next = !talking;
    try {
      await localParticipant.setMicrophoneEnabled(next);
      setTalking(next);
      Vibration.vibrate(next ? 60 : 30);
    } catch { /* izin mikrofon ditolak */ }
  };

  // Ada yang sedang bicara? (untuk jamaah: apakah muthawwif aktif)
  const someoneSpeaking = participants.some((p) => p.isSpeaking);

  return (
    <Shell onClose={onClose}>
      <View style={s.badge}>
        <View style={[s.dot, { backgroundColor: connected ? '#7BE28A' : '#E0B341' }]} />
        <Text style={s.badgeText}>{connected ? 'Terhubung' : 'Menghubungkan…'}</Text>
      </View>
      <Text style={s.count}>{participants.length} orang di saluran</Text>

      {isSpeaker ? (
        <>
          <TouchableOpacity
            style={[s.talkBtn, talking && s.talkBtnOn]}
            onPress={toggleTalk}
            disabled={!connected}
            activeOpacity={0.8}
          >
            <Ionicons name={talking ? 'mic' : 'mic-off'} size={44} color="#fff" />
            <Text style={s.talkText}>{talking ? 'SEDANG SIARAN' : 'Mulai Siaran'}</Text>
          </TouchableOpacity>
          <Text style={s.hint}>
            {talking ? 'Suara Anda didengar seluruh rombongan. Tekan lagi untuk berhenti.' : 'Tekan untuk memandu doa/dzikir ke jamaah.'}
          </Text>
        </>
      ) : (
        <>
          <View style={[s.listenBox, someoneSpeaking && s.listenBoxActive]}>
            <Ionicons name={someoneSpeaking ? 'volume-high' : 'ear-outline'} size={44} color="#fff" />
            <Text style={s.talkText}>{someoneSpeaking ? 'Muthawwif berbicara' : 'Mendengarkan'}</Text>
          </View>
          <Text style={s.hint}>Gunakan earphone. Suara muthawwif akan terdengar otomatis saat memandu.</Text>
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
  msg: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#fff', textAlign: 'center', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  badgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
  count: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.8)' },
  talkBtn: { width: 200, height: 200, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  talkBtnOn: { backgroundColor: colors.green, borderColor: '#fff' },
  listenBox: { width: 200, height: 200, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  listenBoxActive: { backgroundColor: colors.green, borderColor: '#fff' },
  talkText: { fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  hint: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20, marginTop: 6 },
});
