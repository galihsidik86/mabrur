import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { api } from '../src/services/api';
import { useI18n } from '../src/services/i18n';

const { width } = Dimensions.get('window');

const slides = [
  {
    icon: 'book' as const,
    title: 'account.onb_guide_title',
    desc: 'account.onb_guide_desc',
    color: colors.primary,
  },
  {
    icon: 'map' as const,
    title: 'account.onb_miqat_title',
    desc: 'account.onb_miqat_desc',
    color: colors.primary,
  },
  {
    icon: 'radio' as const,
    title: 'account.onb_sos_title',
    desc: 'account.onb_sos_desc',
    color: colors.primary,
  },
  {
    icon: 'chatbubbles' as const,
    title: 'account.onb_chat_title',
    desc: 'account.onb_chat_desc',
    color: colors.primary,
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const [page, setPage] = useState(0);

  const finish = async () => {
    try { await api.markOnboarded(); } catch {}
    router.replace('/(tabs)');
  };

  const slide = slides[page];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <View style={[s.iconCircle, { backgroundColor: slide.color }]}>
          <Ionicons name={slide.icon} size={48} color="#fff" />
        </View>
        <Text style={s.title}>{t(slide.title)}</Text>
        <Text style={s.desc}>{t(slide.desc)}</Text>
      </View>

      {/* Dots */}
      <View style={s.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[s.dot, i === page && s.dotActive]} />
        ))}
      </View>

      {/* Buttons */}
      <View style={s.buttons}>
        {page < slides.length - 1 ? (
          <>
            <TouchableOpacity onPress={finish} hitSlop={8} accessibilityRole="button"><Text style={s.skipText}>{t('account.onb_skip')}</Text></TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={() => setPage(page + 1)}>
              <Text style={s.nextText}>{t('account.onb_next')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[s.nextBtn, { flex: 1 }]} onPress={finish}>
            <Text style={s.nextText}>{t('account.onb_start')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 100, height: 100, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 23, maxWidth: width * 0.8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, padding: 8 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  nextText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
});
