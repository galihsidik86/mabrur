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
import { api } from '../services/api';
import { getGroups } from '../services/db';

interface MemberData {
  id: string;
  name: string;
  phone: string;
  role_in_group: string;
  location: { lat: number; lng: number; updated_at: string } | null;
  ihram: { is_ihram: boolean; niat_type: string | null };
  nearest_miqat: { name: string; distance: number } | null;
  status: 'safe' | 'attention';
}

interface Stats {
  total: number;
  safe: number;
  attention: number;
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

const categoryLabels: Record<string, string> = {
  medis: 'Medis',
  tersesat: 'Tersesat',
  kehilangan: 'Kehilangan',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function locationText(m: MemberData): string {
  if (!m.location) return 'Belum ada lokasi';
  if (m.nearest_miqat) {
    const km = (m.nearest_miqat.distance / 1000).toFixed(1).replace('.', ',');
    return `${km} km dari ${m.nearest_miqat.name}`;
  }
  return 'Lokasi tersedia';
}

const avatarColors = [colors.primary, colors.green, colors.gold, colors.textSecondary, colors.danger];

function openGoogleMaps(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
}

function openWhatsApp(phone: string, name: string, category: string) {
  // Format: 08xxx → 628xxx
  let wa = phone.replace(/^0/, '62');
  const msg = encodeURIComponent(`Assalamualaikum ${name}, kami menerima sinyal SOS (${category}) dari Anda. Apakah Anda baik-baik saja? Kami sedang menuju lokasi Anda.`);
  Linking.openURL(`https://wa.me/${wa}?text=${msg}`);
}

export default function MuthawwifDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ total: 0, safe: 0, attention: 0 });
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
      if (groups.length > 0) {
        setGroupId(groups[0].id);
        return load(groups[0].id);
      }
      return;
    }

    try {
      const data = await api.getMemberStatuses(id);
      setStats(data.stats);
      // Sort: attention first, then by name
      const sorted = data.members.sort((a: MemberData, b: MemberData) => {
        if (a.status !== b.status) return a.status === 'attention' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setMembers(sorted);

      // Fetch SOS
      try {
        const alerts = await api.getGroupSos(id);
        setSosAlerts(alerts);
      } catch {}
    } catch {}
  }, [groupId]);

  useEffect(() => {
    load();
    // Poll every 30 seconds
    intervalRef.current = setInterval(() => load(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

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
      <Text style={s.modeLabel}>Mode Muthawwif</Text>
      <Text style={s.name}>{userName}</Text>

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
              <Text style={s.sosTitle}>SOS DARURAT</Text>
            </View>

            {/* Info jamaah */}
            <Text style={s.sosName}>{sos.user_name}</Text>
            <Text style={s.sosCat}>{categoryLabels[sos.category] || sos.category} · {timeAgo} menit lalu</Text>
            <Text style={s.sosPhone}>{sos.user_phone || '-'}</Text>

            {/* Tombol besar — 2 kolom */}
            <View style={s.sosRow}>
              <TouchableOpacity style={s.sosBtnPrimary}
                onPress={() => {
                  if (sos.lat != null && sos.lng != null) openGoogleMaps(sos.lat, sos.lng);
                  else Alert.alert('', 'Lokasi GPS tidak tersedia');
                }}>
                <Ionicons name="navigate" size={22} color={colors.dangerDark} />
                <Text style={s.sosBtnPrimaryText}>Lihat Lokasi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sosBtnWa}
                onPress={() => {
                  if (sos.user_phone) openWhatsApp(sos.user_phone, sos.user_name, categoryLabels[sos.category] || sos.category);
                  else Alert.alert('', 'Nomor HP tidak tersedia');
                }}>
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={s.sosBtnWhiteText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sosRow}>
              <TouchableOpacity style={s.sosBtnOutline}
                onPress={() => {
                  if (sos.user_phone) Linking.openURL(`tel:${sos.user_phone}`);
                  else Alert.alert('', 'Nomor HP tidak tersedia');
                }}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={s.sosBtnWhiteText}>Telepon</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sosBtnOutline}
                onPress={() => Alert.alert(
                  'Selesaikan SOS',
                  `Yakin SOS dari ${sos.user_name} sudah ditangani?`,
                  [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Ya, Selesai', onPress: async () => {
                      try { await api.resolveSos(sos.id); setSosAlerts((prev) => prev.filter((s2) => s2.id !== sos.id)); } catch {}
                    }},
                  ]
                )}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.sosBtnWhiteText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats.total}</Text>
          <Text style={s.statLabel}>Total jamaah</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: colors.green }]}>{stats.safe}</Text>
          <Text style={s.statLabel}>Aman</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: colors.danger }]}>{stats.attention}</Text>
          <Text style={s.statLabel}>Perlu perhatian</Text>
        </View>
      </View>

      {/* Member List */}
      <Text style={s.sectionTitle}>Status rombongan</Text>
      <View style={s.listCard}>
        {members.map((m, idx) => (
          <View
            key={m.id}
            style={[s.memberRow, idx > 0 && s.memberRowBorder]}
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
              <Text style={s.memberPlace}>{locationText(m)}</Text>
            </View>
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
                    ? { color: '#97751F' }
                    : { color: colors.greenDark },
                ]}
              >
                {m.status === 'attention' ? 'Perhatian' : 'Aman'}
              </Text>
            </View>
          </View>
        ))}
        {members.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={32} color={colors.textFaint} />
            <Text style={s.emptyText}>Belum ada data anggota</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
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
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: colors.textSecondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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

  empty: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textFaint,
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
