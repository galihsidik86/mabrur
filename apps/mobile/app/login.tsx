import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth';
import { colors, radius } from '../src/theme';
import { useI18n, type Lang } from '../src/services/i18n';

const LANG_OPTIONS: Lang[] = ['id', 'en'];

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const setLang = useI18n((st) => st.setLang);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError(t('login.required'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err: any) {
      setError(err.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.inner}
      >
        {/* Pilihan bahasa — tersedia sejak aplikasi pertama kali dibuka */}
        <View style={s.langRow} accessibilityRole="radiogroup" accessibilityLabel={t('lang.label')}>
          {LANG_OPTIONS.map((code) => (
            <TouchableOpacity
              key={code}
              onPress={() => setLang(code)}
              style={[s.langBtn, lang === code && s.langBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="radio"
              accessibilityLabel={t(code === 'id' ? 'lang.id' : 'lang.en')}
              accessibilityState={{ selected: lang === code }}
            >
              <Text style={[s.langText, lang === code && s.langTextActive]}>{code.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <View style={s.kaaba} />
          </View>
          <Text style={s.appName}>Mabrur</Text>
          <Text style={s.tagline}>{t('login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>{t('login.phone')}</Text>
          <TextInput
            style={s.input}
            placeholder="08xxxxxxxxxx"
            placeholderTextColor={colors.textFaint}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={[s.label, { marginTop: 16 }]}>{t('login.password')}</Text>
          <View style={s.passwordWrap}>
            <TextInput
              style={[s.input, s.passwordInput]}
              placeholder={t('login.password_placeholder')}
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={showPassword ? t('login.hide_password') : t('login.show_password')}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={s.btnText}>{t('login.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>{t('login.footer')}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  langRow: { alignSelf: 'flex-end', flexDirection: 'row', gap: 6, marginBottom: 24 },
  langBtn: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted },
  langTextActive: { color: colors.textOnPrimary },
  logoWrap: { alignItems: 'center', marginBottom: 44 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  kaaba: {
    width: 20,
    height: 20,
    backgroundColor: colors.text,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#F5D98A',
  },
  appName: {
    fontSize: 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.textSecondary,
    marginTop: 14,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 4,
  },
  form: {},
  label: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.text,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 8,
    padding: 8,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 12,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  btnText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  footer: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 32,
  },
});
