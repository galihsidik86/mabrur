export const colors = {
  primary: '#0B5D47',
  primaryDark: '#084536',
  primaryLight: '#D5E7DF',

  accent: '#8B2E2E',
  accentLight: '#F3D9CD',

  green: '#4A7C3A',
  greenLight: '#DCEBD3',
  greenDark: '#3A6330',

  gold: '#D4A437',
  goldLight: '#FAEFC9',
  // Emas untuk teks di latar terang; gold sendiri hanya aksen (2,29:1 dengan putih).
  goldText: '#806316',
  // Emas muda di atas zamrud (badge/angka di hero beranda).
  goldOnPrimary: '#F5D98A',

  danger: '#C44536',
  dangerDark: '#9E2E22',

  bg: '#F5F1E8',
  bgOuter: '#E4DAC7',
  card: '#FFFFFF',
  border: '#ECE5D8',
  borderLight: '#F0E9DC',
  surface: '#EFE7D9',
  surfaceWarm: '#FBF6EA',

  text: '#1F1B16',
  textSecondary: '#5C3A1E',
  textMuted: '#7A5C3E',
  // Hanya ikon, garis, placeholder (≥3:1). Teks isi pakai textMuted (≥4,5:1).
  textFaint: '#9A7B5C',
  textOnPrimary: '#F5F1E8',
  textOnDanger: '#FFF0EB',
} as const;

export const radius = {
  sm: 9,
  md: 13,
  lg: 16,
  xl: 18,
} as const;
