import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { useI18n, type TranslationKey } from '../../src/services/i18n';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: Array<{
  name: string;
  titleKey: TranslationKey;
  icon: IoniconsName;
  iconActive: IoniconsName;
}> = [
  { name: 'index', titleKey: 'nav.home', icon: 'home-outline', iconActive: 'home' },
  { name: 'peta', titleKey: 'nav.map', icon: 'map-outline', iconActive: 'map' },
  { name: 'ibadah', titleKey: 'nav.guide', icon: 'book-outline', iconActive: 'book' },
  { name: 'doa', titleKey: 'nav.doa', icon: 'reader-outline', iconActive: 'reader' },
  { name: 'jadwal', titleKey: 'nav.schedule', icon: 'calendar-outline', iconActive: 'calendar' },
];

function SosFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[s.fab, { bottom: 70 + insets.bottom + 16 }]}
      onPress={() => router.push('/sos')}
      activeOpacity={0.8}
    >
      <Ionicons name="radio-outline" size={22} color="#fff" />
      <Text style={s.fabText}>SOS</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const t = useI18n((st) => st.t);
  const tabBarHeight = 56 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingBottom: insets.bottom + 4,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontFamily: 'PlusJakartaSans_600SemiBold',
            fontSize: 11,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.titleKey),
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? tab.iconActive : tab.icon}
                  size={23}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>
      <SosFab />
    </View>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 50,
  },
  fabText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
