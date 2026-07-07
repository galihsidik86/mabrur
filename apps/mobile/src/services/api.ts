import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl;
  if (configured && !configured.includes('localhost')) return configured;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const BASE_URL = getBaseUrl();

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    await SecureStore.setItemAsync('access_token', json.data.access_token);
    await SecureStore.setItemAsync('refresh_token', json.data.refresh_token);
    return json.data.access_token;
  } catch {
    return null;
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    const newToken = await tryRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Permintaan gagal');
  return json.data;
}

export const api = {
  login: async (phone: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Login gagal');
    return json.data as {
      access_token: string;
      refresh_token: string;
      user: { id: string; name: string; phone: string; role: string };
    };
  },

  logout: async (token: string, refreshToken: string) => {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {}
  },

  getGroups: () => request<any[]>('/groups'),

  getGroupMembers: (groupId: string) =>
    request<any[]>(`/groups/${groupId}/members`),

  getGuides: (type?: string) =>
    request<any[]>(`/ibadah-guides${type ? `?type=${type}` : ''}`),

  getDuas: () => request<any[]>('/duas'),

  getSchedules: (groupId: string) =>
    request<any[]>(`/groups/${groupId}/schedules`),

  getMiqatZones: () => request<any[]>('/miqat-zones'),

  getIhramStatus: () => request<any>('/ihram/status'),

  toggleIhram: (isIhram: boolean, niatType?: string) =>
    request<any>('/ihram/toggle', {
      method: 'POST',
      body: JSON.stringify({ is_ihram: isIhram, niat_type: niatType }),
    }),

  sendLocation: (lat: number, lng: number, accuracy?: number) =>
    request<any>('/locations', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, accuracy }),
    }),

  getProfile: () => request<any>('/auth/me'),

  sendSos: (category: string, lat?: number, lng?: number) =>
    request<any>('/sos', {
      method: 'POST',
      body: JSON.stringify({ category, lat, lng }),
    }),

  getActiveSos: () => request<any>('/sos/active'),

  cancelSos: (id: string) =>
    request<any>(`/sos/${id}`, { method: 'DELETE' }),

  getGroupSos: (groupId: string) =>
    request<any[]>(`/groups/${groupId}/sos`),

  registerPushToken: (token: string) =>
    request<any>('/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Profile
  updateProfile: (data: Record<string, any>) =>
    request<any>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  // SOS History
  getSosHistory: () => request<any[]>('/sos/history'),

  // Ziarah
  getZiarah: () => request<any[]>('/ziarah'),

  // Chat
  getMessages: (groupId: string, before?: string) =>
    request<any[]>(`/groups/${groupId}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (groupId: string, text: string) =>
    request<any>(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Stats
  getStats: () => request<any>('/stats/me'),

  // Onboarding
  markOnboarded: () => request<any>('/onboarded', { method: 'POST' }),

  // SOS resolve (muthawwif)
  resolveSos: (id: string) =>
    request<any>(`/sos/${id}/resolve`, { method: 'PATCH' }),

  // Schedules CRUD (muthawwif)
  createSchedule: (groupId: string, data: any) =>
    request<any>(`/groups/${groupId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: any) =>
    request<any>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Enhancements
  uploadPhoto: (base64: string) =>
    request<{ url: string }>('/upload/photo', { method: 'POST', body: JSON.stringify({ base64 }) }),
  setSosPhoto: (sosId: string, photoUrl: string) =>
    request<any>(`/sos/${sosId}/photo`, { method: 'PATCH', body: JSON.stringify({ photo_url: photoUrl }) }),
  submitRating: (rating: number, feedback?: string) =>
    request<any>('/ratings', { method: 'POST', body: JSON.stringify({ rating, feedback }) }),
  setTheme: (theme: string) =>
    request<any>('/theme', { method: 'PATCH', body: JSON.stringify({ theme }) }),

  getMemberStatuses: (groupId: string) =>
    request<{
      stats: { total: number; safe: number; attention: number };
      members: Array<{
        id: string; name: string; phone: string; role_in_group: string;
        location: { lat: number; lng: number; updated_at: string } | null;
        ihram: { is_ihram: boolean; niat_type: string | null };
        nearest_miqat: { name: string; distance: number } | null;
        status: 'safe' | 'attention';
      }>;
    }>(`/groups/${groupId}/members/status`),
};
