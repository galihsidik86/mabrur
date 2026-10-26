import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';

type Props = {
  uri: string;
  headers: Record<string, string>;
  accessibilityLabel: string;
  onRetry: () => void;
};

// Pemutar video Dokumentasi (endpoint berotorisasi → header Authorization ikut di setiap permintaan Range).
// Gagal (offline / token kedaluwarsa / lewat masa simpan) → pesan + coba lagi; induk memasang ulang dengan header baru.
export default function DocumentationVideo({ uri, headers, accessibilityLabel, onRetry }: Props) {
  const t = useI18n((st) => st.t);
  const source = useMemo(() => ({ uri, headers }), [uri, headers]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  return (
    <View style={s.wrap}>
      <VideoView
        player={player}
        style={s.video}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        accessibilityLabel={accessibilityLabel}
      />
      {status === 'loading' && <ActivityIndicator style={s.overlay} color="#fff" />}
      {status === 'error' && (
        <View style={[s.overlay, s.failedBox]}>
          <Text style={s.failedText}>{t('doc.video_failed')}</Text>
          <TouchableOpacity style={s.retry} onPress={onRetry} accessibilityRole="button">
            <Text style={s.retryText}>{t('doc.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  overlay: { position: 'absolute' },
  failedBox: { alignItems: 'center', paddingHorizontal: 24 },
  failedText: { fontSize: 14, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#fff' },
  retry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});
