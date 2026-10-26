// Logika murni penghitung chat belum dibaca (tanpa impor Expo — bisa dites dari vitest).

export interface ChatMessageStamp {
  user_id: string;
  created_at: string;
}

// Pesan dari orang lain yang lebih baru dari waktu terakhir dibaca.
// lastRead null = belum pernah membuka chat: semua pesan orang lain dihitung.
export function countUnread(messages: ChatMessageStamp[], myId: string, lastRead: string | null): number {
  const since = lastRead ? Date.parse(lastRead) : -Infinity;
  return messages.filter((m) => m.user_id !== myId && Date.parse(m.created_at) > since).length;
}

// Dipakai sebagai penanda "terakhir dibaca" — memakai jam server, bukan jam HP.
export function latestCreatedAt(messages: ChatMessageStamp[]): string | null {
  if (messages.length === 0) return null;
  return messages.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a)).created_at;
}
