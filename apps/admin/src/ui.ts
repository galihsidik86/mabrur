// Gaya bersama halaman admin (formulir, tombol, tabel, chip, kartu).
import type { CSSProperties } from 'react';
import { C, R } from './theme';

export const card: CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 20 };
export const formBox: CSSProperties = { ...card, marginTop: 20 };
export const formTitle: CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 12, color: C.textSecondary };

export const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4 };
export const input: CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: 13, boxSizing: 'border-box',
};
export const errorText: CSSProperties = { color: C.danger, fontSize: 13, marginTop: 8 };

const btnBase: CSSProperties = { padding: '9px 20px', borderRadius: R.sm, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };
export const btnPrimary: CSSProperties = { ...btnBase, background: C.primary, color: C.onPrimary, border: 'none', fontWeight: 700 };
export const btnSecondary: CSSProperties = { ...btnBase, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, fontWeight: 600 };
/** Tombol teks dalam baris tabel/kartu. Untuk aksi merusak: `{ ...actionBtn, color: C.danger }`. */
export const actionBtn: CSSProperties = { background: 'none', border: 'none', color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' };

export const table: CSSProperties = {
  width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: R.lg, borderCollapse: 'collapse', overflow: 'hidden',
};
export const th: CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: C.muted,
  borderBottom: `1px solid ${C.border}`, background: C.tableHeader,
};
export const td: CSSProperties = { padding: '9px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.borderLight}` };

export const chip: CSSProperties = { padding: '3px 10px', borderRadius: R.pill, fontSize: 11, fontWeight: 700 };

/** Peran = kategori, bukan status: netral, muthawwif ditandai zamrud muda agar tetap terbedakan. */
export function roleChip(role: string): CSSProperties {
  if (role === 'muthawwif') return { ...chip, background: C.primaryLight, color: C.primaryDark };
  if (role === 'admin') return { ...chip, background: C.card, color: C.textSecondary, border: `1px solid ${C.border}` };
  return { ...chip, background: C.surface, color: C.textSecondary };
}
