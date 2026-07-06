import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: Array<{
  name: string;
  title: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
}> = [
  { name: 'index', title: 'Beranda', icon: 'home-outline', iconActive: 'home' },
  { name: 'peta', title: 'Peta', icon: 'map-outline', iconActive: 'map' },
  { name: 'ibadah', title: 'Ibadah', icon: 'book-outline', iconActive: 'book' },
  { name: 'doa', title: 'Doa', icon: 'reader-outline', iconActive: 'reader' },
  { name: 'jadwal', title: 'Jadwal', icon: 'calendar-outline', iconActive: 'calendar' },
];

function SosFab() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={s.fab}
      onPress={() => router.push('/sos')}
      activeOpacity={0.8}
    >
      <Ionicons name="radio-outline" size={22} color="#fff" />
      <Text style={s.fabText}>SOS</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderTopColor: colors.border,
            height: 70,
            paddingBottom: 8,
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
              title: tab.title,
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
    bottom: 82,
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
