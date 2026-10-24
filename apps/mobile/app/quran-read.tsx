import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { useI18n } from '../src/services/i18n';
import QuranAyah from '../src/components/QuranAyah';
import {
  getBookmark, getFontStep, getJuzAyat, getSurahAyat, saveBookmark, saveFontStep, type Ayah,
} from '../src/services/quran';
import { BASMALAH, QURAN_SOURCE, SURAHS } from '../src/services/quran-meta';
import {
  buildReaderItems, isValidRef, DEFAULT_FONT_STEP, FONT_STEPS, JUZ_COUNT, type AyahRef, type ReaderItem,
} from '../src/services/quran-core';

type Mode = { kind: 'surah' | 'juz'; n: number };
type Item = ReaderItem<Ayah>;

// Tinggi ayat sangat beragam (tanpa getItemLayout) → gulir ke penanda diulang setiap kali ukuran konten
// berubah, sampai baris tujuan benar-benar tampil di atas layar, maksimal sebanyak ini.
const MAX_SCROLL_ATTEMPTS = 30;
const VIEWABILITY = { itemVisiblePercentThreshold: 30 };
const BASMALAH_SIZE = 26;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

function resolveMode(surah?: string, juz?: string): Mode {
  const j = Number(juz);
  if (Number.isInteger(j) && j >= 1 && j <= JUZ_COUNT) return { kind: 'juz', n: j };
  const s = Number(surah);
  return { kind: 'surah', n: isValidRef(s, 1) ? s : 1 };
}

