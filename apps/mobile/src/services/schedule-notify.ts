import * as Notifications from 'expo-notifications';
import { getGroups, getSchedules, type Schedule } from './db';

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
            title: 'Agenda segera dimulai',
            body: `${s.title}${s.location_name ? ' · ' + s.location_name : ''} dalam 30 menit`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(reminderTime) },
        });
      }
    }
  } catch (e) {
    console.warn('[SCHED-NOTIF] Error:', e);
  }
}
