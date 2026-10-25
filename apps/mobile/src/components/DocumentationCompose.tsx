import { useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';
import type { PickedMedia } from '../services/documentation';
import { formatDuration } from '../services/documentation-core';
import type { Schedule } from '../services/db';

type Props = {
  photos: PickedMedia[];
  schedules: Schedule[];
  defaultScheduleId: string | null;
  isSubmitting: boolean;
  // Kemajuan kompresi video yang sedang disiapkan (null = tidak sedang mengompres).
  compressPct: number | null;
  onCancel: () => void;
  onSubmit: (caption: string | null, scheduleId: string | null) => void;
};

const MAX_CAPTION = 200;
// Kegiatan terbaru dulu, dibatasi agar baris pilihan tidak terlalu panjang.
const MAX_ACTIVITY_CHIPS = 20;

// Lembar sebelum unggah: pratinjau, keterangan singkat, dan kegiatan (album per kegiatan).
export default function DocumentationCompose({
  photos, schedules, defaultScheduleId, isSubmitting, compressPct, onCancel, onSubmit,
}: Props) {
  const t = useI18n((st) => st.t);
  const [caption, setCaption] = useState('');
  const [scheduleId, setScheduleId] = useState<string | null>(defaultScheduleId);

  // Lembar dipakai ulang untuk pilihan foto berikutnya → mulai bersih setiap kali dibuka.
  useEffect(() => {
    if (photos.length > 0) {
      setCaption('');
      setScheduleId(defaultScheduleId);
    }
  }, [photos, defaultScheduleId]);

  const activities = [...schedules]
    .sort((a, b) => (a.start_time < b.start_time ? 1 : -1))
    .slice(0, MAX_ACTIVITY_CHIPS);
  const choices: Array<{ id: string | null; title: string }> = [
    { id: null, title: t('doc.other') },
    ...activities.map((a) => ({ id: a.id, title: a.title })),
  ];

  return (
    <Modal visible={photos.length > 0} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{t('doc.compose_title', { count: photos.length })}</Text>
            <TouchableOpacity onPress={onCancel} disabled={isSubmitting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previews}>
            {photos.map((p) => (p.kind === 'video' ? (
              // Komponen Image tidak bisa menampilkan berkas video → kartu ikon + durasi.
              <View
                key={p.uri}
                style={[s.preview, s.videoPreview]}
                accessible
                accessibilityLabel={`${t('doc.video')} ${formatDuration(p.durationMs)}`.trim()}>
                <Ionicons name="videocam" size={26} color={colors.primary} />
                {p.durationMs ? <Text style={s.videoDuration}>{formatDuration(p.durationMs)}</Text> : null}
              </View>
            ) : (
              <Image key={p.uri} source={{ uri: p.uri }} style={s.preview} />
            )))}
          </ScrollView>

          <TextInput
            style={s.input}
            value={caption}
            onChangeText={setCaption}
            placeholder={t('doc.caption_placeholder')}
            placeholderTextColor={colors.textFaint}
            maxLength={MAX_CAPTION}
            multiline
            accessibilityLabel={t('doc.caption_placeholder')}
          />

          {activities.length > 0 && (
            <>
              <Text style={s.label}>{t('doc.activity')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                {choices.map((a) => {
                  const isSelected = scheduleId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id ?? 'none'}
                      style={[s.chip, isSelected && s.chipOn]}
                      onPress={() => setScheduleId(a.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}>
                      <Text style={[s.chipText, isSelected && s.chipTextOn]} numberOfLines={1}>{a.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          <TouchableOpacity
            style={[s.submit, isSubmitting && { opacity: 0.7 }]}
            disabled={isSubmitting}
            onPress={() => onSubmit(caption.trim() || null, scheduleId)}
            accessibilityRole="button">
            {isSubmitting ? (
              <>
                <ActivityIndicator color={colors.textOnPrimary} />
                <Text style={s.submitText} accessibilityLiveRegion="polite">
                  {compressPct != null ? t('doc.compressing', { pct: compressPct }) : t('doc.preparing')}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.textOnPrimary} />
                <Text style={s.submitText}>{t('doc.upload')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,27,22,0.45)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  previews: { gap: 8, paddingBottom: 12 },
  preview: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.surface },
  videoPreview: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  videoDuration: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary },
  input: {
    minHeight: 48, maxHeight: 110, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text,
    textAlignVertical: 'top',
  },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary, marginTop: 14, marginBottom: 8 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { maxWidth: 200, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary },
  chipTextOn: { color: colors.textOnPrimary },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18,
    paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary,
  },
  submitText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});
