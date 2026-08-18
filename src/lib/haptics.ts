import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export { Haptics, ImpactStyle, NotificationType };

export const triggerHapticImpact = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    const impactMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: impactMap[style] });
  } catch {
    // Web fallback using Vibration API
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      const durationMap = { light: 10, medium: 25, heavy: 50 };
      try {
        navigator.vibrate(durationMap[style]);
      } catch {
        // ignore fallback errors
      }
    }
  }
};

export const triggerHapticNotification = async (type: 'success' | 'warning' | 'error' = 'success') => {
  try {
    const notificationMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: notificationMap[type] });
  } catch {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      const patternMap = {
        success: [15, 30, 15],
        warning: [30, 50, 30],
        error: [50, 100, 50, 100],
      };
      try {
        navigator.vibrate(patternMap[type]);
      } catch {
        // ignore fallback errors
      }
    }
  }
};
