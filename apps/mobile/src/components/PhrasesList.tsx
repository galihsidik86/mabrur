import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { colors } from '../theme';
import { ARABIC_FALLBACK_LANGUAGE, arabicVoiceStatus, pickArabicVoice, type VoiceInfo } from '../services/phrase-audio-core';
import { api, type Phrase } from '../services/api';
import { getMeta, setMeta } from '../services/db';
import { useI18n, type TranslationKey } from '../services/i18n';
import { id as idLocale } from '../i18n/locales/id';

const CACHE_KEY = 'phrases';

/** Hanya item yang bisa ditampilkan (cache rusak / respons asing tidak membuat kartu kosong). */
function validPhrases(value: unknown): Phrase[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is Phrase =>
    !!p && typeof p.id === 'string' && typeof p.arabic === 'string' && typeof p.indonesian === 'string');
}

function readCache(raw: string | null): Phrase[] {
  if (!raw) return [];
  try {
    return validPhrases(JSON.parse(raw));
  } catch {
    return [];
  }
}

// Kategori baru dari server yang belum diterjemahkan tampil apa adanya.
function categoryKey(category: string): TranslationKey | null {
  const key = `phrase.cat.${category}`;
  return key in idLocale ? (key as TranslationKey) : null;
}

/**
 * Kelompokkan menurut kategori (urutan kategori = kemunculan pertama, urutan item = sort_order).
 * Tiap kategori tepat satu grup walau sort_order-nya terselang kategori lain.
 */
function groupByCategory(phrases: Phrase[]): Array<{ category: string; items: Phrase[] }> {
  const groups = new Map<string, Phrase[]>();
  for (const p of phrases) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  return [...groups].map(([category, items]) => ({ category, items }));
}

// Pengucapan sedikit diperlambat agar jamaah bisa menirukan.
const SPEECH_RATE = 0.8;
const TTS_SETTINGS_INTENT = 'com.android.settings.TTS_SETTINGS';

export default function PhrasesList() {
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voicesRef = useRef<VoiceInfo[]>([]);

  // Daftar suara dibaca sekali; kosong = mesin TTS belum siap, dicoba lagi saat tombol diketuk.
  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((v) => { voicesRef.current = v; }).catch(() => {});
    return () => { void Speech.stop(); };
  }, []);

  const showNoVoice = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [{ text: t('common.cancel'), style: 'cancel' }];
    if (Platform.OS === 'android') {
      buttons.push({
        text: t('phrase.open_tts'),
        onPress: () => { Linking.sendIntent(TTS_SETTINGS_INTENT).catch(() => Linking.openSettings()); },
      });
    }
    Alert.alert(t('phrase.no_voice_title'), t('phrase.no_voice_body'), buttons);
  };

  const togglePlay = async (p: Phrase) => {
    await Speech.stop();
    if (speakingId === p.id) { setSpeakingId(null); return; }
    if (voicesRef.current.length === 0) {
      voicesRef.current = await Speech.getAvailableVoicesAsync().catch(() => []);
    }
    if (arabicVoiceStatus(voicesRef.current) === 'missing') { showNoVoice(); return; }
    const voice = pickArabicVoice(voicesRef.current);
    const clear = () => setSpeakingId((cur) => (cur === p.id ? null : cur));
    setSpeakingId(p.id);
    Speech.speak(p.arabic, {
      language: voice?.language ?? ARABIC_FALLBACK_LANGUAGE,
      voice: voice?.identifier,
      rate: SPEECH_RATE,
      onDone: clear,
      onStopped: clear,
      onError: () => { clear(); showNoVoice(); },
    });
  };

  // Offline-first: frasa paling dibutuhkan justru saat di luar jangkauan internet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = readCache(await getMeta(CACHE_KEY).catch(() => null));
      if (!cancelled && cached.length > 0) setPhrases(cached);
      try {
        const fresh = validPhrases(await api.getPhrases());
        // Respons kosong (mis. saat deploy/migrasi) tidak boleh menghapus cache offline yang baik.
        if (cancelled || fresh.length === 0) return;
        setPhrases(fresh);
        await setMeta(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
      } catch {
        // Offline: tetap pakai cache.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (phrases.length === 0) {
    return <Text style={s.empty}>{loading ? t('common.loading') : t('phrase.empty')}</Text>;
  }

  return (
    <View style={s.wrap}>
      <Text style={s.audioNote}>{t('phrase.audio_note')}</Text>
      {groupByCategory(phrases).map((group) => {
        const key = categoryKey(group.category);
        return (
          <View key={group.category} style={s.group}>
            <Text style={s.groupTitle}>{key ? t(key) : group.category}</Text>
            {group.items.map((p) => {
              // English bila dipilih & tersedia (server lama belum punya kolom ini).
              const latin = lang === 'en' && p.transliteration_en ? p.transliteration_en : p.transliteration;
              const meaning = lang === 'en' && p.english ? p.english : p.indonesian;
              const playing = speakingId === p.id;
              return (
                <View key={p.id} style={s.card}>
                  <View style={s.arabicRow}>
                    <TouchableOpacity
                      onPress={() => { void togglePlay(p); }}
                      style={[s.playBtn, playing && s.playBtnActive]}
                      accessibilityRole="button"
                      accessibilityLabel={`${playing ? t('phrase.stop') : t('phrase.listen')}: ${meaning}`}
                      hitSlop={8}>
                      <Ionicons name={playing ? 'stop' : 'volume-high'} size={18}
                        color={playing ? colors.textOnPrimary : colors.primary} />
                    </TouchableOpacity>
                    <Text style={s.arabic}>{p.arabic}</Text>
                  </View>
                  {latin ? <Text style={s.latin}>{latin}</Text> : null}
                  <Text style={s.meaning}>{meaning}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20 },
  empty: { textAlign: 'center', color: colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 40, paddingHorizontal: 24 },
  group: { marginBottom: 14 },
  groupTitle: {
    fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2,
  },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, marginBottom: 8,
  },
  // Amiri: harakat tampil utuh & tidak bertumpuk; lineHeight lega untuk tanda di atas/bawah huruf.
  arabic: {
    flex: 1, fontFamily: 'Amiri_700Bold', fontSize: 28, lineHeight: 54, color: colors.text,
    textAlign: 'right', writingDirection: 'rtl',
  },
  arabicRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: {
    width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  playBtnActive: { backgroundColor: colors.primary },
  audioNote: {
    fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted,
    marginBottom: 12, lineHeight: 17,
  },
  latin: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.primary, marginTop: 4, fontStyle: 'italic' },
  meaning: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary, marginTop: 2 },
});
