import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { saveUserPushToken } from './firebase';
import { appStorage } from './storage';

export interface PushNotificationPayload {
  title?: string;
  body?: string;
  data?: any;
}

export type PushNotificationCallback = (notification: PushNotificationSchema) => void;
export type PushActionCallback = (action: ActionPerformed) => void;

/**
 * Initializes Push Notifications for native platforms (iOS / Android),
 * requests user permissions, registers with APNs / FCM, and binds listeners.
 */
export async function initPushNotifications(
  userId: string,
  onNotificationReceived?: PushNotificationCallback,
  onNotificationActionPerformed?: PushActionCallback
): Promise<(() => void) | null> {
  // Only execute on native iOS / Android devices
  if (!Capacitor.isNativePlatform()) {
    console.log('[PushNotifications] Web platform detected - skipping native Push Notifications init.');
    return null;
  }

  const listenerHandles: PluginListenerHandle[] = [];

  try {
    // 1. Check & Request Permissions
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted:', permStatus.receive);
      return null;
    }

    // 2. Add Registration Success Listener
    const regHandle = await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[PushNotifications] Device registered successfully. Token:', token.value);
      appStorage.setItem('vox_push_token', token.value);

      if (userId) {
        await saveUserPushToken(userId, token.value);
      }
    });
    listenerHandles.push(regHandle);

    // 3. Add Registration Error Listener
    const errHandle = await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[PushNotifications] Registration error:', error);
    });
    listenerHandles.push(errHandle);

    // 4. Foreground Notification Received Listener
    const receivedHandle = await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[PushNotifications] Foreground notification received:', notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );
    listenerHandles.push(receivedHandle);

    // 5. Notification Action / Click Performed Listener (Background / Killed state)
    const actionHandle = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('[PushNotifications] Notification action performed:', action);
        if (onNotificationActionPerformed) {
          onNotificationActionPerformed(action);
        }
      }
    );
    listenerHandles.push(actionHandle);

    // 6. Register device for push notifications with APNs / FCM
    await PushNotifications.register();
    console.log('[PushNotifications] PushNotifications.register() called successfully.');

  } catch (err) {
    console.error('[PushNotifications] Error setting up push notifications:', err);
  }

  // Return cleanup function to remove listeners
  return () => {
    listenerHandles.forEach((handle) => {
      handle.remove().catch((e) => console.warn('Error removing push notification listener handle:', e));
    });
  };
}
