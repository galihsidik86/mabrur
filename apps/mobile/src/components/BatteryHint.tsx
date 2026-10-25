import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';
import { getMeta, setMeta } from '../services/db';
import { batteryBrandOf, batteryStepsKey } from '../services/battery-hint-core';

const DISMISSED_KEY = 'battery_hint_dismissed';
// Daftar aplikasi & status pengoptimalan baterai — tanpa izin khusus (beda dengan
// REQUEST_IGNORE_BATTERY_OPTIMIZATIONS yang dibatasi kebijakan Play Store).
const BATTERY_SETTINGS_INTENT = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';

type Props = {
  /** Di layar chat: bisa ditutup dan tidak muncul lagi. Di Profil: selalu tersedia. */
  isDismissible?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Petunjuk agar notifikasi chat/SOS tidak tertahan penghemat baterai (Permintaan 9).
 * Hanya Android — iOS tidak punya pengaturan per-merek seperti ini.
 */
export default function BatteryHint({ isDismissible = false, style }: Props) {
  const t = useI18n((st) => st.t);
  const [isHidden, setIsHidden] = useState(isDismissible);
  const [isExpanded, setIsExpanded] = useState(false);
  const brand = batteryBrandOf(Device.manufacturer, Device.brand);

  useEffect(() => {
    if (!isDismissible) return;
    let cancelled = false;
    getMeta(DISMISSED_KEY)
      .then((v) => { if (!cancelled) setIsHidden(v === '1'); })
      .catch(() => { if (!cancelled) setIsHidden(false); });
    return () => { cancelled = true; };
  }, [isDismissible]);

  if (Platform.OS !== 'android' || isHidden) return null;

  const openFailed = () => Alert.alert(t('battery.title'), t('battery.open_failed'));
  const openBattery = () => {
    Linking.sendIntent(BATTERY_SETTINGS_INTENT)
      .catch(() => Linking.openSettings())
      .catch(openFailed);
  };
  const openApp = () => { Linking.openSettings().catch(openFailed); };
  const dismiss = () => {
    setIsHidden(true);
    setMeta(DISMISSED_KEY, '1').catch(() => {});
  };

  return (
    <View style={[s.card, style]}>
      <View style={s.headRow}>
        <Ionicons name="battery-charging" size={20} color={colors.gold} />
        <Text style={s.title}>{t('battery.title')}</Text>
        {isDismissible && (
          <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityRole="button"
            accessibilityLabel={t('battery.dismiss')}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {isExpanded ? (
        <>
          <Text style={s.body}>{t('battery.body')}</Text>
          <Text style={s.steps}>{t(batteryStepsKey(brand))}</Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={openBattery} accessibilityRole="button">
              <Text style={[s.btnText, s.btnTextPrimary]}>{t('battery.open_battery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={openApp} accessibilityRole="button">
              <Text style={s.btnText}>{t('battery.open_app')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity onPress={() => setIsExpanded(true)} accessibilityRole="button">
          <Text style={s.link}>{t('battery.show_steps')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  body: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, marginTop: 8, lineHeight: 19 },
  steps: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text, marginTop: 8, lineHeight: 21 },
  link: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary, marginTop: 6, marginLeft: 28 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  btnTextPrimary: { color: colors.textOnPrimary },
});
