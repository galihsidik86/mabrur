import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import { useI18n } from '../src/services/i18n';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, lang, setLang } = useI18n();

  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [emergency, setEmergency] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.getProfile();
        setBloodType(profile.blood_type || '');
        setEmergency(profile.emergency_contact || '');
      } catch {}
      try { setStats(await api.getStats()); } catch {}
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      if (name !== user?.name) data.name = name;
      if (password) data.password = password;
      if (bloodType) data.blood_type = bloodType;
      if (emergency) data.emergency_contact = emergency;
      if (Object.keys(data).length > 0) {
        await api.updateProfile(data);
        Alert.alert('Berhasil', 'Profil diperbarui');
        setPassword('');
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    } finally { setSaving(false); }
  };

  const langs: Array<{ code: 'id' | 'en' | 'ar'; label: string }> = [
    { code: 'id', label: 'Indonesia' },
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.title')}</Text>
        <View style={{ width: 34 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
          </View>
          <Text style={s.userName}>{user?.name}</Text>
          <Text style={s.userPhone}>{user?.phone}</Text>
          <View style={s.roleBadge}><Text style={s.roleText}>{user?.role}</Text></View>
        </View>

        {/* Language */}
        <Text style={s.sectionTitle}>Bahasa / Language</Text>
        <View style={s.langRow}>
          {langs.map((l) => (
            <TouchableOpacity key={l.code} onPress={() => setLang(l.code)}
              style={[s.langBtn, lang === l.code && s.langBtnActive]}>
              <Text style={[s.langText, lang === l.code && s.langTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats */}
        {stats && (
          <>
            <Text style={s.sectionTitle}>{t('profile.stats')}</Text>
            <View style={s.statsRow}>
              <View style={s.statCard}><Text style={s.statNum}>{stats.ibadah_done}</Text><Text style={s.statLabel}>Ibadah selesai</Text></View>
              <View style={s.statCard}><Text style={s.statNum}>{stats.sos_total}</Text><Text style={s.statLabel}>SOS dikirim</Text></View>
              <View style={s.statCard}><Text style={[s.statNum, { color: stats.is_ihram ? colors.green : colors.textMuted }]}>{stats.is_ihram ? '✓' : '—'}</Text><Text style={s.statLabel}>Status ihram</Text></View>
            </View>
          </>
        )}

        {/* Edit */}
        <Text style={s.sectionTitle}>{t('profile.edit')}</Text>
        <View style={s.formCard}>
          <Text style={s.label}>Nama</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} />
          <Text style={[s.label, { marginTop: 12 }]}>{t('profile.change_password')}</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Kosongkan jika tidak diubah" placeholderTextColor={colors.textFaint} />
          <Text style={[s.label, { marginTop: 12 }]}>Gol. Darah</Text>
          <TextInput style={s.input} value={bloodType} onChangeText={setBloodType} />
          <Text style={[s.label, { marginTop: 12 }]}>Kontak Darurat</Text>
          <TextInput style={s.input} value={emergency} onChangeText={setEmergency} keyboardType="phone-pad" />
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? t('common.loading') : t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={s.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  content: { padding: 16, paddingBottom: 40 },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.textOnPrimary },
  userName: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 10 },
  userPhone: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2 },
  roleBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  roleText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  sectionTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 20, marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  langTextActive: { color: colors.textOnPrimary },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary },
  statLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  formCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  label: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 14, borderWidth: 1, borderColor: colors.primaryLight, borderRadius: 12 },
  logoutText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.danger },
});
