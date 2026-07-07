import { create } from 'zustand';

const light = {
  primary: '#8B2E2E', primaryDark: '#6E2424', primaryLight: '#F3D9CD',
  green: '#4A7C3A', greenLight: '#DCEBD3', greenDark: '#3A6330',
  gold: '#D4A437', goldLight: '#FAEFC9',
  danger: '#C44536', dangerDark: '#9E2E22',
  bg: '#F5F1E8', card: '#FFFFFF', border: '#ECE5D8', borderLight: '#F0E9DC',
  surface: '#EFE7D9', surfaceWarm: '#FBF2EE',
  text: '#1F1B16', textSecondary: '#5C3A1E', textMuted: '#8C6B4A',
  textFaint: '#B89A7A', textOnPrimary: '#F5F1E8',
};

const dark = {
  ...light,
  bg: '#1A1612', card: '#2A2520', border: '#3A3530', borderLight: '#3A3530',
  surface: '#2A2520', surfaceWarm: '#332A22',
  text: '#F5F1E8', textSecondary: '#D4C4B0', textMuted: '#A09080',
  textFaint: '#706050',
};

interface ThemeState {
  isDark: boolean;
  colors: typeof light;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  isDark: false,
  colors: light,
  toggle: () => set((s) => ({ isDark: !s.isDark, colors: s.isDark ? light : dark })),
  setDark: (v) => set({ isDark: v, colors: v ? dark : light }),
}));
