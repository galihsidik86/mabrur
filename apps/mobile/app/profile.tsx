import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import { useI18n, type Lang } from '../src/services/i18n';
import { countQueue } from '../src/services/documentation';
import BatteryHint from '../src/components/BatteryHint';
import { getTraceConsent, setTraceConsent } from '../src/services/trace-consent';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, lang, setLang } = useI18n();

  // Foto Dokumentasi yang belum terkirim hilang saat keluar → minta konfirmasi dulu.
  const confirmLogout = async () => {
    const pending = await countQueue().catch(() => 0);
    if (pending === 0) { void logout(); return; }
    Alert.alert(t('doc.logout_pending_title'), t('doc.logout_pending_body', { count: pending }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('doc.logout_anyway'), style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [emergency, setEmergency] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [traceConsent, setTraceConsentState] = useState(false);

  useEffect(() => {
    getTraceConsent().then((c) => setTraceConsentState(c === 'granted')).catch(() => {});
  }, []);

  const toggleTraceConsent = async (granted: boolean) => {
    setTraceConsentState(granted);
    try {
      await setTraceConsent(granted);
    } catch {
      setTraceConsentState(!granted);
      Alert.alert(t('account.failed'), t('consent.trace_save_failed'));
    }
  };

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
    // Aturan sama dengan layar ganti password: minimal 6 karakter dan dikonfirmasi.
    if (password && password.length < 6) {
      Alert.alert(t('account.failed'), t('account.cp_min_length'));
      return;
    }
    if (password && password !== passwordConfirm) {
      Alert.alert(t('account.failed'), t('account.cp_mismatch'));
      return;
    }
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      if (name !== user?.name) data.name = name;
      if (password) data.password = password;
      if (bloodType) data.blood_type = bloodType;
      if (emergency) data.emergency_contact = emergency;
      if (Object.keys(data).length > 0) {
        await api.updateProfile(data);
        Alert.alert(t('account.success'), t('account.profile_updated'));
        setPassword('');
        setPasswordConfirm('');
      }
    } catch (err: any) {
      Alert.alert(t('account.failed'), err.message);
    } finally { setSaving(false); }
  };

  const langs: Array<{ code: Lang; label: string }> = [
    { code: 'id', label: t('lang.id') },
    { code: 'en', label: t('lang.en') },
  ];

  const roleLabel = user?.role === 'admin' ? t('account.role_admin')
    : user?.role === 'muthawwif' ? t('mode.muthawwif')
    : user?.role === 'jamaah' ? t('mode.jamaah')
    : user?.role;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}>
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
          <View style={s.roleBadge}><Text style={s.roleText}>{roleLabel}</Text></View>
        </View>

        {/* Language */}
        <Text style={s.sectionTitle}>{t('lang.label')}</Text>
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
              <View style={s.statCard}><Text style={s.statNum}>{stats.ibadah_done}</Text><Text style={s.statLabel}>{t('account.stat_ibadah_done')}</Text></View>
              <View style={s.statCard}><Text style={s.statNum}>{stats.sos_total}</Text><Text style={s.statLabel}>{t('account.stat_sos_sent')}</Text></View>
              <View style={s.statCard}><Text style={[s.statNum, { color: stats.is_ihram ? colors.green : colors.textMuted }]}>{stats.is_ihram ? t('account.stat_ihram_yes') : t('account.stat_ihram_no')}</Text><Text style={s.statLabel}>{t('account.stat_ihram')}</Text></View>
            </View>
          </>
        )}

        {/* Edit */}
        <Text style={s.sectionTitle}>{t('profile.edit')}</Text>
        <View style={s.formCard}>
          <Text style={s.label}>{t('account.field_name')}</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} />
          <Text style={[s.label, { marginTop: 12 }]}>{t('profile.change_password')}</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder={t('account.password_placeholder')} placeholderTextColor={colors.textFaint} />
          {password.length > 0 && (
            <TextInput style={[s.input, { marginTop: 8 }]} value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry placeholder={t('account.cp_confirm_placeholder')} placeholderTextColor={colors.textFaint} />
          )}
          <Text style={[s.label, { marginTop: 12 }]}>{t('account.field_blood_type')}</Text>
          <TextInput style={s.input} value={bloodType} onChangeText={setBloodType} />
          <Text style={[s.label, { marginTop: 12 }]}>{t('account.field_emergency')}</Text>
          <TextInput style={s.input} value={emergency} onChangeText={setEmergency} keyboardType="phone-pad" />
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? t('common.loading') : t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Persetujuan jejak GPS riset (mode otomatis Tawaf/Sa'i) — bisa ditarik kapan saja */}
        <Text style={s.sectionTitle}>{t('consent.trace_section')}</Text>
        <View style={s.consentCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.consentLabel}>{t('consent.trace_switch')}</Text>
            <Text style={s.consentHint}>{t('consent.trace_switch_hint')}</Text>
          </View>
          <Switch
            value={traceConsent}
            onValueChange={toggleTraceConsent}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.card}
            accessibilityLabel={t('consent.trace_switch')}
          />
        </View>

        {/* Notifikasi & baterai (Android) */}
        {Platform.OS === 'android' && (
          <>
            <Text style={s.sectionTitle}>{t('battery.section')}</Text>
            <BatteryHint />
          </>
        )}

        {/* Rating */}
        <TouchableOpacity onPress={() => router.push('/rating')}
          style={{ marginTop: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="star" size={20} color={colors.gold} />
          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text, flex: 1 }}>{t('account.rating_link')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={() => { void confirmLogout(); }}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={s.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Atribusi data lokasi (Ka'bah, Safa/Marwah, Jamarat, batas Arafah) */}
        <Text style={s.creditText}>{t('account.osm_credit')}</Text>
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
  consentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  },
  consentLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  consentHint: { fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 4 },
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
  creditText: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', marginTop: 16 },
});
