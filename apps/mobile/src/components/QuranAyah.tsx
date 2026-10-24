import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';
import type { Ayah } from '../services/quran';

type Props = {
  ayah: Ayah;
  scale: number;
  isBookmarked: boolean;
  showSurahNumber: boolean;
  onBookmark: (ayah: Ayah) => void;
};

const ARABIC_SIZE = 26;
const TRANSLATION_SIZE = 15;
const FOOTNOTE_SIZE = 12;
// Teks Utsmani punya tanda di atas & bawah huruf → baris Arab perlu jarak lega.
const ARABIC_LINE = 2.0;
const LATIN_LINE = 1.5;
// Pengali huruf sistem dibatasi: sudah ada pengaturan ukuran sendiri (FONT_STEPS) di layar baca.
const MAX_SYSTEM_SCALE = 1.3;

// Satu ayat: nomor + tombol penanda, teks Arab (rata kanan), terjemahan Kemenag, catatan kaki.
function QuranAyah({ ayah, scale, isBookmarked, showSurahNumber, onBookmark }: Props) {
  const t = useI18n((st) => st.t);
  const number = showSurahNumber ? `${ayah.surah}:${ayah.ayah}` : String(ayah.ayah);
  const arabicSize = ARABIC_SIZE * scale;
  const translationSize = TRANSLATION_SIZE * scale;
  const footnoteSize = FOOTNOTE_SIZE * scale;

  return (
    <View style={[s.wrap, isBookmarked && s.wrapMarked]}>
      <View style={s.topRow}>
        <View style={s.badge} accessible accessibilityLabel={t('quran.ayah_label', { n: number })}>
          <Text style={s.badgeText}>{number}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onBookmark(ayah)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t(isBookmarked ? 'quran.bookmarked' : 'quran.bookmark', { ayah: ayah.ayah })}>
          <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={isBookmarked ? colors.primary : colors.textFaint} />
        </TouchableOpacity>
      </View>
      <Text maxFontSizeMultiplier={MAX_SYSTEM_SCALE} style={[s.arabic, { fontSize: arabicSize, lineHeight: arabicSize * ARABIC_LINE }]}>
        {ayah.textAr}
      </Text>
      <Text maxFontSizeMultiplier={MAX_SYSTEM_SCALE} style={[s.translation, { fontSize: translationSize, lineHeight: translationSize * LATIN_LINE }]}>
        {ayah.translation}
      </Text>
      {ayah.footnotes.length > 0 && (
        <Text maxFontSizeMultiplier={MAX_SYSTEM_SCALE} style={[s.footnote, { fontSize: footnoteSize, lineHeight: footnoteSize * LATIN_LINE }]}>
          {ayah.footnotes}
        </Text>
      )}
    </View>
  );
}

export default memo(QuranAyah);

const s = StyleSheet.create({
  wrap: { paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  wrapMarked: { backgroundColor: colors.goldLight },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  badge: { minWidth: 34, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surface, alignItems: 'center' },
  badgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primaryDark },
  arabic: { fontFamily: 'Amiri_400Regular', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  translation: { marginTop: 10, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
  footnote: {
    marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border,
    fontFamily: 'PlusJakartaSans_400Regular', color: colors.textMuted,
  },
});
