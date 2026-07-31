import { create } from 'zustand';
import { api } from '../services/api';

// State global Suara Rombongan. Koneksi LiveKit dipasang di root (VoiceHost)
// sehingga tetap hidup saat pengguna berpindah ke layar Tawaf/Sa'i (auto-GPS
// tetap jalan sambil mendengar/menyiarkan doa).
type Role = 'speaker' | 'listener';

interface VoiceState {
  active: boolean;
  connecting: boolean;
  url: string | null;
  token: string | null;
  role: Role | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export const useVoice = create<VoiceState>((set, get) => ({
  active: false,
  connecting: false,
  url: null,
  token: null,
  role: null,
  error: null,
  start: async () => {
    if (get().active || get().connecting) return;
    set({ connecting: true, error: null });
    try {
      const d = await api.getVoiceToken();
      set({ active: true, url: d.url, token: d.token, role: d.role, connecting: false });
    } catch (e: any) {
      set({ error: e?.message || 'Gagal menyambung ke suara rombongan', connecting: false });
    }
  },
  stop: () => set({ active: false, url: null, token: null, role: null, error: null, connecting: false }),
}));
