import { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { useI18n } from '../src/services/i18n';
import { useAuthStore } from '../src/stores/auth';
import { api, getAuthHeaders } from '../src/services/api';
import {
  forgetMedia, getRememberedMedia, GalleryPermissionError, markAlbumDirty, mediaUrl, rememberMedia, saveToGallery, shareMedia,
} from '../src/services/documentation';
import { formatDuration } from '../src/services/documentation-core';
import DocumentationVideo from '../src/components/DocumentationVideo';

type Busy = 'save' | 'share' | 'delete' | 'caption' | null;
type ActionKey = Exclude<Busy, null>;

const MAX_CAPTION = 200;

// Satu foto/video Dokumentasi: tampil penuh, simpan ke galeri, bagikan (mis. WhatsApp), ubah keterangan, hapus.
export default function DocumentationViewScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const user = useAuthStore((st) => st.user);
  const params = useLocalSearchParams<{ id?: string; mod?: string }>();
  const [item, setItem] = useState(() => (params.id ? getRememberedMedia(params.id) : null));
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [imageState, setImageState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [imageKey, setImageKey] = useState(0);

  useEffect(() => {
    getAuthHeaders().then(setHeaders).catch(() => setHeaders({}));
  }, []);

  // Gagal memuat (offline / token kedaluwarsa / sudah lewat masa simpan) → tampilkan pesan + coba lagi.
  const retryImage = () => {
    setImageState('loading');
    getAuthHeaders(true)
      .then(setHeaders)
      .catch(() => { /* pakai header lama */ })
      .finally(() => setImageKey((k) => k + 1));
  };

  if (!item) {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <Text style={s.notFound}>{t('doc.not_found')}</Text>
        <TouchableOpacity style={s.closeAlone} onPress={() => router.back()} accessibilityRole="button">
          <Text style={s.closeAloneText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isUploader = item.uploader_id != null && item.uploader_id === user?.id;
  // Hak sebenarnya ditegakkan server; ini hanya menyembunyikan tombol yang pasti ditolak.
  const canDelete = isUploader || params.mod === '1' || user?.role === 'admin';
  const uploader = item.uploader_name ?? t('doc.unknown_uploader');
  const isVideo = item.kind === 'video';
  const mediaLabel = item.caption ?? (isVideo
    ? t('doc.video_label', { duration: formatDuration(item.duration_ms), name: uploader })
    : t('doc.photo_label', { name: uploader }));
  const when = new Date(item.taken_at).toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const run = async (kind: ActionKey, action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      if (err instanceof GalleryPermissionError && err.message === 'settings') {
        Alert.alert(t('doc.title'), t('doc.gallery_denied'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('loc.open_settings'), onPress: () => { void Linking.openSettings(); } },
        ]);
      } else {
        Alert.alert(t('doc.title'), err instanceof GalleryPermissionError ? t('doc.gallery_denied') : t('doc.action_failed'));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSave = () => run('save', async () => {
    await saveToGallery(item);
    Alert.alert(t('doc.title'), t('doc.saved'));
  });

  const handleShare = () => run('share', () => shareMedia(item, t('doc.share_title')));

  const handleDelete = () => {
    Alert.alert(t('doc.delete_confirm_title'), t('doc.delete_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('doc.delete'),
        style: 'destructive',
        onPress: () => {
          void run('delete', async () => {
            await api.deleteMedia(item.id);
            forgetMedia(item.id);
            markAlbumDirty();
            router.back();
          });
        },
      },
    ]);
  };

  const handleSaveCaption = () => run('caption', async () => {
    const res = await api.updateMediaCaption(item.id, draft.trim() || null);
    const next = { ...item, caption: res.caption };
    rememberMedia([next]);
    markAlbumDirty();
    setItem(next);
    setIsEditing(false);
  });

  const actions: Array<{ key: ActionKey; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; isShown: boolean }> = [
    { key: 'save', icon: 'download-outline', label: t('doc.save'), onPress: () => { void handleSave(); }, isShown: true },
    { key: 'share', icon: 'share-social-outline', label: t('doc.share'), onPress: () => { void handleShare(); }, isShown: true },
    { key: 'caption', icon: 'create-outline', label: t('doc.edit_caption'), onPress: () => { setDraft(item.caption ?? ''); setIsEditing(true); }, isShown: isUploader },
    { key: 'delete', icon: 'trash-outline', label: t('doc.delete'), onPress: handleDelete, isShown: canDelete },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <TouchableOpacity onPress={() => router.back()} style={s.topBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        {item.is_official && (
          <View style={s.official}>
            <Ionicons name="ribbon" size={13} color={colors.textOnPrimary} />
            <Text style={s.officialText}>{t('doc.official')}</Text>
          </View>
        )}
      </View>

      <View style={s.imageWrap}>
        {headers && isVideo && (
          <DocumentationVideo
            key={imageKey}
            uri={mediaUrl(item.id, 'file')}
            headers={headers}
            accessibilityLabel={mediaLabel}
            onRetry={retryImage}
          />
        )}
        {headers && !isVideo && (
          <Image
            key={imageKey}
            source={{ uri: mediaUrl(item.id, 'file'), headers }}
            style={s.image}
            resizeMode="contain"
            onLoad={() => setImageState('ok')}
            onError={() => setImageState('failed')}
            accessibilityLabel={mediaLabel}
          />
        )}
        {(!headers || (!isVideo && imageState === 'loading')) && <ActivityIndicator style={s.overlay} color="#fff" />}
        {!isVideo && imageState === 'failed' && (
          <View style={[s.overlay, s.failedBox]}>
            <Text style={s.failedText}>{t('doc.image_failed')}</Text>
            <TouchableOpacity style={s.closeAlone} onPress={retryImage} accessibilityRole="button">
              <Text style={s.closeAloneText}>{t('doc.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.panel}>
        {item.caption ? <Text style={s.caption}>{item.caption}</Text> : null}
        <Text style={s.metaText}>{t('doc.by', { name: uploader })} · {when}</Text>
        {item.schedule_title ? <Text style={s.metaText}>{item.schedule_title}</Text> : null}
        <View style={s.actions}>
          {actions.filter((a) => a.isShown).map((a) => (
            <TouchableOpacity key={a.key} style={s.action} onPress={a.onPress} disabled={busy !== null} accessibilityRole="button">
              {busy === a.key ? <ActivityIndicator color="#fff" /> : <Ionicons name={a.icon} size={22} color="#fff" />}
              <Text style={s.actionText} numberOfLines={2}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal visible={isEditing} transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
        <KeyboardAvoidingView style={s.editBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.editSheet}>
            <Text style={s.editTitle}>{t('doc.edit_caption')}</Text>
            <TextInput
              style={s.editInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('doc.caption_placeholder')}
              placeholderTextColor={colors.textFaint}
              maxLength={MAX_CAPTION}
              multiline
              autoFocus
              accessibilityLabel={t('doc.edit_caption')}
            />
            <View style={s.editButtons}>
              <TouchableOpacity onPress={() => setIsEditing(false)} style={s.editBtn} accessibilityRole="button">
                <Text style={s.editCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { void handleSaveCaption(); }} style={[s.editBtn, s.editSave]} disabled={busy !== null} accessibilityRole="button">
                {busy === 'caption' ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={s.editSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#14110D' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFound: { fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#fff' },
  closeAlone: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  closeAloneText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { padding: 6 },
  official: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primary },
  officialText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute' },
  failedBox: { alignItems: 'center', paddingHorizontal: 24 },
  failedText: { fontSize: 14, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#fff' },
  image: { width: '100%', height: '100%' },
  panel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
  caption: { fontSize: 15, lineHeight: 21, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
  metaText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.75)' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  action: { alignItems: 'center', gap: 4, minWidth: 64, maxWidth: 90, paddingVertical: 6 },
  actionText: { fontSize: 11, textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
  editBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' },
  editSheet: { backgroundColor: colors.bg, borderRadius: 16, padding: 16 },
  editTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 10 },
  editInput: {
    minHeight: 70, maxHeight: 140, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text, textAlignVertical: 'top',
  },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 80, alignItems: 'center' },
  editCancel: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  editSave: { backgroundColor: colors.primary },
  editSaveText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});
