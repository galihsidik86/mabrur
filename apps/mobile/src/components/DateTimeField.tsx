import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useI18n } from '../services/i18n';

type Props = {
  label: string;
  // Waktu lokal "YYYY-MM-DDTHH:mm" ('' = belum dipilih) — format yang sama dengan isian teks sebelumnya.
  value: string;
  onChange: (value: string) => void;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Pemilih tanggal & jam bawaan HP, menggantikan ketikan ISO mentah yang sulit bagi jamaah lansia.
export default function DateTimeField({ label, value, onChange }: Props) {
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const [showIos, setShowIos] = useState(false);
  const current = value ? new Date(value) : new Date();

  const display = value
    ? current.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : t('common.pick_datetime');

  const openAndroid = () => {
    // Android tidak punya mode gabungan: pilih tanggal dulu, lalu jam.
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (ev, time) => {
            if (ev.type === 'set' && time) onChange(toLocalString(time));
          },
        });
      },
    });
  };

  const onIosChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (date) onChange(toLocalString(date));
  };

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={s.field}
        onPress={() => (Platform.OS === 'android' ? openAndroid() : setShowIos((v) => !v))}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={[s.value, !value && s.placeholder]}>{display}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIos && (
        <DateTimePicker value={current} mode="datetime" display="inline" onChange={onIosChange} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card,
  },
  value: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text },
  placeholder: { color: colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium' },
});
