import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';
import { colors, radius } from '../../src/theme';
import { api } from '../../src/services/api';
import { formatDistance } from '../../src/services/location';
import MuthawwifDashboard from '../../src/components/MuthawwifDashboard';
import {
  saveGroups,
  getGroups,
  saveGroupMembers,
  getGroupMembers,
  saveSchedules,
  getNextSchedule,
  getIhramLocal,
  type Schedule,
} from '../../src/services/db';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface GroupData {
  id: string;
  name: string;
  kloter_code: string;
  member_count: number;
}

export default function BerandaScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [muthawwif, setMuthawwif] = useState<string | null>(null);
  const [nextAgenda, setNextAgenda] = useState<Schedule | null>(null);
  const [ihram, setIhram] = useState<{ is_ihram: boolean; distance_meters: number | null; nearest_miqat: string | null }>({ is_ihram: false, distance_meters: null, nearest_miqat: null });
  const [mode, setMode] = useState<'jamaah' | 'muthawwif'>('jamaah');
  const [refreshing, setRefreshing] = useState(false);

  const isMuthawwif = user?.role === 'muthawwif' || user?.role === 'admin';

  const firstName = user?.name?.split(' ').pop() || user?.name || '';

  const loadData = useCallback(async () => {
    // Load ihram status
    const ihramLocal = await getIhramLocal();
    if (ihramLocal) setIhram(ihramLocal);

    // Load from local DB first (offline-first)
    const localGroups = await getGroups();
    if (localGroups.length > 0) {
      setGroup(localGroups[0] as GroupData);
      const members = await getGroupMembers(localGroups[0].id);
      const m = members.find((m) => m.role_in_group === 'muthawwif');
      if (m) setMuthawwif(m.name);
      const agenda = await getNextSchedule(localGroups[0].id);
      if (agenda) setNextAgenda(agenda);
    }

    // Then sync from server
    try {
      const groups = await api.getGroups();
      if (groups.length > 0) {
        await saveGroups(groups);
        setGroup(groups[0]);

        const members = await api.getGroupMembers(groups[0].id);
        await saveGroupMembers(groups[0].id, members);
        const m = members.find((m: any) => m.role_in_group === 'muthawwif');
        if (m) setMuthawwif(m.name);

        // Sync schedules
        try {
          const schedules = await api.getSchedules(groups[0].id);
          await saveSchedules(groups[0].id, schedules);
          const next = schedules.find((s: any) => s.status !== 'done');
          if (next) setNextAgenda(next);
        } catch {}
      }
    } catch {
      // Offline — local data sudah dimuat di atas
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const quickActions: Array<{
    label: string;
    icon: IoniconsName;
    route: string;
    color: string;
  }> = [
    { label: 'Tuntunan', icon: 'book-outline', route: '/ibadah', color: colors.primary },
    { label: 'Doa', icon: 'reader-outline', route: '/doa', color: colors.green },
    { label: 'Jadwal', icon: 'calendar-outline', route: '/jadwal', color: colors.gold },
    { label: 'Peta', icon: 'map-outline', route: '/peta', color: colors.primary },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <View style={s.appIcon}>
            <View style={s.appIconInner} />
          </View>
          <Text style={s.appTitle}>Mabrur</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => router.push('/chat')} style={s.logoutBtn}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={s.logoutBtn}>
            <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          {isMuthawwif && (
            <View style={s.modeToggle}>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'jamaah' && s.modeBtnActive]}
                onPress={() => setMode('jamaah')}
              >
                <Text style={[s.modeBtnText, mode === 'jamaah' && s.modeBtnTextActive]}>Jamaah</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === 'muthawwif' && s.modeBtnActive]}
                onPress={() => setMode('muthawwif')}
              >
                <Text style={[s.modeBtnText, mode === 'muthawwif' && s.modeBtnTextActive]}>Muthawwif</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {mode === 'muthawwif' && isMuthawwif ? (
        <MuthawwifDashboard userName={user?.name || ''} />
      ) : (
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Greeting */}
        <Text style={s.greeting}>Assalamu'alaikum,</Text>
        <Text style={s.name}>Hai, {firstName}</Text>

        {/* Ihram Hero Card */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLabel}>STATUS IHRAM</Text>
              <Text style={s.heroTitle}>{ihram.is_ihram ? 'Sudah berihram' : 'Belum berihram'}</Text>
            </View>
            <View style={[s.heroBadge, ihram.is_ihram && { backgroundColor: colors.greenLight }]}>
              <Text style={[s.heroBadgeText, ihram.is_ihram && { color: colors.greenDark }]}>
                {ihram.is_ihram ? 'AKTIF' : 'SIAPKAN'}
              </Text>
            </View>
          </View>

          <View style={s.heroDivider} />

          <View style={s.heroStats}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroStatLabel}>MIQAT TERDEKAT</Text>
              <Text style={s.heroStatValue}>{ihram.nearest_miqat || 'Menunggu GPS'}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroStatLabel}>JARAK KE BATAS</Text>
              <Text style={s.heroDistValue}>
                {ihram.distance_meters != null ? formatDistance(ihram.distance_meters) : '— —'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.heroBtn}
            onPress={() => router.push('/peta')}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={16} color={colors.textOnPrimary} />
            <Text style={s.heroBtnText}>Buka peta batas miqat</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={s.quickGrid}>
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={s.quickAction}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={s.quickIcon}>
                <Ionicons name={item.icon} size={23} color={item.color} />
              </View>
              <Text style={s.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Next Agenda */}
        {nextAgenda && (() => {
          const d = new Date(nextAgenda.start_time);
          const months = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
          const day = d.getDate().toString();
          const mon = months[d.getMonth()];
          const h = d.getHours().toString().padStart(2, '0');
          const m = d.getMinutes().toString().padStart(2, '0');
          return (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Agenda berikutnya</Text>
                <TouchableOpacity onPress={() => router.push('/jadwal')}>
                  <Text style={s.sectionLink}>Lihat semua ›</Text>
                </TouchableOpacity>
              </View>
              <View style={s.card}>
                <View style={s.agendaDate}>
                  <Text style={s.agendaDay}>{day}</Text>
                  <Text style={s.agendaMonth}>{mon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.agendaTitle}>{nextAgenda.title}</Text>
                  <Text style={s.agendaSub}>
                    {h}:{m}{nextAgenda.location_name ? ` · ${nextAgenda.location_name}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </>
          );
        })()}

        {/* Rombongan */}
        {group && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Rombongan kamu</Text>
              <View style={s.safeChip}>
                <Text style={s.safeChipText}>
                  {group.member_count} anggota
                </Text>
              </View>
            </View>
            <View style={[s.card, { flexDirection: 'column', gap: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View style={s.avatarRow}>
                  {['AH', 'SR', 'MZ'].map((init, i) => (
                    <View
                      key={init}
                      style={[
                        s.avatar,
                        {
                          backgroundColor: [colors.primary, colors.green, colors.gold][i],
                          marginLeft: i > 0 ? -9 : 0,
                        },
                      ]}
                    >
                      <Text style={s.avatarText}>{init}</Text>
                    </View>
                  ))}
                  {group.member_count > 3 && (
                    <View style={[s.avatar, { backgroundColor: colors.surface, marginLeft: -9 }]}>
                      <Text style={[s.avatarText, { color: colors.textMuted }]}>
                        +{group.member_count - 3}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.groupName}>
                    {group.name} · {group.kloter_code}
                  </Text>
                  {muthawwif && (
                    <Text style={s.groupSub}>Muthawwif: {muthawwif}</Text>
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(245,241,232,0.86)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  appIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconInner: {
    width: 14,
    height: 3,
    backgroundColor: '#F5D98A',
    borderRadius: 1,
  },
  appTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  logoutBtn: { padding: 6 },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E5DDD0',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: colors.textOnPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  greeting: {
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

  // Hero Card
  heroCard: {
    marginTop: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    padding: 18,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 10,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.4,
    color: 'rgba(245,241,232,0.72)',
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textOnPrimary,
    marginTop: 6,
  },
  heroBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.dangerDark,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(245,241,232,0.16)',
    marginVertical: 15,
  },
  heroStats: { flexDirection: 'row', gap: 16 },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    letterSpacing: 1,
    color: 'rgba(245,241,232,0.6)',
  },
  heroStatValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textOnPrimary,
    marginTop: 3,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(245,241,232,0.16)',
  },
  heroDistValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F5D98A',
    marginTop: 3,
  },
  heroBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(245,241,232,0.14)',
    borderRadius: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  heroBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textOnPrimary,
  },

  // Quick Actions
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 10,
  },
  quickAction: { alignItems: 'center', gap: 7, flex: 1 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  quickLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textSecondary,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.primary,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  // Agenda
  agendaDate: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: '#EBD4CB',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  agendaDay: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.primary,
    lineHeight: 22,
  },
  agendaMonth: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#A5654E',
    marginTop: 2,
  },
  agendaTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textSecondary,
  },
  agendaSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 2,
  },

  // Group
  safeChip: {
    backgroundColor: colors.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  safeChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.green,
  },
  avatarRow: { flexDirection: 'row' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textOnPrimary,
  },
  groupName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textSecondary,
  },
  groupSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
    marginTop: 1,
  },
});
