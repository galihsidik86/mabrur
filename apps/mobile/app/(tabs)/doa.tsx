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
import { saveDuas, getDuas, type Dua } from '../../src/services/db';

export default function DoaScreen() {
  const [duas, setDuas] = useState<Dua[]>([]);
  const [openIdx, setOpenIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Offline-first
    const local = await getDuas();
    if (local.length > 0) {
      setDuas(local);
      setLoading(false);
    }

    // Sync
    try {
      const remote = await api.getDuas();
      await saveDuas(remote);
      setDuas(remote);
    } catch {
      // Offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Doa & bacaan</Text>
        <Text style={s.sub}>Arab, latin, dan terjemahannya.</Text>

        {loading && duas.length === 0 ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={{ marginTop: 40 }}
          />
        ) : (
          <View style={s.list}>
            {duas.map((dua, idx) => {
              const isOpen = openIdx === idx;
              return (
                <View key={dua.id} style={s.card}>
                  <TouchableOpacity
                    style={s.cardHeader}
                    onPress={() => setOpenIdx(isOpen ? -1 : idx)}
                    activeOpacity={0.7}
                  >
                    <View style={s.iconBox}>
                      <Ionicons
                        name="book-outline"
                        size={20}
                        color={colors.green}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{dua.title}</Text>
                      {dua.context && (
                        <Text style={s.cardSub}>{dua.context}</Text>
                      )}
                    </View>
                    <View
                      style={{
                        transform: [
                          { rotate: isOpen ? '180deg' : '0deg' },
                        ],
                      }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={colors.textFaint}
                      />
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.cardBody}>
                      {dua.arabic_text && (
                        <View style={s.arabicBox}>
                          <Text style={s.arabicText}>
                            {dua.arabic_text}
                          </Text>
                        </View>
                      )}
                      {dua.latin_text && (
                        <Text style={s.latinText}>{dua.latin_text}</Text>
                      )}
                      {dua.translation && (
                        <Text style={s.transText}>
                          &ldquo;{dua.translation}&rdquo;
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
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

  list: { marginTop: 16, gap: 10 },

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
    gap: 12,
    padding: 15,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EAF2E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 1,
  },

  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  arabicBox: {
    backgroundColor: '#FBF6EA',
    borderWidth: 1,
    borderColor: '#EDD9A6',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 18,
  },
  arabicText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 48,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  latinText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textSecondary,
    marginTop: 11,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  transText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 8,
    lineHeight: 21,
  },
});
