// Token warna & radius panel admin. Satu-satunya tempat literal hex warna UI.
// Arah: DESIGN.md. Zamrud = merek; maroon = aksen jarang (miqat), tak pernah di/samping zamrud;
// zaitun = khusus status; emas = aksen, bukan warna teks (teks emas pakai goldText).
export const C = {
  primary: '#0B5D47',
  primaryDark: '#084536',
  primaryLight: '#D5E7DF',
  onPrimary: '#F5F1E8',

  accent: '#8B2E2E', // maroon — zona miqat saja

  status: '#4A7C3A', // zaitun — penanda status saja
  statusLight: '#DCEBD3',
  statusText: '#2F5A22',

  gold: '#D4A437',
  goldLight: '#FAEFC9',
  goldText: '#806316',
  goldOnPrimary: '#F5D98A', // huruf logo di atas zamrud

  danger: '#C44536',

  bg: '#F5F1E8',
  card: '#FFFFFF',
  surface: '#EFE7D9',
  tableHeader: '#FAFAF6',
  border: '#ECE5D8',
  borderLight: '#F0E9DC',

  text: '#1F1B16',
  textSecondary: '#5C3A1E',
  muted: '#7A5C3E',
  faint: '#9A7B5C', // ikon/garis/placeholder saja, bukan teks

  sidebar: '#1F1B16',
  sidebarText: '#F5F1E8',
  sidebarMuted: '#B89A7A',
  sidebarActiveText: '#FFFFFF',
  sidebarActiveBg: 'rgba(11,93,71,0.3)',
  sidebarBorder: 'rgba(255,255,255,0.15)',
} as const;

export const R = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;
