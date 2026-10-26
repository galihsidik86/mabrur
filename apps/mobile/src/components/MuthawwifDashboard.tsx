import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { api, type MemberStatus } from '../services/api';
import { getGroups } from '../services/db';
import { trackingLabel } from '../services/tracking-label';
import { useI18n, type TFunction, type TranslationKey } from '../services/i18n';
import StateNotice from './StateNotice';
import { formatDistance } from '../services/location';

type MemberData = MemberStatus;

interface Stats {
  jamaah_total: number;
  tracked: number;
  untracked: number;
}

interface SosAlert {
  id: string;
  user_name: string;
  user_phone: string;
  category: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

// Kunci (bukan teks) agar terjemahan dipanggil saat render.
const categoryKeys: Record<string, TranslationKey> = {
  medis: 'sos.cat.medis',
  tersesat: 'sos.cat.tersesat',
  kehilangan: 'sos.cat.kehilangan',
};

function categoryLabel(category: string, t: TFunction): string {
  const key = categoryKeys[category];
  return key ? t(key) : category;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Catatan jarak miqat hanya ditampilkan bila relevan (sedang dalam perjalanan ke miqat).
const MIQAT_NOTE_M = 20000;

function locationText(m: MemberData, now: number, t: TFunction): string {
  const parts = [trackingLabel(m.tracking, m.last_seen_at, now, t)];
  if (m.far_from_group && m.distance_to_leader != null) {
    parts.push(t('monitor.from_muthawwif', { distance: formatDistance(m.distance_to_leader) }));
  } else if (m.nearest_miqat && m.nearest_miqat.distance <= MIQAT_NOTE_M) {
    parts.push(t('monitor.from_place', {
      distance: formatDistance(m.nearest_miqat.distance),
      place: m.nearest_miqat.name,
    }));
  }
  return parts.join(' · ');
}

// Urutan daftar: tidak terpantau dulu, lalu perlu perhatian, lalu aman, muthawwif terakhir.
function memberRank(m: MemberData): number {
  if (m.role_in_group === 'muthawwif') return 3;
  if (m.tracking !== 'tracked') return 0;
  return m.status === 'attention' ? 1 : 2;
}

function reminderResultText(
  r: { sent: number; skipped_cooldown: number; no_push_token: number },
  t: TFunction,
): string {
  const lines = [t('monitor.reminder_sent', { count: r.sent })];
  if (r.skipped_cooldown > 0) lines.push(t('monitor.reminder_cooldown', { count: r.skipped_cooldown }));
  if (r.no_push_token > 0) lines.push(t('monitor.reminder_no_token', { count: r.no_push_token }));
  return lines.join('\n');
}

const avatarColors = [colors.primary];

function openGoogleMaps(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
}

function openWhatsApp(phone: string, name: string, category: string, t: TFunction) {
  // Format: 08xxx → 628xxx
  let wa = phone.replace(/^0/, '62');
  const msg = encodeURIComponent(t('monitor.sos_wa_message', { name, category }));
  Linking.openURL(`https://wa.me/${wa}?text=${msg}`);
}

export default function MuthawwifDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  // null sampai data pertama tiba — jangan tampilkan 0 yang terbaca seperti data asli.
  const [stats, setStats] = useState<Stats | null>(null);
  const [hasGroup, setHasGroup] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [reminding, setReminding] = useState(false);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [expandedSos, setExpandedSos] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (gid?: string | null) => {
    const id = gid || groupId;
    if (!id) {
      const groups = await getGroups();
      setHasGroup(groups.length > 0);
      if (groups.length > 0) {
        setGroupId(groups[0].id);
        return load(groups[0].id);
      }
      return;
    }

    try {
      const data = await api.getMemberStatuses(id);
      setStats({
        jamaah_total: data.stats.jamaah_total,
        tracked: data.stats.tracked,
        untracked: data.stats.stale + data.stats.no_location,
      });
      setMembers([...data.members].sort((a, b) => memberRank(a) - memberRank(b) || a.name.localeCompare(b.name)));

      // SOS ikut menentukan status sinkron: muthawwif harus tahu kalau SOS gagal dimuat.
      const alerts = await api.getGroupSos(id);
      setSosAlerts(alerts);
      setSyncFailed(false);
      setLastSync(new Date());
    } catch {
      setSyncFailed(true);
    }
  }, [groupId]);

