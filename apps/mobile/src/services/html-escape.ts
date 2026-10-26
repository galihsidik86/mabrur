// Escape teks sebelum disisipkan ke HTML (mis. popup Leaflet di WebView peta).
// Nama jamaah bisa diubah sendiri lewat profil, jadi wajib dianggap tidak tepercaya.
const ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
