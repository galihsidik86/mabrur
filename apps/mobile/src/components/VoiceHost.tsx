import { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LiveKitRoom, AudioSession, useLocalParticipant, useParticipants } from '@livekit/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useVoice } from '../stores/voice';
import { colors } from '../theme';

// Membungkus SELURUH app dengan LiveKitRoom saat suara aktif → koneksi bertahan
// lintas layar. Jamaah bisa membuka Tawaf/Sa'i (auto-GPS) sambil tetap mendengar
// muthawwif; muthawwif bisa menyiarkan dari layar mana pun via banner kontrol.
export function VoiceHost({ children }: { children: React.ReactNode }) {
  const { active, url, token } = useVoice();

  useEffect(() => {
    if (!active) return;
    AudioSession.startAudioSession();
    activateKeepAwakeAsync('voice');
    return () => { AudioSession.stopAudioSession(); deactivateKeepAwake('voice'); };
  }, [active]);

  if (!active || !url || !token) return <>{children}</>;

  return (
    <LiveKitRoom serverUrl={url} token={token} connect audio={false} video={false}>
      {children}
      <VoiceBanner />
    </LiveKitRoom>
  );
}

// Banner kontrol mengambang, tampil di semua layar selama suara aktif.
function VoiceBanner() {
  const { role, stop } = useVoice();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const isSpeaker = role === 'speaker';
  const talking = !!localParticipant?.isMicrophoneEnabled;
  const someoneSpeaking = participants.some((p) => p.isSpeaking);

  const toggle = async () => {
    try { await localParticipant.setMicrophoneEnabled(!talking); } catch { /* izin mic */ }
  };

  return (
    <View style={{
      position: 'absolute', left: 10, right: 10, bottom: 92,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.primaryDark, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10, elevation: 8,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    }}>
      <Ionicons
        name={isSpeaker ? (talking ? 'mic' : 'mic-off') : (someoneSpeaking ? 'volume-high' : 'ear')}
        size={18} color="#fff" />
      <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' }}>
        {isSpeaker
          ? (talking ? 'Sedang siaran' : 'Suara Rombongan')
          : (someoneSpeaking ? 'Muthawwif berbicara' : 'Mendengarkan')} · {participants.length}
      </Text>
      {isSpeaker && (
        <TouchableOpacity onPress={toggle}
          style={{ backgroundColor: talking ? colors.green : 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' }}>
            {talking ? 'Stop bicara' : 'Bicara'}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={stop} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </View>
  );
}
