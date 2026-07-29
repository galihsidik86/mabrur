import { db } from '../db';

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
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[PUSH] Gagal mengirim push notification:', err);
  }
}

export async function notifyGroupMuthawwif(
  groupId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const members = await db('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .where({
      'group_members.group_id': groupId,
      'group_members.role_in_group': 'muthawwif',
      'group_members.is_active': true,
    })
    .whereNotNull('users.push_token')
    .select('users.push_token');

  const tokens = members.map((m: any) => m.push_token);
  await sendPush(tokens, title, body, data, 'sos');
}

export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  await db('users').where('id', userId).update({ push_token: token });
}
