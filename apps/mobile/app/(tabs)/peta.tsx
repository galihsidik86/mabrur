import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme';
import { useLocalSearchParams } from 'expo-router';
import { api, type MemberStatus } from '../../src/services/api';
import { escapeHtml } from '../../src/services/html-escape';
import { trackingLabel } from '../../src/services/tracking-label';
import { useI18n } from '../../src/services/i18n';
import {
  saveMiqatZones,
  getMiqatZones,
  saveIhramLocal,
  getIhramLocal,
  getMeta,
  setMeta,
} from '../../src/services/db';
import {
  requestPermission,
  getPosition,
  watchPosition,
  findNearest,
  formatDistance,
  type MiqatZone,
  type NearestResult,
} from '../../src/services/location';
import { useAuthStore } from '../../src/stores/auth';
import { getGroups } from '../../src/services/db';
import MapViewComponent from '../../src/components/MapView';
import { ARAFAH_BOUNDARY, ARAFAH_CENTER, KAABAH, NAMIRAH_MOSQUE_CENTER } from '../../src/services/sacred-zones';

const MAP_HEIGHT = 300;
// sync_meta: status ihram yang diubah saat offline dan belum sampai ke server ('1' / '0' / '').
const IHRAM_PENDING_KEY = 'ihram_pending';
// Jarak (m) yang dianggap awal bilah progres menuju miqat.
const PROGRESS_RANGE_M = 12000;
const screenW = Dimensions.get('window').width;
// Kunci (bukan teks) agar terjemahan dipanggil saat render.
const HARAM_RULE_KEYS = [
  'monitor.haram_rule_hunt',
  'monitor.haram_rule_plants',
  'monitor.haram_rule_ihram',
] as const;