// Layar baca per surah atau per juz: teks Arab, terjemahan, penanda terakhir dibaca, ukuran huruf.
export default function QuranReadScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const params = useLocalSearchParams<{ surah?: string; juz?: string; ayah?: string }>();
  const mode = resolveMode(params.surah, params.juz);
  // Ayat tujuan hanya berlaku di mode surah (dipakai "Lanjutkan membaca").
  const targetAyah = mode.kind === 'surah' ? Number(params.ayah) : Number.NaN;

  const [ayat, setAyat] = useState<Ayah[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [fontStep, setFontStep] = useState(DEFAULT_FONT_STEP);
  const [bookmark, setBookmark] = useState<AyahRef | null>(null);
  const listRef = useRef<FlatList<Item>>(null);
  const pendingScroll = useRef(-1);
  const scrollAttempts = useRef(0);
  // Pengguna sudah mengubah sebelum nilai tersimpan selesai dibaca → jangan ditimpa.
  const fontTouched = useRef(false);
  const bookmarkTouched = useRef(false);

  useEffect(() => {
    getFontStep().then((v) => { if (!fontTouched.current) setFontStep(v); }).catch(() => { /* bawaan */ });
    getBookmark().then((v) => { if (!bookmarkTouched.current) setBookmark(v); }).catch(() => { /* penanda opsional */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAyat([]);
    setIsLoading(true);
    setLoadFailed(false);
    (mode.kind === 'juz' ? getJuzAyat(mode.n) : getSurahAyat(mode.n))
      .then((rows) => {
        if (cancelled) return;
        if (rows.length === 0) throw new Error('data ayat kosong');
        setAyat(rows);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [mode.kind, mode.n, reloadKey]);

  const items = useMemo(() => buildReaderItems(ayat), [ayat]);
  // Baris tujuan gulir: ayat yang ditandai, atau kepala surahnya bila itu ayat pertama (basmalah tetap terlihat).
  const scrollIndex = useMemo(() => {
    if (!Number.isInteger(targetAyah)) return -1;
    const i = items.findIndex((it) => it.kind === 'ayah' && it.ayah.ayah === targetAyah);
    return i > 0 && items[i - 1].kind === 'header' ? i - 1 : i;
  }, [items, targetAyah]);

  const tryPendingScroll = useCallback(() => {
    const index = pendingScroll.current;
    if (index < 0 || scrollAttempts.current >= MAX_SCROLL_ATTEMPTS) return;
    scrollAttempts.current += 1;
    listRef.current?.scrollToIndex({ index, animated: false });
  }, []);

  useEffect(() => {
    pendingScroll.current = scrollIndex > 0 ? scrollIndex : -1;
    scrollAttempts.current = 0;
    if (pendingScroll.current < 0) return;
    const id = requestAnimationFrame(tryPendingScroll);
    return () => cancelAnimationFrame(id);
  }, [scrollIndex, tryPendingScroll]);

  // Baris tujuan belum terukur → lompat ke perkiraan; onContentSizeChange berikutnya mencoba lagi.
  const handleScrollFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    if (info.averageItemLength > 0) {
      listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    }
  }, []);

  // Selesai bila baris tujuan tampil sebagai baris teratas (atau tepat di bawah baris yang terpotong).
  const handleViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = pendingScroll.current;
    if (index < 0 || viewableItems.length === 0) return;
    const first = Math.min(...viewableItems.map((v) => v.index ?? Number.MAX_SAFE_INTEGER));
    if (first >= index - 1 && viewableItems.some((v) => v.index === index)) pendingScroll.current = -1;
  }).current;

  const handleBookmark = useCallback((a: Ayah) => {
    const ref = { surah: a.surah, ayah: a.ayah };
    bookmarkTouched.current = true;
    setBookmark(ref);
    saveBookmark(ref).catch(() => { /* tetap tampil di layar ini; penyimpanan opsional */ });
  }, []);

  const changeFont = (delta: number) => {
    const next = Math.min(Math.max(fontStep + delta, 0), FONT_STEPS.length - 1);
    if (next === fontStep) return;
    fontTouched.current = true;
    setFontStep(next);
    saveFontStep(next).catch(() => { /* preferensi opsional */ });
  };

  const scale = FONT_STEPS[fontStep];
  const title = mode.kind === 'juz' ? t('quran.juz_label', { n: mode.n }) : SURAHS[mode.n - 1].nameLatin;
  const maxN = mode.kind === 'juz' ? JUZ_COUNT : SURAHS.length;
  const goTo = (n: number) => router.replace({ pathname: '/quran-read', params: { [mode.kind]: String(n) } });
  const navLabel = (n: number) => (mode.kind === 'juz' ? t('quran.juz_label', { n }) : `${n}. ${SURAHS[n - 1].nameLatin}`);

  const renderItem = ({ item }: { item: Item }) => {
    if (item.kind === 'header') {
      const m = SURAHS[item.surah - 1];
      return (
        <View style={s.surahCard}>
          <Text style={s.surahAr}>{m.nameAr}</Text>
          <Text style={s.surahLatin}>{m.number}. {m.nameLatin}</Text>
          <Text style={s.surahInfo}>
            {lang === 'en' ? m.meaningEn : m.meaningId} · {t('quran.surah_info', { place: t(`quran.place.${m.place}`), count: m.ayahs })}
          </Text>
          {item.basmalah && (
            <Text style={[s.basmalah, { fontSize: BASMALAH_SIZE * scale, lineHeight: BASMALAH_SIZE * scale * 2 }]}>{BASMALAH}</Text>
          )}
        </View>
      );
    }
    const a = item.ayah;
    return (
      <QuranAyah
        ayah={a}
        scale={scale}
        isBookmarked={bookmark?.surah === a.surah && bookmark?.ayah === a.ayah}
        showSurahNumber={mode.kind === 'juz'}
        onBookmark={handleBookmark}
      />
    );
  };

  const footer = (
    <View style={s.footer}>
      <View style={s.navRow}>
        {mode.n > 1 ? (
          <TouchableOpacity style={s.navBtn} onPress={() => goTo(mode.n - 1)} accessibilityRole="button">
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={s.navText} numberOfLines={1}>{navLabel(mode.n - 1)}</Text>
          </TouchableOpacity>
        ) : <View />}
        {mode.n < maxN ? (
          <TouchableOpacity style={s.navBtn} onPress={() => goTo(mode.n + 1)} accessibilityRole="button">
            <Text style={s.navText} numberOfLines={1}>{navLabel(mode.n + 1)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : <View />}
      </View>
      <Text style={s.attribution}>{t('quran.translation_note')}</Text>
      <Text style={s.attribution}>{t('quran.source', { source: QURAN_SOURCE })}</Text>
    </View>
  );

  let body: React.ReactNode;
  if (isLoading && ayat.length === 0) {
    body = <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />;
  } else if (loadFailed) {
    body = (
      <View style={s.failed}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
        <Text style={s.failedText}>{t('quran.load_failed')}</Text>
        <TouchableOpacity style={s.retry} onPress={() => setReloadKey((k) => k + 1)} accessibilityRole="button">
          <Text style={s.retryText}>{t('quran.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <FlatList
        key={`${mode.kind}${mode.n}`}
        ref={listRef}
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        extraData={`${fontStep}|${lang}|${bookmark?.surah}:${bookmark?.ayah}`}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onContentSizeChange={tryPendingScroll}
        onScrollBeginDrag={() => { pendingScroll.current = -1; }}
        onScrollToIndexFailed={handleScrollFailed}
        onViewableItemsChanged={handleViewable}
        viewabilityConfig={VIEWABILITY}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={s.fontButtons}>
          <TouchableOpacity
            style={s.fontBtn}
            onPress={() => changeFont(-1)}
            disabled={fontStep === 0}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t('quran.font_smaller')}>
            <Text style={[s.fontBtnText, s.fontSmall, fontStep === 0 && s.fontDisabled]}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.fontBtn}
            onPress={() => changeFont(1)}
            disabled={fontStep === FONT_STEPS.length - 1}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t('quran.font_larger')}>
            <Text style={[s.fontBtnText, fontStep === FONT_STEPS.length - 1 && s.fontDisabled]}>A</Text>
          </TouchableOpacity>
        </View>
      </View>
      {body}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  fontButtons: { flexDirection: 'row', gap: 6 },
  fontBtn: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  fontBtnText: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  fontSmall: { fontSize: 13 },
  fontDisabled: { color: colors.textFaint },
  surahCard: {
    alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 4, paddingVertical: 18, paddingHorizontal: 16,
    borderRadius: 16, backgroundColor: colors.primary,
  },
  surahAr: { fontSize: 30, lineHeight: 52, fontFamily: 'Amiri_700Bold', color: colors.goldLight },
  surahLatin: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textOnPrimary },
  surahInfo: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primaryLight, marginTop: 4, textAlign: 'center' },
  basmalah: { marginTop: 12, fontFamily: 'Amiri_400Regular', color: colors.textOnPrimary, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 20, gap: 6 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '48%', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  navText: { flexShrink: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  attribution: { fontSize: 11, lineHeight: 16, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center' },
  failed: { alignItems: 'center', gap: 12, padding: 32, marginTop: 24 },
  failedText: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});
