import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { api, type CurrencyRates } from '../services/api';
import { getMeta, setMeta } from '../services/db';
import { useI18n, type Lang } from '../services/i18n';
import {
  convert,
  parseAmount,
  currencyName,
  orderCurrencies,
  searchCurrencies,
  pushRecent,
  isValidRates,
  sanitizePair,
  sanitizeRecent,
} from '../services/currency-core';

const RATES_KEY = 'currency_rates';
const RECENT_KEY = 'currency_recent';
const PAIR_KEY = 'currency_pair';

type Side = 'from' | 'to';

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function numberLocale(lang: Lang): string {
  return lang === 'id' ? 'id-ID' : 'en-US';
}

// Rupiah dkk. tanpa desimal, nilai kecil tetap terbaca (mis. 1 IDR = 0,0002353 SAR).
function formatAmount(value: number, lang: Lang): string {
  const opts: Intl.NumberFormatOptions = value >= 1000
    ? { maximumFractionDigits: 0 }
    : value >= 1 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 };
  return new Intl.NumberFormat(numberLocale(lang), opts).format(value);
}

function formatUpdated(updated: string, lang: Lang): string {
  const d = new Date(updated);
  if (Number.isNaN(d.getTime())) return updated;
  return d.toLocaleString(numberLocale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CurrencyConverter() {
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const [data, setData] = useState<CurrencyRates | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  // Disimpan apa adanya; divalidasi terhadap kurs saat dipakai (lihat `pair` di bawah).
  const [storedPair, setStoredPair] = useState<unknown>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [picking, setPicking] = useState<Side | null>(null);
  const [query, setQuery] = useState('');

  // Offline-first: tampilkan kurs tersimpan dulu, lalu segarkan dari server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cachedRaw, recentRaw, pairRaw] = await Promise.all([
        getMeta(RATES_KEY).catch(() => null),
        getMeta(RECENT_KEY).catch(() => null),
        getMeta(PAIR_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      const cached = readJson<unknown>(cachedRaw, null);
      const hasCache = isValidRates(cached);
      if (hasCache) setData(cached as CurrencyRates);
      setRecent(sanitizeRecent(readJson<unknown>(recentRaw, null)));
      setStoredPair(readJson<unknown>(pairRaw, null));

      try {
        const fresh: unknown = await api.getCurrency();
        if (cancelled) return;
        // Server versi lama (tanpa `rates`) atau respons rusak = gagal ambil.
        if (!isValidRates(fresh)) throw new Error('invalid currency payload');
        const payload = fresh as CurrencyRates;
        if (payload.is_fallback && hasCache) {
          // Server baru restart & sumber kurs sedang tak terjangkau: kurs tersimpan
          // (lengkap ±160 mata uang) lebih berguna daripada fallback SAR/IDR saja.
          setOffline(true);
        } else {
          setData(payload);
          setOffline(false);
          if (!payload.is_fallback) await setMeta(RATES_KEY, JSON.stringify(payload)).catch(() => {});
        }
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const codes = useMemo(() => Object.keys(data?.rates ?? {}), [data]);
  const listed = useMemo(
    () => searchCurrencies(orderCurrencies(codes, recent), query, lang),
    [codes, recent, query, lang],
  );

  const pair = sanitizePair(storedPair, data?.rates ?? {});

  const savePair = (next: { from: string; to: string }) => {
    setStoredPair(next);
    setMeta(PAIR_KEY, JSON.stringify(next)).catch(() => {});
  };

  const closePicker = () => {
    setPicking(null);
    setQuery('');
  };

  const choose = (code: string) => {
    if (!picking) return;
    const other = picking === 'from' ? pair.to : pair.from;
    // Memilih mata uang yang sama dengan sisi lain = tukar arah.
    const next = code === other
      ? { from: pair.to, to: pair.from }
      : { ...pair, [picking]: code };
    savePair(next);
    const nextRecent = pushRecent(recent, code);
    setRecent(nextRecent);
    setMeta(RECENT_KEY, JSON.stringify(nextRecent)).catch(() => {});
    closePicker();
  };

  if (!data) {
    return (
      <View style={s.wrap}>
        <Text style={s.muted}>{loading ? t('common.loading') : t('kurs.no_data')}</Text>
      </View>
    );
  }

  const value = parseAmount(amount, lang);
  const result = value != null ? convert(value, pair.from, pair.to, data.rates) : null;
  const unitRate = convert(1, pair.from, pair.to, data.rates);

  return (
    <View style={s.wrap}>
      {/* Pilih mata uang asal & tujuan */}
      <View style={s.pairRow}>
        <CurrencyButton label={t('kurs.from')} code={pair.from} lang={lang} onPress={() => setPicking('from')} />
        <TouchableOpacity
          style={s.swapBtn}
          onPress={() => savePair({ from: pair.to, to: pair.from })}
          accessibilityLabel={t('kurs.swap')}
        >
          <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
        </TouchableOpacity>
        <CurrencyButton label={t('kurs.to')} code={pair.to} lang={lang} onPress={() => setPicking('to')} />
      </View>

      <TextInput
        style={s.input}
        value={amount}
        onChangeText={setAmount}
        placeholder={t('kurs.amount_placeholder', { code: pair.from })}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textFaint}
      />

      {result != null && (
        <Text style={s.result}>{formatAmount(result, lang)} {pair.to}</Text>
      )}
      {unitRate != null && (
        <Text style={s.rateLine}>
          {t('kurs.rate_line', { from: pair.from, rate: formatAmount(unitRate, lang), to: pair.to })}
        </Text>
      )}

      <View style={s.metaBox}>
        {offline && <Text style={s.offline}>{t('kurs.offline')}</Text>}
        {data.is_fallback
          ? <Text style={s.offline}>{t('kurs.fallback')}</Text>
          : <Text style={s.meta}>{t('kurs.updated', { time: formatUpdated(data.updated_at ?? data.updated, lang) })}</Text>}
        <Text style={s.meta}>{t('kurs.disclaimer')}</Text>
        <Text style={s.attribution}>{t('kurs.attribution')}</Text>
      </View>

      <Modal visible={picking != null} animationType="slide" onRequestClose={closePicker}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('kurs.select_title')}</Text>
            <TouchableOpacity onPress={closePicker} accessibilityLabel={t('common.cancel')}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.search}
            value={query}
            onChangeText={setQuery}
            placeholder={t('kurs.search')}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FlatList
            data={listed}
            keyExtractor={(c) => c}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = picking != null && pair[picking] === item;
              return (
                <TouchableOpacity style={[s.row, selected && s.rowSelected]} onPress={() => choose(item)}>
                  <Text style={s.rowCode}>{item}</Text>
                  <Text style={s.rowName} numberOfLines={1}>{currencyName(item, lang)}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

type CurrencyButtonProps = {
  label: string;
  code: string;
  lang: Lang;
  onPress: () => void;
};

function CurrencyButton({ label, code, lang, onPress }: CurrencyButtonProps) {
  return (
    <TouchableOpacity style={s.currencyBtn} onPress={onPress} accessibilityLabel={`${label}: ${currencyName(code, lang)}`}>
      <Text style={s.currencyLabel}>{label}</Text>
      <View style={s.currencyCodeRow}>
        <Text style={s.currencyCode}>{code}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </View>
      <Text style={s.currencyName} numberOfLines={1}>{currencyName(code, lang)}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20 },
  muted: { textAlign: 'center', color: colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 24, lineHeight: 20 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swapBtn: {
    width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  currencyBtn: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 12,
  },
  currencyLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted },
  currencyCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  currencyCode: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.text },
  currencyName: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 1 },
  input: {
    marginTop: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text,
  },
  result: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, textAlign: 'center', marginTop: 16 },
  rateLine: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.primary, textAlign: 'center', marginTop: 8 },
  metaBox: { marginTop: 20, gap: 6 },
  meta: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  offline: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.danger, textAlign: 'center' },
  attribution: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  search: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium', color: colors.text,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  rowSelected: { backgroundColor: colors.primaryLight },
  rowCode: { width: 48, fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.text },
  rowName: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary },
});
