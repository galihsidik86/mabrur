import { db } from '../db';
import { tokensByLang, type PushLang } from './push-messages';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
}

export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
): Promise<void> {
  // Push SOS: bunyikan (iOS senyap tanpa sound) + prioritas tinggi (FCM wake).
  const messages: PushMessage[] = tokens
    .filter(Boolean)
    .map((to) => ({ to, title, body, data, channelId, sound: 'default', priority: 'high' }));

  if (messages.length === 0) return;

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.error(`[PUSH] Expo menolak permintaan push: HTTP ${res.status}`);
  } catch (err) {
    console.error('[PUSH] Gagal mengirim push notification:', err);
  }
}

/** Push SOS ke muthawwif rombongan, masing-masing dalam bahasa pilihannya. */
export async function notifyGroupMuthawwif(
  groupId: string,
  build: (lang: PushLang) => { title: string; body: string },
  data?: Record<string, unknown>,
): Promise<void> {
  const members: Array<{ push_token: string; language: string | null }> = await db('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .where({
      'group_members.group_id': groupId,
      'group_members.role_in_group': 'muthawwif',
      'group_members.is_active': true,
    })
    .whereNotNull('users.push_token')
    .select('users.push_token', 'users.language');

  for (const [lang, tokens] of tokensByLang(members)) {
    const { title, body } = build(lang);
    await sendPush(tokens, title, body, data, 'sos');
  }
}

const CHAT_SNIPPET_MAX = 100;

export function chatSnippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= CHAT_SNIPPET_MAX ? flat : `${flat.slice(0, CHAT_SNIPPET_MAX - 1)}…`;
}

// Push chat ke semua anggota aktif rombongan kecuali pengirim. Tidak pernah
// melempar: kegagalan push tidak boleh menggagalkan pengiriman pesan.
export async function notifyGroupMessage(
  groupId: string,
  senderId: string,
  senderName: string,
  text: string,
): Promise<void> {
  try {
    const members: Array<{ user_id: string; push_token: string }> = await db('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .where({ 'group_members.group_id': groupId, 'group_members.is_active': true, 'users.is_active': true })
      .whereNotNull('users.push_token')
      .select('group_members.user_id', 'users.push_token');

    const tokens = [...new Set(members.filter((m) => m.user_id !== senderId).map((m) => m.push_token))];
    await sendPush(tokens, senderName, chatSnippet(text), { type: 'chat', groupId }, 'chat');
  } catch (err) {
    console.error('[PUSH] Gagal mengirim notifikasi chat:', err);
  }
}

export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  // Satu token = satu perangkat. Lepas dari akun lain lebih dulu agar push akun lama
  // (chat/SOS rombongannya) tidak nyasar ke HP yang kini dipakai orang lain.
  await db('users').where({ push_token: token }).whereNot('id', userId).update({ push_token: null });
  await db('users').where('id', userId).update({ push_token: token });
}
