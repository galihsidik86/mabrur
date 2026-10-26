import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, SectionList, StyleSheet, ActivityIndicator, Modal, Alert, Linking, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../src/theme';
import { useI18n } from '../src/services/i18n';
import { useAuthStore } from '../src/stores/auth';
import { api, getAuthHeaders, type GroupMedia, type GroupMediaMeta } from '../src/services/api';
import { getGroupMembers, getGroups, getSchedules, type Schedule } from '../src/services/db';
import {
  consumeAlbumDirty, discardQueued, enqueueMedia, getQueue, mediaUrl, processQueue, rememberMedia, retryQueued, subscribeQueue,
  VideoTooLargeError, type PickedMedia, type QueuedMedia,
} from '../src/services/documentation';
import {
  chunk, formatBytes, formatDuration, groupByDay, groupBySchedule, isVideoTooLong, parseExifDate, suggestSchedule,
  MAX_PICK, VIDEO_MAX_DURATION_MS,
} from '../src/services/documentation-core';
import UploadQueue from '../src/components/UploadQueue';
import DocumentationCompose from '../src/components/DocumentationCompose';

type Mode = 'day' | 'activity';
type Source = 'camera' | 'video' | 'gallery';

const SOURCES = [
  ['camera', 'camera-outline', 'doc.camera'],
  ['video', 'videocam-outline', 'doc.record_video'],
  ['gallery', 'images-outline', 'doc.gallery'],
] as const;

const PAGE_SIZE = 60;
const COLUMNS = 3;
const GAP = 4;
const SCREEN_PADDING = 16;
// Antrean dicoba lagi berkala selama layar terbuka (tanpa NetInfo: sinyal bisa kembali kapan saja).
const QUEUE_POLL_MS = 30_000;
const RETENTION_DAYS = 180;

// Video > 60 detik dari galeri dilewati (kamera sudah dibatasi videoMaxDuration) dan dihitung untuk pemberitahuan.
function toPicked(result: ImagePicker.ImagePickerResult, source: Source): { items: PickedMedia[]; tooLong: number } {
  if (result.canceled) return { items: [], tooLong: 0 };
  const all = result.assets.slice(0, MAX_PICK).map((a): PickedMedia => {
    const isVideo = a.type === 'video';
    return {
      kind: isVideo ? 'video' : 'photo',
      uri: a.uri,
      width: a.width,
      height: a.height,
      durationMs: isVideo ? a.duration ?? null : null,
      // Tanpa EXIF (tangkapan layar, foto WhatsApp, video galeri) → server memakai waktu unggah.
      takenAt: parseExifDate(a.exif?.DateTimeOriginal) ?? (source === 'gallery' ? null : new Date().toISOString()),
    };
  });
  const items = all.filter((p) => p.kind === 'photo' || !isVideoTooLong(p.durationMs));
  return { items, tooLong: all.length - items.length };
}

