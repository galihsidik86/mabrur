import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/theme';
import { api } from '../src/services/api';

const { width } = Dimensions.get('window');

const slides = [
  {
    icon: 'book' as const,
    title: 'Tuntunan Ibadah',
    desc: 'Panduan lengkap umrah dan haji, langkah demi langkah dengan doa dalam bahasa Arab, Latin, dan terjemahan.',
    color: colors.primary,
  },
  {
    icon: 'map' as const,
    title: 'Geofence Miqat',
    desc: 'Peringatan otomatis saat mendekati batas miqat. Tidak perlu khawatir melewati batas tanpa ihram.',
    color: colors.green,
  },
  {
    icon: 'radio' as const,
    title: 'SOS Darurat',
    desc: 'Kirim sinyal darurat ke muthawwif dengan satu ketukan. Lokasi dan data medis otomatis dibagikan.',
    color: colors.danger,
  },
  {
    icon: 'chatbubbles' as const,
    title: 'Chat & Monitoring',
    desc: 'Tetap terhubung dengan rombongan. Muthawwif memantau lokasi dan status seluruh jamaah real-time.',
    color: colors.gold,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
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
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.desc}>{slide.desc}</Text>
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
            <TouchableOpacity onPress={finish}><Text style={s.skipText}>Lewati</Text></TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={() => setPage(page + 1)}>
              <Text style={s.nextText}>Lanjut</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[s.nextBtn, { flex: 1 }]} onPress={finish}>
            <Text style={s.nextText}>Mulai Mabrur</Text>
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
