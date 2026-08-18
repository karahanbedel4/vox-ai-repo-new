import { LocalNotifications } from '@capacitor/local-notifications';

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display === 'granted') return true;
  } catch {
    // Web fallback
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
  }
  return false;
};

export const scheduleDailyReminder = async (title: string, body: string, hour = 9, minute = 0) => {
  try {
    const hasPerm = await requestNotificationPermission();
    if (!hasPerm) return false;

    // Schedule local notification on Capacitor native
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: 1001,
          schedule: {
            on: {
              hour,
              minute
            },
            repeats: true
          },
          actionTypeId: 'OPEN_APP',
          extra: null
        }
      ]
    });
    return true;
  } catch {
    // Web Notification fallback for single immediate / scheduled notification test
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon.png' });
      return true;
    }
  }
  return false;
};
