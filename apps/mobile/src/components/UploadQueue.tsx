import { useSyncExternalStore } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';
import { getProgressVersion, subscribeProgress, uploadProgress, type QueuedMedia } from '../services/documentation';

type Props = {
  queue: QueuedMedia[];
  onRetry: (id: number) => void;
  onDiscard: (id: number) => void;
};

const HIT = { top: 6, bottom: 6, left: 6, right: 6 };

// Foto yang belum terkirim: tampil dari berkas lokal + status (mengunggah / menunggu sinyal / gagal).
export default function UploadQueue({ queue, onRetry, onDiscard }: Props) {
  const t = useI18n((st) => st.t);
  // Progres dibaca langsung dari layanan (dibatasi 4×/dtk) → hanya komponen ini yang render ulang.
  useSyncExternalStore(subscribeProgress, getProgressVersion);
  if (queue.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.title}>{t('doc.queue_title', { count: queue.length })}</Text>
      <Text style={s.hint}>{t('doc.queue_hint')}</Text>
      {queue.map((q) => {
        const ratio = uploadProgress(q.id);
        const isFailed = q.status === 'failed';
        const pct = ratio != null ? Math.round(ratio * 100) : null;
        let status: string;
        if (isFailed) status = q.last_error ? t('doc.failed', { reason: q.last_error }) : t('doc.failed_generic');
        else if (pct != null) status = t('doc.uploading', { pct });
        else status = t('doc.waiting');

        return (
          <View key={q.id} style={s.row}>
            {q.thumb_uri || q.kind === 'photo' ? (
              <Image source={{ uri: q.thumb_uri ?? q.file_uri }} style={s.thumb} />
            ) : (
              <View style={[s.thumb, s.thumbIcon]} accessible accessibilityLabel={t('doc.video')}>
                <Ionicons name="videocam" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.caption} numberOfLines={1}>{q.caption ?? '—'}</Text>
              <Text style={[s.status, isFailed && s.statusFailed]} numberOfLines={2}>{status}</Text>
              {pct != null && (
                <View
                  style={s.bar}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: pct }}>
                  <View style={[s.barFill, { width: `${pct}%` }]} />
                </View>
              )}
            </View>
            {isFailed && (
              <TouchableOpacity onPress={() => onRetry(q.id)} style={s.iconBtn} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={t('doc.retry')}>
                <Ionicons name="refresh" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onDiscard(q.id)} style={s.iconBtn} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={t('doc.discard')}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 14 },
  title: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  hint: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  status: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 1 },
  statusFailed: { color: colors.danger },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surface, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.green },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
