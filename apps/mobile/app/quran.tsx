import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { useI18n } from '../src/services/i18n';
import { getBookmark, prepareQuran } from '../src/services/quran';
import { SURAHS } from '../src/services/quran-meta';
import { JUZ_COUNT, juzSegments, searchSurahs, type AyahRef, type SurahMeta } from '../src/services/quran-core';

type Tab = 'surah' | 'juz';

const JUZ_LIST = Array.from({ length: JUZ_COUNT }, (_, i) => i + 1);

// Daftar Al-Qur'an: lanjutkan dari penanda, lalu pilih per surah (dengan pencarian) atau per juz.
export default function QuranScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const [tab, setTab] = useState<Tab>('surah');
  const [query, setQuery] = useState('');
  const [bookmark, setBookmark] = useState<AyahRef | null>(null);

  // Salin & periksa data offline sejak daftar dibuka, agar layar baca langsung tampil.
  useEffect(() => { prepareQuran(); }, []);

  // Penanda bisa berubah di layar baca → muat ulang setiap kali layar ini kembali tampil.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    getBookmark()
      .then((b) => { if (!cancelled) setBookmark(b); })
      .catch(() => { /* penanda opsional */ });
    return () => { cancelled = true; };
  }, []));

  const surahs = useMemo(() => searchSurahs(query), [query]);
  const meaning = (m: SurahMeta) => (lang === 'en' ? m.meaningEn : m.meaningId);
  const openSurah = (surah: number, ayah?: number) =>
    router.push({ pathname: '/quran-read', params: ayah ? { surah: String(surah), ayah: String(ayah) } : { surah: String(surah) } });

  const header = (
    <View>
      {bookmark ? (
        <TouchableOpacity style={s.continueCard} activeOpacity={0.8} onPress={() => openSurah(bookmark.surah, bookmark.ayah)} accessibilityRole="button">
          <Ionicons name="bookmark" size={22} color={colors.goldLight} />
          <View style={{ flex: 1 }}>
            <Text style={s.continueTitle}>{t('quran.continue')}</Text>
            <Text style={s.continueSub}>
              {t('quran.continue_sub', { surah: SURAHS[bookmark.surah - 1].nameLatin, ayah: bookmark.ayah })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={s.hintCard}>
          <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
          <Text style={s.hintText}>{t('quran.no_bookmark')}</Text>
        </View>
      )}

      <View style={s.tabs} accessibilityRole="tablist">
        {(['surah', 'juz'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[s.tab, tab === k && s.tabActive]}
            onPress={() => setTab(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabText, tab === k && s.tabTextActive]}>{t(k === 'surah' ? 'quran.tab_surah' : 'quran.tab_juz')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'surah' && (
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('quran.search')}
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t('quran.search')}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('quran.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      {tab === 'surah' ? (
        <FlatList
          key="surah"
          data={surahs}
          keyExtractor={(m) => String(m.number)}
          ListHeaderComponent={header}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>{t('quran.no_result')}</Text>}
          renderItem={({ item: m }) => (
            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => openSurah(m.number)} accessibilityRole="button">
              <View style={s.numBadge}><Text style={s.numText}>{m.number}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{m.nameLatin}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {meaning(m)} · {t('quran.surah_info', { place: t(`quran.place.${m.place}`), count: m.ayahs })}
                </Text>
              </View>
              <Text style={s.rowArabic}>{m.nameAr}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          key="juz"
          data={JUZ_LIST}
          keyExtractor={(j) => String(j)}
          ListHeaderComponent={header}
          contentContainerStyle={s.list}
          renderItem={({ item: juz }) => {
            const segs = juzSegments(juz);
            const first = segs[0];
            const last = segs[segs.length - 1];
            const range = `${SURAHS[first.surah - 1].nameLatin} ${first.from} – ${SURAHS[last.surah - 1].nameLatin} ${last.to}`;
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/quran-read', params: { juz: String(juz) } })}
                accessibilityRole="button">
                <View style={s.numBadge}><Text style={s.numText}>{juz}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{t('quran.juz_label', { n: juz })}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{range}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  continueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16,
    backgroundColor: colors.primary, marginBottom: 16,
  },
  continueTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  continueSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primaryLight, marginTop: 2 },
  hintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
    backgroundColor: colors.surface, marginBottom: 16,
  },
  hintText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  numBadge: {
    width: 38, height: 38, borderRadius: 10, transform: [{ rotate: '45deg' }],
    borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2,
  },
  numText: { transform: [{ rotate: '-45deg' }], fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primaryDark },
  rowTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  rowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2 },
  rowArabic: { fontSize: 22, fontFamily: 'Amiri_700Bold', color: colors.primary, writingDirection: 'rtl' },
});
