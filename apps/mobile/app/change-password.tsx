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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/auth';
import { colors, radius } from '../src/theme';
import { useI18n } from '../src/services/i18n';

/**
 * Wajib ganti password saat login pertama — utk akun yang password awalnya
 * diterbitkan travel (sinkron Safar) atau di-reset admin. Layar ini dijaga
 * oleh root layout: tidak bisa dilewati selama flag must_change_password aktif.
 * Setelah sukses, seluruh sesi lama dicabut server → user login ulang.
 */
export default function ChangePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const t = useI18n((st) => st.t);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError(t('account.cp_min_length'));
      return;
    }
    if (password !== confirm) {
      setError(t('account.cp_mismatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.updateProfile({ password });
      Alert.alert(
        t('account.cp_success_title'),
        t('account.cp_success_msg'),
        [{ text: t('account.cp_relogin'), onPress: () => logout() }],
        { cancelable: false },
      );
    } catch (err: any) {
      setError(err.message || t('account.cp_failed'));
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
        <View style={s.iconWrap}>
          <Ionicons name="key" size={34} color={colors.primary} />
        </View>
        <Text style={s.title}>{t('account.cp_title')}</Text>
        <Text style={s.subtitle}>
          {t('account.cp_subtitle', { name: user?.name ? `, ${user.name}` : '' })}
        </Text>

        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder={t('account.cp_new_placeholder')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!show}
            value={password}
            onChangeText={setPassword}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => setShow(!show)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={show ? t('a11y.hide_password') : t('a11y.show_password')}
          >
            <Ionicons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <View style={s.inputWrap}>
          <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder={t('account.cp_confirm_placeholder')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!show}
            value={confirm}
            onChangeText={setConfirm}
          />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.button, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.buttonText}>{t('account.cp_submit')}</Text>
          )}
        </TouchableOpacity>

        <Text style={s.hint}>{t('account.cp_hint')}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: colors.text,
  },
  error: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: colors.danger,
    marginBottom: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  hint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
