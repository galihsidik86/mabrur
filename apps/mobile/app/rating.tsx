import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';

export default function RatingScreen() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (rating === 0) { Alert.alert('', 'Pilih rating bintang dulu'); return; }
    try {
      await api.submitRating(rating, feedback);
      setSubmitted(true);
    } catch (err: any) { Alert.alert('Gagal', err.message); }
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Ionicons name="checkmark-circle" size={64} color={colors.green} />
          <Text style={s.thankTitle}>Terima kasih!</Text>
          <Text style={s.thankSub}>Feedback Anda membantu kami menjadi lebih baik.</Text>
          <TouchableOpacity style={s.btn} onPress={() => router.back()}>
            <Text style={s.btnText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rating & Feedback</Text>
        <View style={{ width: 34 }} />
      </View>
      <View style={s.content}>
        <Text style={s.question}>Bagaimana pengalaman perjalanan Anda?</Text>
        <View style={s.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TouchableOpacity key={i} onPress={() => setRating(i)}>
              <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={40} color={i <= rating ? colors.gold : colors.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.ratingLabel}>
          {rating === 0 ? 'Ketuk bintang' : ['', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik', 'Luar Biasa'][rating]}
        </Text>
        <TextInput
          style={s.textarea}
          value={feedback}
          onChangeText={setFeedback}
          placeholder="Tulis saran atau masukan (opsional)"
          placeholderTextColor={colors.textFaint}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={s.btn} onPress={submit}>
          <Text style={s.btnText}>Kirim Feedback</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  content: { padding: 24, alignItems: 'center' },
  question: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, textAlign: 'center', marginTop: 20 },
  stars: { flexDirection: 'row', gap: 8, marginTop: 24 },
  ratingLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.primary, marginTop: 12 },
  textarea: {
    width: '100%', marginTop: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.text, minHeight: 100, textAlignVertical: 'top',
  },
  btn: { marginTop: 20, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  thankTitle: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.text, marginTop: 16 },
  thankSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});
