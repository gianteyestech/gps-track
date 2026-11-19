import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { traccarApi } from './api';
import { Event, User } from '../types/traccar';

// Configure foreground notification behavior for mobile
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

type InAppBannerHandler = (alert: { title: string; body: string; deviceId: number }) => void;

class NotificationService {
  private pushToken: string | null = null;
  private bannerHandlers: Set<InAppBannerHandler> = new Set();

  public subscribeInAppBanner(handler: InAppBannerHandler) {
    this.bannerHandlers.add(handler);
    return () => {
      this.bannerHandlers.delete(handler);
    };
  }

  public async registerForPushNotifications(currentUser?: User | null): Promise<string | null> {
    // 1. Web Browser Notifications (Chrome / Edge / Firefox on Windows)
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (window.Notification.permission === 'default') {
            await window.Notification.requestPermission();
          }
        }
      } catch (err) {
        console.warn('Web notification permission error:', err);
      }
      return 'web-client';
    }

    // 2. Mobile Notifications (Android & iOS via expo-notifications)
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification permissions');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('gts_alerts', {
          name: 'GPS Track Critical Fleet Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#EF4444',
          sound: 'default',
        });
      }

      // Request Expo Push Token for Expo Push Relay Service
      try {
        const expoTokenData = await Notifications.getExpoPushTokenAsync();
        this.pushToken = expoTokenData.data;
        console.log('[GPS Track] Registered Expo Push Token:', this.pushToken);
      } catch (err) {
        console.warn('[GPS Track] Could not get Expo Push Token directly, falling back:', err);
        try {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          this.pushToken = deviceToken.data;
        } catch (e) {
          console.warn('[GPS Track] Device push token also failed:', e);
        }
      }

      if (this.pushToken && currentUser && currentUser.id) {
        await this.syncTokenWithTraccar(currentUser, this.pushToken);
      }

      return this.pushToken;
    } catch (error) {
      console.warn('Error registering for push notifications:', error);
      return null;
    }
  }

  public async syncTokenWithTraccar(user: User, token: string) {
    try {
      const existingTokens: string = user.attributes?.notificationTokens || '';
      const tokenList = existingTokens ? existingTokens.split(',') : [];

      if (!tokenList.includes(token)) {
        tokenList.push(token);
        const updatedAttributes = {
          ...(user.attributes || {}),
          notificationTokens: tokenList.join(','),
        };

        await fetch(`${traccarApi.getServerUrl()}/api/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            ...user,
            attributes: updatedAttributes,
          }),
        });
      }
    } catch (e) {
      console.warn('[Push] Could not sync push token with Traccar user:', e);
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  // Send an Expo Push Notification to any ExponentPushToken via Expo's HTTP API
  public async sendExpoPushNotification(
    targetToken: string,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetToken,
          title,
          body,
          sound: 'default',
          priority: 'high',
          channelId: 'gts_alerts',
          badge: 1,
          data: data || {},
        }),
      });

      const resJson = await response.json();
      return resJson?.data?.status === 'ok';
    } catch (e) {
      console.warn('[GPS Track] Failed to send Expo push:', e);
      return false;
    }
  }

  // Play audio alert chime
  private playAlertAudio() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.35);
          gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.35);
        }
      }
    } catch {}
  }

  // Trigger push alert banner for incoming Traccar events
  public async notifyEvent(event: Event, deviceName: string) {
    let title = 'Vehicle Alert';
    let body = `${deviceName}: An event was reported`;

    switch (event.type) {
      case 'geofenceExit':
        title = '🚨 Geofence Exited';
        body = `${deviceName} has exited the designated geofence!`;
        break;
      case 'geofenceEnter':
        title = '📍 Geofence Entered';
        body = `${deviceName} has entered the designated geofence.`;
        break;
      case 'deviceOverspeed':
        title = '⚡ Overspeed Warning';
        body = `${deviceName} exceeded the speed threshold!`;
        break;
      case 'alarm':
        title = '🛑 SOS / Shock Alarm';
        body = `Urgent alert triggered by ${deviceName}!`;
        break;
      case 'ignitionOn':
        title = '🔑 Ignition Turned ON';
        body = `${deviceName} engine was started.`;
        break;
      case 'ignitionOff':
        title = '🛑 Ignition Turned OFF';
        body = `${deviceName} engine was shut down.`;
        break;
      case 'deviceOnline':
        title = '📶 Device Online';
        body = `${deviceName} reconnected to GPS Track.`;
        break;
      case 'deviceOffline':
        title = '⚠️ Device Offline';
        body = `${deviceName} lost GPS / GSM connection.`;
        break;
      default:
        title = `🔔 ${event.type.replace(/([A-Z])/g, ' $1').trim()}`;
        body = `Event occurred for ${deviceName}`;
        break;
    }

    // 1. Play alert chime
    this.playAlertAudio();

    // 2. Trigger in-app drop-down toast banner
    this.bannerHandlers.forEach((handler) => {
      try {
        handler({ title, body, deviceId: event.deviceId });
      } catch {}
    });

    // 3. Web Notification (Chrome / Edge / Windows Desktop banner)
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (window.Notification.permission === 'granted') {
            new window.Notification(title, {
              body,
              icon: '/assets/icon.png',
            });
          } else if (window.Notification.permission !== 'denied') {
            window.Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                new window.Notification(title, { body });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Web notification display error:', err);
      }
    } else {
      // 4. Mobile Notification (iOS / Android)
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { deviceId: event.deviceId, eventId: event.id },
            sound: 'default',
          },
          trigger: null,
        });
      } catch (err) {
        console.warn('Mobile notification error:', err);
      }
    }
  }
}

export const notificationService = new NotificationService();
