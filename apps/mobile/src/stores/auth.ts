import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import {
  saveProfile,
  getProfile,
  clearAll as clearDB,
} from '../services/db';

interface User {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'muthawwif' | 'jamaah';
  must_change_password?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearMustChangePassword: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone: string, password: string) => {
    const data = await api.login(phone, password);

    await SecureStore.setItemAsync('access_token', data.access_token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);

    const user = data.user as User;
    await saveProfile(user);
    // Flag wajib-ganti-password disimpan terpisah (skema tabel profile tidak berubah)
    await SecureStore.setItemAsync(
      'must_change_pw',
      user.must_change_password ? '1' : '0',
    );

    set({
      user,
      accessToken: data.access_token,
      isAuthenticated: true,
    });
  },

  // Dipanggil setelah user sukses mengganti password wajib
  clearMustChangePassword: async () => {
    await SecureStore.setItemAsync('must_change_pw', '0');
    const { user } = get();
    if (user) set({ user: { ...user, must_change_password: false } });
  },

  logout: async () => {
    const { accessToken } = get();
    const refreshToken = await SecureStore.getItemAsync('refresh_token');

    if (accessToken && refreshToken) {
      await api.logout(accessToken, refreshToken);
    }

    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('must_change_pw');
    await clearDB();

    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('access_token');
      if (!accessToken) {
        set({ isLoading: false });
        return;
      }

      // Load user from local DB (offline-first)
      const profile = await getProfile();
      if (profile) {
        const mustChange =
          (await SecureStore.getItemAsync('must_change_pw')) === '1';
        set({
          user: { ...(profile as User), must_change_password: mustChange },
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      // No local profile but has token — clear invalid session
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
