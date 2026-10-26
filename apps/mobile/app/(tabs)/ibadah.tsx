import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme';
import { api } from '../../src/services/api';
import {
  saveGuides,
  getGuidesByType,
  type Guide,
} from '../../src/services/db';
import { useI18n } from '../../src/services/i18n';
import StateNotice from '../../src/components/StateNotice';

type TabType = 'umrah' | 'haji' | 'ziarah';

interface ZiarahPlace {
  id: string; name: string; description: string; category: string;
  location_name: string; tips: string;
}

export default function IbadahScreen() {
  const t = useI18n((st) => st.t);
  const [tab, setTab] = useState<TabType>('umrah');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [ziarah, setZiarah] = useState<ZiarahPlace[]>([]);
  const [openIdx, setOpenIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadZiarah = useCallback(async () => {
    try {
      const data = await api.getZiarah();
      setZiarah(data);
    } catch {
      setLoadFailed(true);
    }
    setLoading(false);
  }, []);

  // Tab yang sedang diminta; respons untuk tab lain (pengguna sudah pindah) diabaikan.
  const activeTabRef = useRef<TabType>(tab);

  const load = useCallback(async (type: TabType) => {
    if (type === 'ziarah') { loadZiarah(); return; }
    const isCurrent = () => activeTabRef.current === type;
    // Offline-first: baca dari SQLite
    const local = await getGuidesByType(type);
    if (local.length > 0 && isCurrent()) {
      setGuides(local);
      setLoading(false);
    }

    // Sync dari API
    try {
      const remote = await api.getGuides(type);
      await saveGuides(remote);
      if (isCurrent()) setGuides(remote);
    } catch {
      // Offline — data lokal (jika ada) sudah dimuat
      if (isCurrent()) setLoadFailed(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    activeTabRef.current = tab;
    setLoading(true);
    setLoadFailed(false);
    setOpenIdx(0);
    // Kosongkan dulu agar tab baru tidak menampilkan tuntunan tab sebelumnya.
    setGuides([]);
    load(tab);
  }, [tab, load]);

  useEffect(() => { reload(); }, [reload]);

  const listState = (emptyKey: 'content.ziyarah_empty' | 'content.guide_empty') => (
    <StateNotice
      kind={loading ? 'loading' : loadFailed ? 'error' : 'empty'}
      message={loading ? t('common.loading') : loadFailed ? t('common.load_failed') : t(emptyKey)}
      actionLabel={loading ? undefined : t('common.retry')}
      onAction={reload}
    />
  );

  const switchTab = (next: TabType) => {
    if (next !== tab) setTab(next);
  };

  const subtitle = t('content.guide_steps_count', { count: guides.length });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>{t('content.guide_title')}</Text>
        <Text style={s.sub}>{t('content.guide_sub')}</Text>

        {/* Tab selector */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'umrah' && s.tabActive]}
            onPress={() => switchTab('umrah')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'umrah' && s.tabTextActive]}>
              {t('content.tab_umrah')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'haji' && s.tabActive]}
            onPress={() => switchTab('haji')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'haji' && s.tabTextActive]}>
              {t('content.tab_hajj')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'ziarah' && s.tabActive]}
            onPress={() => switchTab('ziarah')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'ziarah' && s.tabTextActive]}>
              {t('content.tab_ziyarah')}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'ziarah' ? (
          <View style={s.list}>
            {ziarah.map((z, idx) => (
              <View key={z.id} style={s.card}>
                <TouchableOpacity style={s.cardHeader} onPress={() => setOpenIdx(openIdx === idx ? -1 : idx)} activeOpacity={0.7}>
                  <View style={[s.stepNum, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{z.name}</Text>
                    <Text style={s.cardSub}>{z.location_name} · {z.category}</Text>
                  </View>
                  <Ionicons name={openIdx === idx ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
                </TouchableOpacity>
                {openIdx === idx && (
                  <View style={s.cardBody}>
                    <Text style={s.stepsText}>{z.description}</Text>
                    {z.tips && (
                      <View style={s.prayerBox}>
                        <Text style={s.prayerLabel}>{t('content.ziyarah_tips')}</Text>
                        <Text style={[s.latinText, { fontStyle: 'normal', marginTop: 4 }]}>{z.tips}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            {ziarah.length === 0 && listState('content.ziyarah_empty')}
          </View>
        ) : (
        <>
        {guides.length > 0 && <Text style={s.subtitle}>{subtitle}</Text>}

        {guides.length === 0 ? (
          listState('content.guide_empty')
        ) : (
          <View style={s.list}>
            {guides.map((guide, idx) => {
              const isOpen = openIdx === idx;
              return (
                <View key={guide.id} style={s.card}>
                  <TouchableOpacity
                    style={s.cardHeader}
                    onPress={() => setOpenIdx(isOpen ? -1 : idx)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        s.stepNum,
                        isOpen && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          s.stepNumText,
                          isOpen && { color: '#fff' },
                        ]}
                      >
                        {guide.step_number}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{guide.title}</Text>
                      {guide.subtitle && (
                        <Text style={s.cardSub}>{guide.subtitle}</Text>
                      )}
                    </View>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textFaint}
                    />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.cardBody}>
                      {guide.steps_text && (
                        <Text style={s.stepsText}>{guide.steps_text}</Text>
                      )}

                      {guide.arabic_text && (
                        <View style={s.prayerBox}>
                          <Text style={s.prayerLabel}>
                            {t('content.guide_prayer_label', { title: guide.title.toUpperCase() })}
                          </Text>
                          <Text style={s.arabicText}>
                            {guide.arabic_text}
                          </Text>
                          {guide.latin_text && (
                            <Text style={s.latinText}>
                              {guide.latin_text}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  title: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 2,
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginTop: 16,
  },
  tabBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },

  subtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textMuted,
    marginTop: 16,
    marginLeft: 2,
  },

  list: { marginTop: 12, gap: 10 },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    paddingHorizontal: 16,
  },
  stepNum: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.primary,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 2,
  },

  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 63, // align with text after step number
  },
  stepsText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  prayerBox: {
    marginTop: 12,
    backgroundColor: '#FBF6EA',
    borderWidth: 1,
    borderColor: '#EDD9A6',
    borderRadius: 11,
    padding: 14,
  },
  prayerLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1,
    color: colors.goldText,
  },
  arabicText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  latinText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 7,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
