type Role = 'admin' | 'muthawwif' | 'jamaah';

// Perekam GPS riset (validasi lapangan naskah) hanya untuk tim: muthawwif, admin,
// atau build pengembangan. Jamaah tidak melihat alat riset maupun instruksi developernya.
export function canUseResearchTools(role: Role | undefined): boolean {
  if (__DEV__) return true;
  return role === 'muthawwif' || role === 'admin';
}
