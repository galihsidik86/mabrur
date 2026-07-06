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
import { useAuthStore } from '../src/stores/auth';
import { colors, radius } from '../src/theme';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Nomor HP dan password wajib diisi');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login gagal');
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
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <View style={s.kaaba} />
          </View>
          <Text style={s.appName}>Mabrur</Text>
          <Text style={s.tagline}>Panduan haji & umrah</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>Nomor HP</Text>
          <TextInput
            style={s.input}
            placeholder="08xxxxxxxxxx"
            placeholderTextColor={colors.textFaint}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="Masukkan password"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

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
              <Text style={s.btnText}>Masuk</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          Hubungi admin rombongan untuk mendapatkan akun.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
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
