import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../src/theme';
import { api } from '../src/services/api';
import { getPosition } from '../src/services/location';
import { getGroups, getGroupMembers } from '../src/services/db';
import { useI18n, type TranslationKey, type TFunction } from '../src/services/i18n';
import { id } from '../src/i18n/locales/id';

// Label kategori/status SOS dari server; nilai baru yang belum diterjemahkan tampil apa adanya.
function serverLabel(t: TFunction, prefix: 'sos.cat' | 'sos.status', value: string): string {
  const key = `${prefix}.${value}`;
  return key in id ? t(key as TranslationKey) : value;
}

// Nomor darurat yang ditampilkan; verifikasi nomor resmi Arab Saudi menyusul di Permintaan 6.
const EMERGENCY_NUMBER = '911';

type Category = 'medis' | 'tersesat' | 'kehilangan';

interface Profile {
  name: string;
  blood_type: string | null;
  passport_no: string | null;
  medical_notes: string | null;
}

export default function SosScreen() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const lang = useI18n((st) => st.lang);
  const [category, setCategory] = useState<Category>('medis');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sosId, setSosId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kloter, setKloter] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [muthawwifPhone, setMuthawwifPhone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProfile();
        setProfile(p);
      } catch {}
      const groups = await getGroups();
      if (groups.length > 0) {
        setKloter(groups[0].kloter_code);
        // Kontak muthawwif untuk tombol telepon darurat (lokal dulu, lalu API)
        try {
          let members: Array<{ phone?: string | null; role_in_group: string }> =
            await getGroupMembers(groups[0].id);
          if (members.length === 0) {
            try { members = await api.getGroupMembers(groups[0].id); } catch {}
          }
          const mt = members.find((m) => m.role_in_group === 'muthawwif' && m.phone);
          if (mt?.phone) setMuthawwifPhone(mt.phone);
        } catch {}
      }

      // Check existing active SOS
      try {
        const active = await api.getActiveSos();
        if (active) { setSent(true); setSosId(active.id); }
      } catch {}
      try { setHistory(await api.getSosHistory()); } catch {}
    })();
  }, []);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const pos = await getPosition();
      const sos = await api.sendSos(category, pos?.lat, pos?.lng);
      setSosId(sos.id);
      // Upload photo if taken
      if (photo) {
        try {
          const { url } = await api.uploadPhoto(photo);
          await api.setSosPhoto(sos.id, url);
        } catch {}
      }
      setSent(true);
    } catch (err: any) {
      Alert.alert(t('sos.err.title'), err.message || t('sos.err.send'));
    } finally {
      setSending(false);
    }
  }, [category, photo, t]);

  const handleCancel = useCallback(async () => {
    if (!sosId) return;
    try {
      await api.cancelSos(sosId);
      setSent(false);
      setSosId(null);
    } catch (err: any) {
      Alert.alert(t('sos.err.title'), err.message || t('sos.err.cancel'));
    }
  }, [sosId, t]);

  const categories: Array<{ id: Category; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { id: 'medis', label: t('sos.cat.medis'), icon: 'heart-outline' },
    { id: 'tersesat', label: t('sos.cat.tersesat'), icon: 'location-outline' },
    { id: 'kehilangan', label: t('sos.cat.kehilangan'), icon: 'search-outline' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerLabel}>{t('sos.header_label')}</Text>
            <Text style={s.headerTitle}>{t('sos.title')}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {sent ? (
          /* ===== SENT STATE ===== */
          <View style={s.sentCard}>
            <View style={s.sentIcon}>
              <Ionicons name="checkmark" size={34} color="#fff" />
            </View>
            <Text style={s.sentTitle}>{t('sos.sent_title')}</Text>
            <Text style={s.sentSub}>{t('sos.sent_sub')}</Text>
            <View style={s.locBadge}>
              <View style={s.locDot} />
              <Text style={s.locText}>{t('sos.sharing')}</Text>
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
              <Text style={s.cancelBtnText}>{t('sos.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ===== IDLE STATE ===== */
          <>
            <Text style={s.instruction}>{t('sos.instruction')}</Text>

            {/* Categories */}
            <View style={s.catRow}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catBtn, category === c.id && s.catBtnActive]}
                  onPress={() => setCategory(c.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={c.icon} size={22} color="#fff" />
                  <Text style={s.catLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Photo */}
            <TouchableOpacity
              style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
              onPress={async () => {
                const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
                if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
              }}
            >
              <Ionicons name={photo ? 'checkmark-circle' : 'camera-outline'} size={20} color="#fff" />
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' }}>
                {photo ? t('sos.photo_attached') : t('sos.photo_optional')}
              </Text>
            </TouchableOpacity>

            {/* SOS Button */}
            <TouchableOpacity
              style={s.sosBtn}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator color={colors.dangerDark} size="large" />
              ) : (
                <>
                  <Ionicons name="radio-outline" size={30} color={colors.dangerDark} />
                  <Text style={s.sosBtnText}>{t('sos.send')}</Text>
                  <Text style={s.sosBtnSub}>{t('sos.send_sub')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Quick contacts */}
            <View style={s.contactRow}>
              <TouchableOpacity
                style={[s.contactBtn, !muthawwifPhone && { opacity: 0.5 }]}
                onPress={() => {
                  if (!muthawwifPhone) { Alert.alert(t('sos.err.no_number_title'), t('sos.err.no_number')); return; }
                  Linking.openURL(`tel:${muthawwifPhone}`).catch(() => Alert.alert(t('sos.err.title'), t('sos.err.phone')));
                }}
              >
                <Ionicons name="call-outline" size={16} color="#fff" />
                <Text style={s.contactText}>{t('sos.contact_muthawwif')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.contactBtn}
                onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => Alert.alert(t('sos.err.title'), t('sos.err.phone')))}
              >
                <Ionicons name="flash-outline" size={16} color="#fff" />
                <Text style={s.contactText}>{t('sos.emergency', { number: EMERGENCY_NUMBER })}</Text>
              </TouchableOpacity>
            </View>

            {/* History */}
            {history.length > 0 && (
              <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: 'rgba(255,255,255,0.7)' }}>
                  {showHistory ? t('sos.hide') : t('sos.history', { count: history.length })} {showHistory ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
            )}
            {showHistory && history.map((h: any) => (
              <View key={h.id} style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' }}>{serverLabel(t, 'sos.cat', h.category)}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255,255,255,0.6)' }}>{new Date(h.created_at).toLocaleDateString(lang)}</Text>
                <View style={{ backgroundColor: h.status === 'resolved' ? 'rgba(74,124,58,0.3)' : 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>{serverLabel(t, 'sos.status', h.status)}</Text>
                </View>
              </View>
            ))}

            {/* Medical ID */}
            {profile && (
              <View style={s.medCard}>
                <View style={s.medHeader}>
                  <Ionicons name="heart" size={18} color={colors.danger} />
                  <Text style={s.medHeaderText}>{t('sos.med_card')}</Text>
                </View>
                <View style={s.medDivider} />
                <View style={s.medGrid}>
                  <View style={s.medItem}>
                    <Text style={s.medLabel}>{t('sos.med.name')}</Text>
                    <Text style={s.medValue}>{profile.name}</Text>
                  </View>
                  <View style={s.medItem}>
                    <Text style={s.medLabel}>{t('sos.med.kloter')}</Text>
                    <Text style={s.medValue}>{kloter || '-'}</Text>
                  </View>
                  <View style={s.medItem}>
                    <Text style={s.medLabel}>{t('sos.med.blood')}</Text>
                    <Text style={[s.medValue, { color: colors.danger }]}>{profile.blood_type || '-'}</Text>
                  </View>
                  <View style={s.medItem}>
                    <Text style={s.medLabel}>{t('sos.med.passport')}</Text>
                    <Text style={s.medValue}>{profile.passport_no || '-'}</Text>
                  </View>
                  {profile.medical_notes && (
                    <View style={[s.medItem, { width: '100%' }]}>
                      <Text style={s.medLabel}>{t('sos.med.history')}</Text>
                      <Text style={[s.medValue, { fontFamily: 'PlusJakartaSans_600SemiBold' }]}>{profile.medical_notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#7A1F1F' },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLabel: {
    fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.6, color: 'rgba(255,240,235,0.7)',
  },
  headerTitle: {
    fontSize: 24, fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#fff', marginTop: 2,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  instruction: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,240,235,0.85)', marginTop: 14, lineHeight: 20,
  },

  catRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  catBtn: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 15, alignItems: 'center',
  },
  catBtnActive: {
    borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.16)',
  },
  catLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', marginTop: 8 },

  sosBtn: {
    marginTop: 20, backgroundColor: '#fff', borderRadius: 16,
    padding: 22, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 30, elevation: 10,
  },
  sosBtnText: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: colors.dangerDark },
  sosBtnSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B4685C' },

  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12,
    padding: 14,
  },
  contactText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },

  medCard: {
    marginTop: 20, backgroundColor: colors.bg, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medHeaderText: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textSecondary },
  medDivider: { height: 1, backgroundColor: '#E5DDD0', marginVertical: 12 },
  medGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  medItem: { width: '46%' },
  medLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: colors.textMuted, letterSpacing: 0.6 },
  medValue: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 2 },

  // Sent state
  sentCard: {
    marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, padding: 20, alignItems: 'center',
  },
  sentIcon: {
    width: 64, height: 64, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  sentTitle: { fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginTop: 14 },
  sentSub: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 21, textAlign: 'center',
  },
  locBadge: {
    marginTop: 14, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 11,
    padding: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch',
  },
  locDot: {
    width: 9, height: 9, borderRadius: 999, backgroundColor: '#7BE28A',
    shadowColor: '#7BE28A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4,
  },
  locText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
  cancelBtn: {
    marginTop: 16, alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 11, padding: 12, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
});
