import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Satu pola untuk keadaan muat / gagal / kosong: sebutkan sebabnya, beri satu aksi berikutnya.
export default function StateNotice({ kind, message, actionLabel, onAction }: Props) {
  return (
    <View style={s.box} accessibilityLiveRegion="polite">
      {kind === 'loading' && <ActivityIndicator color={colors.primary} />}
      <Text style={s.text}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={s.btn} onPress={onAction} accessibilityRole="button">
          <Text style={s.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', gap: 12, marginTop: 28, paddingHorizontal: 24 },
  text: { fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, minHeight: 44, justifyContent: 'center' },
  btnText: { color: colors.textOnPrimary, fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
});
