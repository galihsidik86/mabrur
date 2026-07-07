import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

type TabType = 'umrah' | 'haji' | 'ziarah';

interface ZiarahPlace {
  id: string; name: string; description: string; category: string;
  location_name: string; tips: string;
}

export default function IbadahScreen() {
  const [tab, setTab] = useState<TabType>('umrah');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [ziarah, setZiarah] = useState<ZiarahPlace[]>([]);
  const [openIdx, setOpenIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadZiarah = useCallback(async () => {
    try {
      const data = await api.getZiarah();
      setZiarah(data);
    } catch {}
    setLoading(false);
  }, []);

  const load = useCallback(async (type: TabType) => {
    if (type === 'ziarah') { loadZiarah(); return; }
    // Offline-first: baca dari SQLite
    const local = await getGuidesByType(type);
    if (local.length > 0) {
      setGuides(local);
      setLoading(false);
    }

    // Sync dari API
    try {
      const remote = await api.getGuides(type);
      await saveGuides(remote);
      setGuides(remote);
    } catch {
      // Offline — data lokal sudah dimuat
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setOpenIdx(0);
    load(tab);
  }, [tab, load]);

  const switchTab = (t: TabType) => {
    if (t !== tab) setTab(t);
  };

  const count = guides.length;
  const subtitle =
    tab === 'umrah'
      ? `${count} tahap · ketuk untuk membuka langkah & doa`
      : `${count} tahap · ketuk untuk membuka langkah & doa`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Tuntunan ibadah</Text>
        <Text style={s.sub}>Panduan langkah demi langkah, urut & jelas.</Text>

        {/* Tab selector */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'umrah' && s.tabActive]}
            onPress={() => switchTab('umrah')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'umrah' && s.tabTextActive]}>
              Umrah
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'haji' && s.tabActive]}
            onPress={() => switchTab('haji')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'haji' && s.tabTextActive]}>
              Haji
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'ziarah' && s.tabActive]}
            onPress={() => switchTab('ziarah')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'ziarah' && s.tabTextActive]}>
              Ziarah
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'ziarah' ? (
          <View style={s.list}>
            {ziarah.map((z, idx) => (
              <View key={z.id} style={s.card}>
                <TouchableOpacity style={s.cardHeader} onPress={() => setOpenIdx(openIdx === idx ? -1 : idx)} activeOpacity={0.7}>
                  <View style={[s.stepNum, { backgroundColor: '#EAF2E4' }]}>
                    <Ionicons name="location" size={16} color={colors.green} />
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
                        <Text style={s.prayerLabel}>TIPS</Text>
                        <Text style={[s.latinText, { fontStyle: 'normal', marginTop: 4 }]}>{z.tips}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            {ziarah.length === 0 && !loading && (
              <Text style={{ color: colors.textFaint, textAlign: 'center', marginTop: 40, fontFamily: 'PlusJakartaSans_500Medium' }}>Belum ada data ziarah</Text>
            )}
          </View>
        ) : (
        <>
        <Text style={s.subtitle}>{`${guides.length} tahap · ketuk untuk membuka langkah & doa`}</Text>

        {loading && guides.length === 0 ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={{ marginTop: 40 }}
          />
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
                            DOA SAAT {guide.title.toUpperCase()}
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
  content: { padding: 16, paddingBottom: 24 },

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
    borderColor: '#E5DDD0',
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
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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
    color: '#97751F',
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