  useEffect(() => {
    load();
    // Poll every 30 seconds
    intervalRef.current = setInterval(() => load(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const remind = useCallback(async (userIds?: string[]) => {
    if (!groupId || reminding) return;
    setReminding(true);
    try {
      const result = await api.sendLocationReminders(groupId, userIds);
      Alert.alert(t('monitor.reminder_title'), reminderResultText(result, t));
    } catch {
      Alert.alert(t('monitor.reminder_failed_title'), t('monitor.reminder_failed_body'));
    } finally {
      setReminding(false);
    }
  }, [groupId, reminding, t]);

  const openMember = (m: MemberData) => {
    if (m.location) {
      router.push({ pathname: '/peta', params: { focus: m.id } });
      return;
    }
    Alert.alert(m.name, t('monitor.member_no_location'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('monitor.send_reminder'), onPress: () => remind([m.id]) },
    ]);
  };

  const now = Date.now();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={s.modeLabel}>{t('mode.muthawwif_title')}</Text>
      <Text style={s.name}>{userName}</Text>

      {!hasGroup && <StateNotice kind="empty" message={t('common.no_group')} />}
      {syncFailed && (
        <View style={s.syncBanner} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={18} color={colors.dangerDark} />
          <Text style={s.syncBannerText}>
            {lastSync
              ? t('monitor.sync_failed_stale', { time: `${String(lastSync.getHours()).padStart(2, '0')}:${String(lastSync.getMinutes()).padStart(2, '0')}` })
              : t('monitor.sync_failed')}
          </Text>
        </View>
      )}

      {/* SOS Alerts — besar dan jelas untuk kondisi darurat */}
      {sosAlerts.map((sos) => {
        const timeAgo = Math.round((Date.now() - new Date(sos.created_at).getTime()) / 60000);
        return (
          <View key={sos.id} style={s.sosCard}>
            {/* Header */}
            <View style={s.sosHeader}>
              <View style={s.sosIconBox}>
                <Ionicons name="warning" size={28} color="#fff" />
              </View>
              <Text style={s.sosTitle}>{t('monitor.sos_title')}</Text>
            </View>

            {/* Info jamaah */}
            <Text style={s.sosName}>{sos.user_name}</Text>
            <Text style={s.sosCat}>
              {categoryLabel(sos.category, t)} · {t('monitor.sos_minutes_ago', { minutes: timeAgo })}
            </Text>
            <Text style={s.sosPhone}>{sos.user_phone || '-'}</Text>

            {/* Tombol besar — 2 kolom */}
            <View style={s.sosRow}>
              <TouchableOpacity style={s.sosBtnPrimary}
                onPress={() => {
                  if (sos.lat != null && sos.lng != null) openGoogleMaps(sos.lat, sos.lng);
                  else Alert.alert('', t('monitor.sos_no_gps'));
                }}>
                <Ionicons name="navigate" size={22} color={colors.dangerDark} />
                <Text style={s.sosBtnPrimaryText}>{t('monitor.sos_view_location')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sosBtnWa}
                onPress={() => {
                  if (sos.user_phone) openWhatsApp(sos.user_phone, sos.user_name, categoryLabel(sos.category, t), t);
                  else Alert.alert('', t('monitor.sos_no_phone'));
                }}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={s.sosBtnWhiteText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sosRow}>
              <TouchableOpacity style={s.sosBtnOutline}
                onPress={() => {
                  if (sos.user_phone) Linking.openURL(`tel:${sos.user_phone}`);
                  else Alert.alert('', t('monitor.sos_no_phone'));
                }}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={s.sosBtnWhiteText}>{t('monitor.sos_call')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sosBtnOutline}
                onPress={() => Alert.alert(
                  t('monitor.sos_resolve_title'),
                  t('monitor.sos_resolve_confirm', { name: sos.user_name }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('monitor.sos_resolve_yes'), onPress: async () => {
                      try {
                        await api.resolveSos(sos.id);
                        setSosAlerts((prev) => prev.filter((s2) => s2.id !== sos.id));
                      } catch {
                        Alert.alert(t('common.failed_title'), t('monitor.sos_resolve_failed'));
                      }
                    }},
                  ]
                )}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.sosBtnWhiteText}>{t('monitor.sos_resolve')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats?.jamaah_total ?? '–'}</Text>
          <Text style={s.statLabel}>{t('monitor.stat_total')}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: colors.green }]}>{stats?.tracked ?? '–'}</Text>
          <Text style={s.statLabel}>{t('monitor.stat_tracked')}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: colors.danger }]}>{stats?.untracked ?? '–'}</Text>
          <Text style={s.statLabel}>{t('monitor.stat_untracked')}</Text>
        </View>
      </View>

      {stats != null && stats.untracked > 0 && (
        <TouchableOpacity style={s.remindAllBtn} onPress={() => remind()} disabled={reminding}>
          <Ionicons name="notifications-outline" size={18} color={colors.textOnPrimary} />
          <Text style={s.remindAllText}>
            {reminding ? t('monitor.sending') : t('monitor.remind_all', { count: stats.untracked })}
          </Text>
        </TouchableOpacity>
      )}

      {/* Member List */}
      <Text style={s.sectionTitle}>{t('monitor.group_status')}</Text>
      <View style={s.listCard}>
        {members.map((m, idx) => (
          <TouchableOpacity
            key={m.id}
            style={[s.memberRow, idx > 0 && s.memberRowBorder]}
            onPress={() => openMember(m)}
            accessibilityHint={t('monitor.open_on_map_hint')}
          >
            <View
              style={[
                s.avatar,
                { backgroundColor: avatarColors[idx % avatarColors.length] },
                m.status === 'attention' && m.role_in_group !== 'muthawwif' && { backgroundColor: colors.danger },
              ]}
            >
              <Text style={s.avatarText}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.name}</Text>
              <Text style={[s.memberPlace, m.tracking !== 'tracked' && { color: colors.danger }]}>
                {locationText(m, now, t)}
              </Text>
            </View>
            {m.role_in_group === 'jamaah' && m.tracking !== 'tracked' && (
              <TouchableOpacity
                style={s.bellBtn}
                onPress={() => remind([m.id])}
                disabled={reminding}
                accessibilityLabel={t('monitor.remind_member_label', { name: m.name })}
              >
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <View
              style={[
                s.chip,
                m.status === 'attention'
                  ? { backgroundColor: colors.goldLight }
                  : { backgroundColor: colors.greenLight },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  m.status === 'attention'
                    ? { color: colors.goldText }
                    : { color: colors.greenDark },
                ]}
              >
                {m.status === 'attention' ? t('monitor.chip_attention') : t('monitor.chip_safe')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        {members.length === 0 && stats != null && (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={32} color={colors.textFaint} />
            <Text style={s.emptyText}>{t('monitor.empty_members')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  syncBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.card,
  },
  syncBannerText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'PlusJakartaSans_500Medium', color: colors.text },
  content: { padding: 16, paddingBottom: 24 },

  modeLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },
  name: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.text,
    letterSpacing: -0.3,
    marginTop: 1,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    paddingHorizontal: 12,
  },
  statNum: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textMuted,
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 2,
  },

  listCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 15,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textOnPrimary,
  },
  memberName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textSecondary,
  },
  memberPlace: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 1,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  remindAllBtn: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
  },
  remindAllText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  bellBtn: {
    width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },

  empty: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },

  sosCard: {
    marginTop: 14, borderRadius: 18,
    backgroundColor: colors.danger, padding: 20,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 10,
  },
  sosHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  sosIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  sosTitle: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#fff', letterSpacing: 1.5,
  },
  sosName: {
    fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#fff',
  },
  sosCat: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255,255,255,0.8)', marginTop: 3,
  },
  sosPhone: {
    fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.9)', marginTop: 2,
  },
  sosRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  sosBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
  },
  sosBtnPrimaryText: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.dangerDark,
  },
  sosBtnWa: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14,
  },
  sosBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12, paddingVertical: 12,
  },
  sosBtnWhiteText: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff',
  },
});
