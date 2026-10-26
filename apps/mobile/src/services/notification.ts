import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { translate } from './i18n';

// Saat layar chat sedang terbuka, notifikasi chat tidak perlu muncul (pesan sudah terlihat).
let chatScreenOpen = false;
export function setChatScreenOpen(open: boolean): void {
  chatScreenOpen = open;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = !(chatScreenOpen && notification.request.content.data?.type === 'chat');
    return {
      shouldShowAlert: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
      shouldShowBanner: show,
      shouldShowList: show,
    };
  },
});

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: translate('content.channel_default'),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('sos', {
    name: translate('content.channel_sos'),
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    enableVibrate: true,
  });
  // Kanal terpisah dari SOS agar prioritasnya bisa diatur sendiri oleh pengguna.
  // Server mengirim push chat dengan channelId 'chat' — tanpa kanal ini Android 8+ tidak menampilkannya.
  await Notifications.setNotificationChannelAsync('chat', {
    name: translate('content.channel_chat'),
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync('geofence', {
    name: translate('content.channel_geofence'),
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
  });
}

export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[NOTIF] Push token hanya tersedia di device fisik');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (err) {
    console.warn('[NOTIF] Gagal mendapat push token:', err);
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  channelId = 'geofence',
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null,
  });
}
