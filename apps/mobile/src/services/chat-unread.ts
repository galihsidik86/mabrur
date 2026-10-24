import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { getGroups, getMeta, setMeta } from './db';
import { useAuthStore } from '../stores/auth';
import { countUnread, latestCreatedAt } from './chat-unread-core';

const LAST_READ_KEY = 'chat_last_read';

interface ChatUnreadState {
  count: number;
  refresh: () => Promise<void>;
  markRead: (messages: Array<{ user_id: string; created_at: string }>) => Promise<void>;
}

async function applyCount(count: number): Promise<void> {
  useChatUnread.setState({ count });
  // Badge ikon aplikasi di launcher; tidak semua launcher Android mendukung.
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}

// Naik setiap markRead: hasil refresh yang mulai sebelum markRead dibuang agar
// tidak menimpa hitungan 0 dengan angka lama.
let readGeneration = 0;

// Asumsi: satu rombongan aktif per pengguna (sama dengan chat.tsx yang memakai groups[0]);
// hitungan dibatasi 50 pesan terakhir sesuai limit API — badge tampil "9+" di atas 9.
export const useChatUnread = create<ChatUnreadState>(() => ({
  count: 0,

  refresh: async () => {
    const myId = useAuthStore.getState().user?.id;
    if (!myId) return;
    const generation = readGeneration;
    try {
      const groups = await getGroups();
      if (groups.length === 0) return;
      const messages = await api.getMessages(groups[0].id);
      const count = countUnread(messages, myId, await getMeta(LAST_READ_KEY));
      if (generation === readGeneration) await applyCount(count);
    } catch {
      // Offline: pertahankan hitungan terakhir.
    }
  },

  markRead: async (messages) => {
    readGeneration++;
    const latest = latestCreatedAt(messages);
    if (latest) await setMeta(LAST_READ_KEY, latest);
    await applyCount(0);
  },
}));
