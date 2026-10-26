// Nilai enum dari API → label yang dibaca admin. Jangan tampilkan nilai mentah ('jamaah') di UI.
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  muthawwif: 'Muthawwif',
  jamaah: 'Jamaah',
};

export const roleLabel = (role: string): string => ROLE_LABEL[role] ?? role;