export default function PetaScreen() {
  const user = useAuthStore((s) => s.user);
  const isMuthawwif = user?.role === 'muthawwif' || user?.role === 'admin';
  const t = useI18n((st) => st.t);
  const [zones, setZones] = useState<MiqatZone[]>([]);
  const [nearest, setNearest] = useState<NearestResult | null>(null);
  const [isIhram, setIsIhram] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapTab, setMapTab] = useState<'miqat' | 'realmap' | 'arafah' | 'monitor'>('miqat');
  const [members, setMembers] = useState<MemberStatus[]>([]);
  // ?focus=<userId> dari dashboard muthawwif: buka tab Monitor berpusat di jamaah itu.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const watchRef = useRef<{ remove: () => void } | null>(null);

  // null sampai GPS memberi posisi dan zona miqat tersedia — jangan tampilkan jarak karangan.
  const distance = nearest?.distance ?? null;
  // Pakai withinWarning dari findNearest (radius zona), bukan ambang hardcode.
  const warn = (nearest?.withinWarning ?? false) && !isIhram;
  const ready = isIhram;
  const approach = nearest != null && !warn && !isIhram;
  const unknown = nearest == null && !isIhram;
  const progress = distance == null ? 0 : Math.max(0, Math.min(1, 1 - distance / PROGRESS_RANGE_M));

  const loadZones = useCallback(async () => {
    let z = await getMiqatZones();
    if (z.length === 0) {
      try {
        z = await api.getMiqatZones();
        await saveMiqatZones(z);
      } catch {}
    }
    setZones(z);
    return z;
  }, []);

  const loadIhram = useCallback(async () => {
    const local = await getIhramLocal();
    if (local) setIsIhram(local.is_ihram);
    // Perubahan yang dibuat saat offline dikirim dulu, agar tidak ditimpa status lama dari server.
    const pending = await getMeta(IHRAM_PENDING_KEY);
    try {
      if (pending) {
        await api.toggleIhram(pending === '1', 'umrah');
        await setMeta(IHRAM_PENDING_KEY, '');
        return;
      }
      const remote = await api.getIhramStatus();
      setIsIhram(remote.is_ihram);
    } catch {}
  }, []);

  const startTracking = useCallback(async (z: MiqatZone[]) => {
    const granted = await requestPermission();
    if (!granted) {
      setLocationDenied(true);
      return;
    }
    setLocationDenied(false);

    // Initial position
    const pos = await getPosition();
    if (pos && z.length > 0) {
      setHasLocation(true);
      const n = findNearest(pos.lat, pos.lng, z);
      setNearest(n);
      if (n) await saveIhramLocal({ is_ihram: isIhram, distance_meters: n.distance, nearest_miqat: n.zone.name });
      try { await api.sendLocation(pos.lat, pos.lng, pos.accuracy ?? undefined); } catch {}
    }

    // Watch
    watchRef.current = watchPosition((lat, lng, acc) => {
      setHasLocation(true);
      setUserPos({ lat, lng });
      const n = findNearest(lat, lng, z);
      setNearest(n);
      if (n) saveIhramLocal({ is_ihram: isIhram, distance_meters: n.distance, nearest_miqat: n.zone.name });
      api.sendLocation(lat, lng, acc ?? undefined).catch(() => {});
    });
  }, [isIhram, t]);

  useEffect(() => {
    (async () => {
      const z = await loadZones();
      await loadIhram();
      await startTracking(z);
    })();
    return () => { watchRef.current?.remove(); };
  }, []);

  const toggleIhram = async () => {
    const next = !isIhram;
    setIsIhram(next);
    // Offline-first: status di HP selalu tersimpan, terlepas dari sinyal.
    try {
      await saveIhramLocal({ is_ihram: next, distance_meters: distance, nearest_miqat: nearest?.zone.name });
    } catch {}
    try {
      await api.toggleIhram(next, 'umrah');
      await setMeta(IHRAM_PENDING_KEY, '');
    } catch {
      await setMeta(IHRAM_PENDING_KEY, next ? '1' : '0').catch(() => {});
      Alert.alert(t('monitor.ihram_pending_title'), t('monitor.ihram_pending_body'));
    }
  };

  useEffect(() => {
    if (focus && isMuthawwif) setMapTab('monitor');
  }, [focus, isMuthawwif]);

  // Load member locations for muthawwif monitoring
  useEffect(() => {
    if (!isMuthawwif || mapTab !== 'monitor') return;
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      const groups = await getGroups();
      if (groups.length === 0) return;
      const loadMembers = async () => {
        try {
          const data = await api.getMemberStatuses(groups[0].id);
          setMembers(data.members);
        } catch {}
      };
      await loadMembers();
      timer = setInterval(loadMembers, 15000);
    })();
    return () => clearInterval(timer);
  }, [mapTab, isMuthawwif]);

  // Marker position on stylized map
  const angle = (-58 * Math.PI) / 180;
  const rOuter = 120, rRing = 75;
  const r = rOuter - progress * (rOuter - rRing);
  const mx = 50 + (r * Math.cos(angle)) / 3;
  const my = 44 - (r * Math.sin(angle)) / 3;

  const mapTabs: Array<{ id: typeof mapTab; label: string }> = [
    { id: 'miqat', label: t('monitor.tab_miqat') },
    { id: 'realmap', label: t('monitor.tab_map') },
    { id: 'arafah', label: t('monitor.tab_arafah') },
    ...(isMuthawwif ? [{ id: 'monitor' as const, label: t('monitor.tab_monitor') }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Map Tab Selector — fixed di atas, tidak tertutup maps */}
      <View style={{
        backgroundColor: colors.bg, zIndex: 10, elevation: 4,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 4,
      }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
          {mapTabs.map((tab) => (
            <TouchableOpacity key={tab.id} onPress={() => setMapTab(tab.id)}
              hitSlop={{ top: 5, bottom: 5 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mapTab === tab.id }}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: mapTab === tab.id ? colors.primary : colors.card, borderWidth: 1, borderColor: mapTab === tab.id ? colors.primary : colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: mapTab === tab.id ? '#fff' : colors.textMuted }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ===== REAL MAP ===== */}
      {mapTab === 'realmap' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <MapViewComponent
            height={400}
            zoom={14}
            userLocation={userPos}
            center={userPos || { lat: KAABAH.lat, lng: KAABAH.lng }}
            markers={[
              // Piktogram landmark sengaja dipakai: ini penanda tempatnya sendiri, bukan hiasan.
            { lat: KAABAH.lat, lng: KAABAH.lng, icon: '🕋', name: "Ka'bah" },
              ...zones.filter((z) => z.zone_type === 'miqat').map((z) => ({
                lat: z.center_lat, lng: z.center_lng, name: z.name, color: colors.accent,
                popup: `<b>${escapeHtml(z.name)}</b><br/>${escapeHtml(t('monitor.popup_radius', { meters: z.radius_meters }))}`,
              })),
            ]}
            circles={zones.map((z) => ({
              lat: z.center_lat, lng: z.center_lng, radius: z.zone_type === 'haram' ? z.radius_meters : z.warning_radius,
              color: z.zone_type === 'haram' ? colors.green : colors.accent,
              fillOpacity: 0.08,
              label: z.name,
            }))}
          />
          {nearest && (
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{t('monitor.nearest_miqat', { name: nearest.zone.name })}</Text>
              <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.primary, marginTop: 4 }}>{formatDistance(nearest.distance)}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ===== ARAFAH MAP ===== */}
      {mapTab === 'arafah' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <MapViewComponent
            height={400}
            zoom={14}
            center={ARAFAH_CENTER}
            userLocation={userPos}
            markers={[
              { lat: ARAFAH_CENTER.lat, lng: ARAFAH_CENTER.lng, icon: '⛰️', name: 'Jabal Rahmah' },
              { lat: NAMIRAH_MOSQUE_CENTER.lat, lng: NAMIRAH_MOSQUE_CENTER.lng, icon: '🕌', name: t('monitor.namirah_marker') },
            ]}
            polygons={[{
              coords: ARAFAH_BOUNDARY,
              color: colors.green, fillColor: colors.green, fillOpacity: 0.12,
              label: t('monitor.arafah_polygon'),
            }]}
          />
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{t('monitor.arafah_title')}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 4, lineHeight: 20 }}>
              {t('monitor.arafah_line_area')}{'\n'}
              {t('monitor.arafah_line_namirah')}{'\n'}
              {t('monitor.arafah_line_tool')}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ===== MONITORING MAP (MUTHAWWIF) ===== */}
      {mapTab === 'monitor' && isMuthawwif && (() => {
        const now = Date.now();
        const jamaah = members.filter((m) => m.role_in_group === 'jamaah');
        const located = members.filter((m) => m.location);
        const noLocation = jamaah.filter((m) => m.tracking === 'none');
        const focused = members.find((m) => m.id === focus && m.location);
        const markerColor = (m: MemberStatus) =>
          m.tracking !== 'tracked' ? colors.textMuted : m.status === 'safe' ? colors.green : colors.danger;
        return (
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <MapViewComponent
            key={focused?.id ?? 'all'}
            height={400}
            zoom={focused ? 17 : 13}
            center={focused?.location ?? userPos ?? { lat: KAABAH.lat, lng: KAABAH.lng }}
            userLocation={userPos}
            markers={located.map((m) => ({
              lat: m.location!.lat, lng: m.location!.lng,
              name: m.name,
              color: markerColor(m),
              pulse: m.id === focused?.id || (m.tracking === 'tracked' && m.status === 'attention'),
              popup: `<b>${escapeHtml(m.name)}</b><br/>${escapeHtml(trackingLabel(m.tracking, m.last_seen_at, now, t))}`
                + (m.far_from_group && m.distance_to_leader != null
                  ? `<br/>${escapeHtml(t('monitor.from_muthawwif', { distance: formatDistance(m.distance_to_leader) }))}`
                  : '')
                + (m.nearest_miqat ? `<br/>${escapeHtml(m.nearest_miqat.name)}: ${formatDistance(m.nearest_miqat.distance)}` : ''),
            }))}
          />
          <View style={{ padding: 16 }}>
            <Text style={s.monitorTitle}>
              {t('monitor.tracked_count', {
                tracked: jamaah.filter((m) => m.tracking === 'tracked').length,
                total: jamaah.length,
              })}
            </Text>
            <View style={s.legendSwatches}>
              {[
                { color: colors.green, label: t('monitor.legend_safe') },
                { color: colors.danger, label: t('monitor.legend_attention') },
                { color: colors.textMuted, label: t('monitor.legend_stale') },
              ].map((item) => (
                <View key={item.label} style={s.legendSwatch}>
                  <View style={[s.legendDot, { backgroundColor: item.color }]} />
                  <Text style={s.monitorLegend}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Text style={s.monitorLegend}>{t('monitor.legend_refresh')}</Text>
            {noLocation.length > 0 && (
              <View style={s.noLocBox}>
                <Text style={s.noLocTitle}>{t('monitor.no_location_count', { count: noLocation.length })}</Text>
                <Text style={s.noLocNames}>{noLocation.map((m) => m.name).join(', ')}</Text>
                <Text style={s.noLocHint}>{t('monitor.no_location_hint')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        );
      })()}

      {/* ===== MIQAT (existing stylized) ===== */}
      {mapTab === 'miqat' && (
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Stylized Map */}
        <View style={s.mapCanvas}>
          {/* Miqat ring */}
          <View style={s.miqatRing} />
          <View style={s.miqatLabel}>
            <Text style={s.miqatLabelText}>{t('monitor.miqat_boundary_caps')}</Text>
          </View>
          {/* Haram ring */}
          <View style={s.haramRing} />
          {/* Ka'bah */}
          <View style={s.kaabahWrap}>
            <View style={s.kaabah}><View style={s.kaabahGold} /></View>
            <Text style={s.kaabahLabel}>Ka'bah</Text>
          </View>
          {/* User marker */}
          {hasLocation && (
            <View style={[s.marker, { left: `${mx}%`, top: `${my}%` }]}>
              <View style={s.markerPulse} />
              <View style={s.markerDot} />
            </View>
          )}
          {/* Legend */}
          <View style={s.legend}>
            <View style={s.legendRow}>
              <View style={[s.legendBox, { borderColor: colors.accent, borderWidth: 2, backgroundColor: 'rgba(139,46,46,0.1)' }]} />
              <Text style={s.legendText}>{t('monitor.legend_miqat')}</Text>
            </View>
            <View style={s.legendRow}>
              <View style={[s.legendBox, { borderColor: colors.green, borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'rgba(74,124,58,0.12)' }]} />
              <Text style={s.legendText}>{t('monitor.legend_haram')}</Text>
            </View>
          </View>
        </View>

        {/* Status Card */}
        {warn && (
          <View style={s.statusWarn}>
            <View style={s.statusIcon}>
              <Ionicons name="warning" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusWarnTitle}>{t('miqat.warn_title')}</Text>
              <Text style={s.statusWarnSub}>{t('miqat.warn_sub', { distance: distance == null ? '–' : formatDistance(distance) })}</Text>
            </View>
          </View>
        )}
        {ready && (
          <View style={s.statusReady}>
            <View style={[s.statusIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Ionicons name="checkmark" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusReadyTitle}>{t('miqat.ready_title')}</Text>
              <Text style={s.statusReadySub}>{t('miqat.ready_sub')}</Text>
            </View>
          </View>
        )}
        {unknown && (
          <View style={s.statusApproach}>
            <View style={[s.statusIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name={locationDenied ? 'location-outline' : 'locate-outline'} size={23} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusApproachTitle}>
                {locationDenied
                  ? t('monitor.perm_title')
                  : hasLocation ? t('monitor.no_zones_title') : t('monitor.gps_waiting_title')}
              </Text>
              <Text style={s.statusApproachSub}>
                {locationDenied
                  ? t('monitor.perm_body')
                  : hasLocation ? t('monitor.no_zones_sub') : t('monitor.gps_waiting_sub')}
              </Text>
              {locationDenied && (
                <TouchableOpacity
                  onPress={() => Linking.openSettings()}
                  accessibilityRole="button"
                  style={s.settingsBtn}
                >
                  <Text style={s.settingsBtnText}>{t('monitor.open_settings')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {approach && (
          <View style={s.statusApproach}>
            <View style={[s.statusIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="location" size={23} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusApproachTitle}>{t('miqat.approach_title')}</Text>
              <Text style={s.statusApproachSub}>{t('miqat.approach_sub')}</Text>
            </View>
          </View>
        )}

        {/* Distance + Progress */}
        <View style={s.distCard}>
          <View style={s.distRow}>
            <Text style={s.distLabel}>{t('miqat.distance_label')}</Text>
            <Text style={s.distValue}>{distance == null ? '–' : formatDistance(distance)}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressBar, {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: warn ? colors.danger : colors.green,
            }]} />
          </View>
          <View style={s.progressLabels}>
            <Text style={s.progressLabel}>{t('monitor.progress_miqat')}</Text>
            <Text style={s.progressLabel}>{t('monitor.progress_journey')}</Text>
          </View>
          {nearest && (
            <Text style={s.nearestInfo}>
              {t('monitor.nearest_miqat', { name: nearest.zone.name })}
            </Text>
          )}
        </View>

        {/* Ihram Toggle */}
        <TouchableOpacity
          style={[s.ihramBtn, isIhram && s.ihramBtnActive]}
          onPress={toggleIhram}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isIhram ? 'close-circle-outline' : 'checkmark-circle-outline'}
            size={20}
            color={isIhram ? colors.primary : colors.textOnPrimary}
          />
          <Text style={[s.ihramBtnText, isIhram && s.ihramBtnTextActive]}>
            {isIhram ? t('monitor.ihram_cancel') : t('monitor.ihram_confirm')}
          </Text>
        </TouchableOpacity>

        {/* Info */}
        <Text style={s.infoTitle}>{t('monitor.haram_rules_title')}</Text>
        <View style={s.infoCard}>
          {HARAM_RULE_KEYS.map((key, i) => (
            <View key={key} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
              <Ionicons name="checkmark" size={18} color={colors.green} style={{ marginTop: 1 }} />
              <Text style={s.infoText}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  // Map Canvas
  mapCanvas: {
    height: MAP_HEIGHT,
    backgroundColor: '#EBE0C9',
    overflow: 'hidden',
    position: 'relative',
  },
  miqatRing: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'rgba(139,46,46,0.7)',
    backgroundColor: 'rgba(139,46,46,0.05)',
  },
  miqatLabel: {
    position: 'absolute',
    left: '50%',
    top: '12%',
    marginLeft: -40,
    backgroundColor: 'rgba(245,241,232,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miqatLabelText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1,
    color: colors.primary,
  },
  haramRing: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: 130,
    height: 130,
    marginLeft: -65,
    marginTop: -65,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(74,124,58,0.55)',
    backgroundColor: 'rgba(74,124,58,0.09)',
  },
  kaabahWrap: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    marginLeft: -13,
    marginTop: -20,
    alignItems: 'center',
  },
  kaabah: {
    width: 26,
    height: 26,
    backgroundColor: colors.text,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabahGold: { width: 14, height: 3, backgroundColor: colors.gold, borderRadius: 1 },
  kaabahLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary, marginTop: 4 },

  monitorTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  legendSwatches: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 4 },
  legendSwatch: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  monitorLegend: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 2 },
  noLocBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.goldLight },
  noLocTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary },
  noLocNames: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  noLocHint: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, marginTop: 6 },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
  },
  markerPulse: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(11,93,71,0.3)',
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    marginLeft: 3,
    marginTop: 3,
  },

  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(245,241,232,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 9,
    paddingHorizontal: 11,
    gap: 5,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textSecondary },

  // Status cards
  statusWarn: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 15,
    backgroundColor: colors.danger,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusWarnTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  statusWarnSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  statusReady: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 15,
    backgroundColor: colors.green,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statusReadyTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  statusReadySub: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  statusApproach: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  settingsBtn: { alignSelf: 'flex-start', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  settingsBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  statusApproachTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
  statusApproachSub: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.textMuted, marginTop: 2 },

  // Distance
  distCard: {
    margin: 16,
    marginTop: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  distRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  distLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  distValue: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: 999, marginTop: 12, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 999 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted },
  nearestInfo: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.textMuted,
    marginTop: 14,
    textAlign: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: 8,
    padding: 7,
  },

  // Ihram button
  ihramBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ihramBtnActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ihramBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary },
  ihramBtnTextActive: { color: colors.primary },

  // Info
  infoTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.text,
    marginTop: 22,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  infoCard: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 13 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textSecondary, lineHeight: 19 },
});
