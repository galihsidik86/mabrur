import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme';
import { api } from '../../src/services/api';
import {
  getGroups,
  saveSchedules,
  getSchedules,
  type Schedule,
} from '../../src/services/db';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${mon} · ${h}:${m}`;
}

function statusLabel(s: string): string {
  if (s === 'done') return 'Selesai';
  if (s === 'active') return 'Hari ini';
  return 'Nanti';
}

const dotColors = {
  done: { bg: colors.green, border: colors.greenLight },
  active: { bg: colors.primary, border: colors.primaryLight },
  upcoming: { bg: '#D8CBB2', border: colors.surface },
};

const chipColors = {
  done: { bg: colors.greenLight, text: colors.greenDark },
  active: { bg: colors.goldLight, text: '#97751F' },
  upcoming: { bg: colors.surface, text: colors.textMuted },
};

export default function JadwalScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');

  const load = useCallback(async () => {
    const groups = await getGroups();
    if (groups.length === 0) {
      setLoading(false);
      return;
    }
    const group = groups[0];
    setGroupName(`${group.name} · ${group.kloter_code}`);

    // Offline-first
    const local = await getSchedules(group.id);
    if (local.length > 0) {
      setSchedules(local);
      setLoading(false);
    }

    // Sync
    try {
      const remote = await api.getSchedules(group.id);
      await saveSchedules(group.id, remote);
      setSchedules(remote);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Jadwal & agenda</Text>
        <Text style={s.sub}>
          {groupName ? `Rangkaian ibadah ${groupName}.` : 'Rangkaian ibadah rombongan.'}
        </Text>

        {loading && schedules.length === 0 ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : schedules.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textFaint} />
            <Text style={s.emptyText}>Belum ada jadwal untuk rombonganmu</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {schedules.map((item, idx) => {
              const isLast = idx === schedules.length - 1;
              const dot = dotColors[item.status] || dotColors.upcoming;
              const chip = chipColors[item.status] || chipColors.upcoming;

              return (
                <View key={item.id} style={s.row}>
                  {/* Timeline left */}
                  <View style={s.timelineLeft}>
                    <View style={[s.dot, { backgroundColor: dot.bg, borderColor: dot.border }]} />
                    {!isLast && <View style={s.line} />}
                  </View>

                  {/* Content right */}
                  <View style={s.rowContent}>
                    <Text style={s.time}>{formatTime(item.start_time)}</Text>
                    <View style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={[s.chip, { backgroundColor: chip.bg }]}>
                          <Text style={[s.chipText, { color: chip.text }]}>
                            {statusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                      {item.location_name && (
                        <View style={s.locationRow}>
                          <Ionicons name="location-outline" size={13} color={colors.textFaint} />
                          <Text style={s.locationText}>{item.location_name}</Text>
                        </View>
                      )}
                    </View>
                  </View>
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint },

  timeline: { marginTop: 16, paddingLeft: 8 },

  row: { flexDirection: 'row', gap: 14 },

  timelineLeft: { alignItems: 'center', width: 14 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 3,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5DDD0',
    minHeight: 24,
  },

  rowContent: { flex: 1, paddingBottom: 16 },
  time: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 13,
    paddingHorizontal: 15,
    marginTop: 6,
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
    flex: 1,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },
});
