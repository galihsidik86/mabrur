import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../src/theme';
import { api } from '../../src/services/api';
import {
  saveMiqatZones,
  getMiqatZones,
  saveIhramLocal,
  getIhramLocal,
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

const MAP_HEIGHT = 300;
const screenW = Dimensions.get('window').width;

export default function PetaScreen() {
  const [zones, setZones] = useState<MiqatZone[]>([]);
  const [nearest, setNearest] = useState<NearestResult | null>(null);
  const [isIhram, setIsIhram] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const watchRef = useRef<{ remove: () => void } | null>(null);

  const distance = nearest?.distance ?? 12000;
  const warn = distance <= 3000 && !isIhram;
  const ready = isIhram;
  const approach = !warn && !isIhram;
  const progress = Math.max(0, Math.min(1, 1 - distance / 12000));

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
    try {
      const remote = await api.getIhramStatus();
      setIsIhram(remote.is_ihram);
    } catch {}
  }, []);

  const startTracking = useCallback(async (z: MiqatZone[]) => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert('Izin Lokasi', 'Mabrur memerlukan akses lokasi untuk fitur geofence miqat.');
      return;
    }

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
      const n = findNearest(lat, lng, z);
      setNearest(n);
      if (n) saveIhramLocal({ is_ihram: isIhram, distance_meters: n.distance, nearest_miqat: n.zone.name });
      api.sendLocation(lat, lng, acc ?? undefined).catch(() => {});
    });
  }, [isIhram]);

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
    await saveIhramLocal({ is_ihram: next, distance_meters: distance, nearest_miqat: nearest?.zone.name });
    try { await api.toggleIhram(next, 'umrah'); } catch {}
  };

  // Marker position on stylized map
  const angle = (-58 * Math.PI) / 180;
  const rOuter = 120, rRing = 75;
  const r = rOuter - progress * (rOuter - rRing);
  const mx = 50 + (r * Math.cos(angle)) / 3;
  const my = 44 - (r * Math.sin(angle)) / 3;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Stylized Map */}
        <View style={s.mapCanvas}>
          {/* Miqat ring */}
          <View style={s.miqatRing} />
          <View style={s.miqatLabel}>
            <Text style={s.miqatLabelText}>BATAS MIQAT</Text>
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
              <View style={[s.legendBox, { borderColor: colors.primary, borderWidth: 2, backgroundColor: 'rgba(139,46,46,0.1)' }]} />
              <Text style={s.legendText}>Batas miqat</Text>
            </View>
            <View style={s.legendRow}>
              <View style={[s.legendBox, { borderColor: colors.green, borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'rgba(74,124,58,0.12)' }]} />
              <Text style={s.legendText}>Tanah Haram</Text>
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
              <Text style={s.statusWarnTitle}>Pakai ihram sekarang</Text>
              <Text style={s.statusWarnSub}>Batas miqat tinggal {formatDistance(distance)} lagi</Text>
            </View>
          </View>
        )}
        {ready && (
          <View style={s.statusReady}>
            <View style={[s.statusIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Ionicons name="checkmark" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusReadyTitle}>Kamu sudah berihram</Text>
              <Text style={s.statusReadySub}>Niat umrah sudah dilafalkan</Text>
            </View>
          </View>
        )}
        {approach && (
          <View style={s.statusApproach}>
            <View style={[s.statusIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="location" size={23} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusApproachTitle}>Menuju miqat</Text>
              <Text style={s.statusApproachSub}>Belum berihram · masih aman</Text>
            </View>
          </View>
        )}

        {/* Distance + Progress */}
        <View style={s.distCard}>
          <View style={s.distRow}>
            <Text style={s.distLabel}>Jarak ke garis miqat</Text>
            <Text style={s.distValue}>{formatDistance(distance)}</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressBar, {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: warn ? colors.danger : colors.green,
            }]} />
          </View>
          <View style={s.progressLabels}>
            <Text style={s.progressLabel}>Miqat</Text>
            <Text style={s.progressLabel}>Perjalanan menuju batas</Text>
          </View>
          {nearest && (
            <Text style={s.nearestInfo}>
              Miqat terdekat: {nearest.zone.name}
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
            {isIhram ? 'Batalkan status ihram' : 'Saya sudah berihram & berniat'}
          </Text>
        </TouchableOpacity>

        {/* Info */}
        <Text style={s.infoTitle}>Batas & larangan Tanah Haram</Text>
        <View style={s.infoCard}>
          {[
            'Di dalam Tanah Haram dilarang berburu & membunuh binatang liar.',
            'Dilarang menebang pohon atau mencabut tanaman yang tumbuh sendiri.',
            'Selama ihram: tidak memakai wangi-wangian, memotong rambut/kuku, atau menikah.',
          ].map((text, i) => (
            <View key={i} style={[s.infoRow, i > 0 && s.infoRowBorder]}>
              <Ionicons name="checkmark" size={18} color={colors.green} style={{ marginTop: 1 }} />
              <Text style={s.infoText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },

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
  kaabahGold: { width: 14, height: 3, backgroundColor: '#D4A437', borderRadius: 1 },
  kaabahLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary, marginTop: 4 },

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
    backgroundColor: 'rgba(139,46,46,0.3)',
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
    borderColor: '#E5DDD0',
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
  progressLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textFaint },
  nearestInfo: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#A5654E',
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
    borderColor: '#E5DDD0',
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
