import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth';
import {
  getGroups,
  saveSchedules,
  getSchedules,
  type Schedule,
} from '../../src/services/db';
import { useI18n, type TFunction, type TranslationKey } from '../../src/services/i18n';
import StateNotice from '../../src/components/StateNotice';
import DateTimeField from '../../src/components/DateTimeField';

function formatTime(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const months = t('date.months_short').split(',');
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${mon} · ${h}:${m}`;
}

function statusLabelKey(s: string): TranslationKey {
  if (s === 'done') return 'content.status_done';
  if (s === 'active') return 'content.status_active';
  return 'content.status_upcoming';
}

const dotColors = {
  done: { bg: colors.green, border: colors.greenLight },
  active: { bg: colors.primary, border: colors.primaryLight },
  upcoming: { bg: '#D8CBB2', border: colors.surface },
};

const chipColors = {
  done: { bg: colors.greenLight, text: colors.greenDark },
  active: { bg: colors.goldLight, text: colors.goldText },
  upcoming: { bg: colors.surface, text: colors.textMuted },
};

export default function JadwalScreen() {
  const t = useI18n((st) => st.t);
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'muthawwif' || user?.role === 'admin';
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasGroup, setHasGroup] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formTime, setFormTime] = useState('');

  const load = useCallback(async () => {
    setLoadFailed(false);
    const groups = await getGroups();
    setHasGroup(groups.length > 0);
    if (groups.length === 0) {
      setLoading(false);
      return;
    }
    const group = groups[0];
    setGroupId(group.id);
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
    } catch {
      setLoadFailed(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>{t('content.schedule_title')}</Text>
        <Text style={s.sub}>
          {groupName ? t('content.schedule_sub_group', { group: groupName }) : t('content.schedule_sub')}
        </Text>

        {canEdit && (
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity onPress={() => setShowForm(!showForm)}
              style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <Ionicons name={showForm ? 'close' : 'add'} size={18} color={colors.textOnPrimary} />
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>{showForm ? t('content.schedule_close') : t('content.schedule_add')}</Text>
            </TouchableOpacity>
            {showForm && (
              <View style={{ marginTop: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 }}>
                <TextInput placeholder={t('content.schedule_ph_title')} value={formTitle} onChangeText={setFormTitle}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text, marginBottom: 8 }} placeholderTextColor={colors.textFaint} />
                <TextInput placeholder={t('content.schedule_ph_location')} value={formLocation} onChangeText={setFormLocation}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text, marginBottom: 8 }} placeholderTextColor={colors.textFaint} />
                <View style={{ marginBottom: 10 }}>
                  <DateTimeField label={t('content.schedule_time_label')} value={formTime} onChange={setFormTime} />
                </View>
                <TouchableOpacity onPress={async () => {
                  if (!formTitle || !formTime || !groupId) { Alert.alert('', t('content.schedule_required')); return; }
                  try {
                    await api.createSchedule(groupId, { title: formTitle, location_name: formLocation, start_time: new Date(formTime).toISOString() });
                    setFormTitle(''); setFormLocation(''); setFormTime(''); setShowForm(false); load();
                  } catch (e: any) { Alert.alert(t('content.schedule_failed'), e.message); }
                }} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 11, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>{t('content.schedule_save')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loading && schedules.length === 0 ? (
          <StateNotice kind="loading" message={t('common.loading')} />
        ) : !hasGroup ? (
          <StateNotice kind="empty" message={t('common.no_group')} />
        ) : schedules.length === 0 && loadFailed ? (
          <StateNotice kind="error" message={t('common.load_failed')} actionLabel={t('common.retry')} onAction={load} />
        ) : schedules.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.textFaint} />
            <Text style={s.emptyText}>{t('content.schedule_empty')}</Text>
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
                    <Text style={s.time}>{formatTime(item.start_time, t)}</Text>
                    <View style={s.card}>
                      <View style={s.cardTop}>
                        <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={[s.chip, { backgroundColor: chip.bg }]}>
                          <Text style={[s.chipText, { color: chip.text }]}>
                            {t(statusLabelKey(item.status))}
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },

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
    backgroundColor: colors.border,
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