// Album Dokumentasi rombongan: per hari atau per kegiatan, unggah dari kamera/galeri lewat antrean.
export default function DocumentationScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const user = useAuthStore((st) => st.user);
  const { width } = useWindowDimensions();

  const [groupId, setGroupId] = useState<string | null | undefined>(undefined);
  const [isMuthawwif, setIsMuthawwif] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [items, setItems] = useState<GroupMedia[]>([]);
  const [meta, setMeta] = useState<GroupMediaMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('day');
  const [officialOnly, setOfficialOnly] = useState(false);
  const [queue, setQueue] = useState<QueuedMedia[]>([]);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [imageEpoch, setImageEpoch] = useState(0);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [compressPct, setCompressPct] = useState<number | null>(null);
  const loadSeq = useRef(0);
  const hasLoaded = useRef(false);
  const pendingSource = useRef<Source | null>(null);
  const headerRefreshing = useRef(false);
  const headersRef = useRef(headers);
  useEffect(() => { headersRef.current = headers; }, [headers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let groups: Array<{ id: string }> = await getGroups().catch(() => []);
      // Data lokal belum tersinkron (baru login) → tanya server.
      if (groups.length === 0) groups = await api.getGroups().catch(() => []);
      const id = groups[0]?.id ?? null;
      if (id) {
        const members = await getGroupMembers(id).catch(() => []);
        const me = members.find((m) => m.user_id === user?.id);
        // Data anggota lokal belum ada → perkiraan dari peran akun (server tetap menegakkan hak).
        const isMod = me ? me.role_in_group === 'muthawwif' : user?.role === 'muthawwif';
        const sched = await getSchedules(id).catch(() => []);
        if (cancelled) return;
        setIsMuthawwif(isMod);
        setSchedules(sched);
      }
      if (!cancelled) setGroupId(id);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  // Android bisa mematikan aplikasi saat kamera terbuka (HP RAM kecil) → ambil hasil yang tertunda.
  useEffect(() => {
    ImagePicker.getPendingResultAsync()
      .then((res) => {
        if (!res || !('assets' in res)) return;
        const { items, tooLong } = toPicked(res, 'camera');
        if (tooLong > 0) Alert.alert(t('doc.title'), t('doc.video_too_long', { count: tooLong }));
        setPicked(items);
      })
      .catch(() => { /* tidak ada hasil tertunda */ });
  }, []);

  const load = useCallback(async (page: number) => {
    if (!groupId) return;
    const seq = ++loadSeq.current;
    if (page === 1) { setIsLoading(true); setLoadFailed(false); } else setIsLoadingMore(true);
    try {
      const res = await api.listGroupMedia(groupId, page, PAGE_SIZE, officialOnly);
      if (seq !== loadSeq.current) return;
      rememberMedia(res.data);
      setMeta(res.meta);
      setItems((prev) => {
        if (page === 1) return res.data;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.data.filter((d) => !seen.has(d.id))];
      });
    } catch {
      if (seq === loadSeq.current && page === 1) setLoadFailed(true);
    } finally {
      if (seq === loadSeq.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [groupId, officialOnly]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Muat pertama & saat filter "Resmi saja" berubah.
  useEffect(() => {
    if (!groupId) {
      if (groupId === null) setIsLoading(false);
      return;
    }
    consumeAlbumDirty();
    hasLoaded.current = true;
    void load(1);
  }, [groupId, load]);

  const refreshQueue = useCallback(async () => {
    setQueue(await getQueue().catch(() => [] as QueuedMedia[]));
    // Foto baru sampai di server → muat ulang halaman pertama album.
    if (hasLoaded.current && consumeAlbumDirty()) void loadRef.current(1);
  }, []);

  useEffect(() => subscribeQueue(() => { void refreshQueue(); }), [refreshQueue]);

  // Kembali ke layar ini: muat ulang album hanya bila ada perubahan (hapus/ubah keterangan/foto baru),
  // agar posisi gulir & halaman yang sudah dimuat tidak hilang.
  useFocusEffect(useCallback(() => {
    if (!groupId) return undefined;
    getAuthHeaders().then(setHeaders).catch(() => { /* gambar gagal lalu dicoba lagi di onError */ });
    void refreshQueue();
    void processQueue();
    const id = setInterval(() => { void processQueue(); }, QUEUE_POLL_MS);
    return () => clearInterval(id);
  }, [groupId, refreshQueue]));

  // Gambar gagal dimuat: bila token sudah diperbarui, muat ulang tile (paling sering sekali per 30 dtk).
  const handleImageError = useCallback(() => {
    if (headerRefreshing.current) return;
    headerRefreshing.current = true;
    getAuthHeaders()
      .then((next) => {
        if (next.Authorization === headersRef.current.Authorization) return;
        setHeaders(next);
        setImageEpoch((e) => e + 1);
      })
      .catch(() => { /* offline — dicoba lagi saat layar dibuka ulang */ })
      .finally(() => { setTimeout(() => { headerRefreshing.current = false; }, QUEUE_POLL_MS); });
  }, []);

  const formatDay = useCallback((key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }, [lang]);

  const sections = useMemo(() => {
    const grouped = mode === 'day' ? groupByDay(items, formatDay) : groupBySchedule(items, t('doc.other'));
    return grouped.map((sec) => ({ key: sec.key, title: sec.title, data: chunk(sec.data, COLUMNS) }));
  }, [items, mode, formatDay, t]);

  const deniedAlert = (message: string, canAskAgain: boolean) => {
    Alert.alert(t('doc.title'), message, canAskAgain ? undefined : [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('loc.open_settings'), onPress: () => { void Linking.openSettings(); } },
    ]);
  };

  const launch = async (source: Source): Promise<ImagePicker.ImagePickerResult | null> => {
    if (source === 'gallery') {
      return ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: MAX_PICK, orderedSelection: true,
        quality: 1, exif: true,
        // iOS: jangan transkode video saat memilih (lambat); kompresi dilakukan sendiri sebelum unggah.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { deniedAlert(t('doc.camera_denied'), perm.canAskAgain); return null; }
    if (source === 'video') {
      return ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: VIDEO_MAX_DURATION_MS / 1000,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
      });
    }
    return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true });
  };

  const pick = async (source: Source) => {
    try {
      const result = await launch(source);
      if (!result) return;
      const { items, tooLong } = toPicked(result, source);
      if (tooLong > 0) Alert.alert(t('doc.title'), t('doc.video_too_long', { count: tooLong }));
      if (items.length) setPicked(items);
    } catch {
      Alert.alert(t('doc.title'), t('doc.prepare_failed'));
    }
  };

  // iOS menolak membuka picker selagi Modal masih menutup → tunggu onDismiss (hanya iOS memanggilnya).
  const chooseSource = (source: Source) => {
    setIsSourceOpen(false);
    if (Platform.OS === 'ios') pendingSource.current = source;
    else void pick(source);
  };

  const handleSourceDismiss = () => {
    const source = pendingSource.current;
    pendingSource.current = null;
    if (source) void pick(source);
  };

  const submit = async (caption: string | null, scheduleId: string | null) => {
    if (!groupId) return;
    setIsPreparing(true);
    try {
      // Semua-atau-tidak: gagal → tidak ada yang masuk antrean, aman ditekan ulang.
      await enqueueMedia(groupId, picked, caption, scheduleId, (index, ratio) => {
        setCompressPct(picked[index]?.kind === 'video' && ratio < 1 ? Math.round(ratio * 100) : null);
      });
      setPicked([]);
    } catch (err) {
      Alert.alert(t('doc.title'), t(err instanceof VideoTooLargeError ? 'doc.video_too_large' : 'doc.prepare_failed'));
    } finally {
      setIsPreparing(false);
      setCompressPct(null);
    }
  };

  const confirmDiscard = (id: number) => {
    Alert.alert(t('doc.discard_confirm_title'), t('doc.discard_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('doc.discard'), style: 'destructive', onPress: () => { void discardQueued(id); } },
    ]);
  };

  const tileSize = Math.floor((width - SCREEN_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const decimalSep = lang === 'en' ? '.' : ',';
  const usageRatio = meta ? Math.min(1, meta.used_bytes / meta.quota_bytes) : 0;

  const header = (
    <View>
      {meta && (
        <View style={s.usage}>
          <Text style={s.usageText}>
            {t('doc.usage', { used: formatBytes(meta.used_bytes, decimalSep), quota: formatBytes(meta.quota_bytes, decimalSep) })}
          </Text>
          <View style={s.usageBar}>
            <View style={[s.usageFill, { width: `${Math.max(1, usageRatio * 100)}%` }, usageRatio > 0.9 && s.usageFull]} />
          </View>
          <Text style={s.retention}>{t('doc.retention', { days: RETENTION_DAYS })}</Text>
        </View>
      )}

      <View style={s.controls}>
        <View style={s.tabs} accessibilityRole="tablist">
          {(['day', 'activity'] as const).map((k) => (
            <TouchableOpacity key={k} style={[s.tab, mode === k && s.tabActive]} onPress={() => setMode(k)} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
              <Text style={[s.tabText, mode === k && s.tabTextActive]}>{t(k === 'day' ? 'doc.by_day' : 'doc.by_activity')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[s.filter, officialOnly && s.filterOn]}
          onPress={() => setOfficialOnly((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: officialOnly }}>
          <Ionicons name="ribbon-outline" size={15} color={officialOnly ? colors.textOnPrimary : colors.primary} />
          <Text style={[s.filterText, officialOnly && s.filterTextOn]}>{t('doc.official_only')}</Text>
        </TouchableOpacity>
      </View>

      <UploadQueue queue={queue} onRetry={(id) => { void retryQueued(id); }} onDiscard={confirmDiscard} />

      {loadFailed && (
        <View style={s.failed}>
          <Text style={s.failedText}>{t('doc.load_failed')}</Text>
          <TouchableOpacity onPress={() => { void load(1); }} accessibilityRole="button">
            <Text style={s.retryText}>{t('doc.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  let body: React.ReactNode;
  if (groupId === null) {
    body = <Text style={s.empty}>{t('doc.no_group')}</Text>;
  } else if (groupId === undefined || (isLoading && items.length === 0 && !loadFailed)) {
    body = <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  } else {
    body = (
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.map((r) => r.id).join('|')}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        stickySectionHeadersEnabled={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (meta && items.length < meta.total && !isLoadingMore && !isLoading) void load(meta.page + 1);
        }}
        ListEmptyComponent={!loadFailed ? <Text style={s.empty}>{t('doc.empty')}</Text> : null}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionTitle} accessibilityRole="header">{section.title}</Text>
        )}
        renderItem={({ item: row }) => (
          <View style={s.row}>
            {row.map((m) => {
              const isVideo = m.kind === 'video';
              const name = m.uploader_name ?? t('doc.unknown_uploader');
              const label = isVideo
                ? t('doc.video_label', { duration: formatDuration(m.duration_ms), name })
                : t('doc.photo_label', { name });
              const tileStyle = [s.tile, { width: tileSize, height: tileSize }];
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/documentation-view', params: { id: m.id, mod: isMuthawwif ? '1' : '0' } })}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={m.caption ? `${m.caption}. ${label}` : label}>
                  {/* Video tanpa thumbnail (gagal dibuat di HP): ikon pengganti, bukan permintaan yang pasti 404. */}
                  {isVideo && !m.has_thumb ? (
                    <View style={[tileStyle, s.tilePlaceholder]}>
                      <Ionicons name="videocam" size={28} color={colors.textMuted} />
                    </View>
                  ) : (
                    <Image
                      key={`${m.id}-${imageEpoch}`}
                      source={{ uri: mediaUrl(m.id, 'thumb'), headers }}
                      style={tileStyle}
                      resizeMethod="resize"
                      onError={handleImageError}
                    />
                  )}
                  {isVideo && (
                    <View style={s.videoTag}>
                      <Ionicons name="play" size={11} color="#fff" />
                      {m.duration_ms ? <Text style={s.videoTagText}>{formatDuration(m.duration_ms)}</Text> : null}
                    </View>
                  )}
                  {m.is_official && (
                    <View style={s.badge}><Ionicons name="ribbon" size={12} color={colors.textOnPrimary} /></View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('doc.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      {body}

      {groupId && (
        <TouchableOpacity style={s.fab} onPress={() => setIsSourceOpen(true)} accessibilityRole="button" accessibilityLabel={t('doc.add')}>
          <Ionicons name="add" size={30} color={colors.textOnPrimary} />
        </TouchableOpacity>
      )}

      <Modal
        visible={isSourceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSourceOpen(false)}
        onDismiss={handleSourceDismiss}>
        <TouchableOpacity
          style={s.sourceBackdrop}
          activeOpacity={1}
          onPress={() => setIsSourceOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}>
          <View style={s.sourceSheet}>
            <Text style={s.sourceTitle}>{t('doc.add')}</Text>
            {SOURCES.map(([key, icon, label]) => (
              <TouchableOpacity key={key} style={s.sourceBtn} onPress={() => chooseSource(key)} accessibilityRole="button">
                <Ionicons name={icon} size={22} color={colors.primary} />
                <Text style={s.sourceText}>{t(label)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <DocumentationCompose
        photos={picked}
        schedules={schedules}
        defaultScheduleId={suggestSchedule(schedules, new Date())}
        isSubmitting={isPreparing}
        compressPct={compressPct}
        onCancel={() => setPicked([])}
        onSubmit={(caption, scheduleId) => { void submit(caption, scheduleId); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 110 },
  usage: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 14 },
  usageText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary },
  usageBar: { height: 6, borderRadius: 3, backgroundColor: colors.surface, marginTop: 8, overflow: 'hidden' },
  usageFill: { height: 6, backgroundColor: colors.green },
  usageFull: { backgroundColor: colors.danger },
  retention: { fontSize: 11, lineHeight: 16, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  filter: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card,
  },
  filterOn: { backgroundColor: colors.primary },
  filterText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  filterTextOn: { color: colors.textOnPrimary },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceWarm, borderRadius: 12, padding: 12, marginBottom: 14 },
  failedText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
  retryText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  empty: { textAlign: 'center', marginTop: 32, marginHorizontal: 24, fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  sectionTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 10, marginBottom: 8 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: { borderRadius: 6, backgroundColor: colors.surface },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  videoTag: {
    position: 'absolute', left: 5, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(31,27,22,0.7)',
  },
  videoTagText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  badge: {
    position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  sourceBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,27,22,0.45)' },
  sourceSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28, gap: 8 },
  sourceTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 4 },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sourceText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
});
