import * as Notifications from 'expo-notifications';
import { getGroups, getSchedules, type Schedule } from './db';
import { translate } from './i18n';

export async function scheduleUpcomingNotifications(): Promise<void> {
  try {
    // Cancel existing scheduled
    await Notifications.cancelAllScheduledNotificationsAsync();

    const groups = await getGroups();
    if (groups.length === 0) return;

    const schedules = await getSchedules(groups[0].id);
    const now = Date.now();

    for (const s of schedules) {
      if (s.status === 'done') continue;

      const startTime = new Date(s.start_time).getTime();
      const reminderTime = startTime - 30 * 60 * 1000; // 30 menit sebelum

      if (reminderTime > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: translate('content.notif_reminder_title'),
            body: translate('content.notif_reminder_body', {
              title: s.title,
              location: s.location_name ? ' · ' + s.location_name : '',
            }),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(reminderTime) },
        });
      }
    }
  } catch (e) {
    console.warn('[SCHED-NOTIF] Error:', e);
  }
}
