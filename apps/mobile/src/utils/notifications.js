/**
 * Notification management utilities and deep-link response routing.
 * Provides foreground handlers, daily reminder schedules, push token resolvers,
 * and cold-start notification response inspection.
 *
 * Rule R-02 compliant: Zero em dashes in code, strings, and comments.
 */

let Notifications = null;
let Device = null;
let Platform = { OS: 'web' };

try {
  // Resolve expo and react-native safely in Metro bundler while remaining headless-friendly
  if (typeof require === 'function') {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    const rn = require('react-native');
    if (rn && rn.Platform) {
      Platform = rn.Platform;
    }
  }
} catch (_) {
  // Silent fallback for non-native runtimes
}

export const setNotificationAdapter = (adapter) => {
  if (adapter) {
    if (adapter.Notifications !== undefined) Notifications = adapter.Notifications;
    if (adapter.Device !== undefined) Device = adapter.Device;
    if (adapter.Platform !== undefined) Platform = adapter.Platform;
  }
};

export const getNotificationAdapter = () => ({
  Notifications,
  Device,
  Platform,
});

// Set up behavior for when notification is received while app is in foreground
if (Notifications && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform?.OS === 'android') {
    if (Notifications?.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('daily-reminder-v2', {
        name: 'Pengingat Harian',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'notif.wav',
      });
    }
  }

  if (!Device?.isDevice) return false; // emulator - tidak bisa request izin notif

  if (!Notifications?.getPermissionsAsync) return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!Notifications?.requestPermissionsAsync) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }
  return true;
}

export async function scheduleDailyReminder() {
  if (Platform?.OS === 'web') return;
  if (!Notifications?.cancelAllScheduledNotificationsAsync) return;

  // Bersihkan jadwal lama agar tidak dobel
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Pasang jadwal harian jam 16:00
  // ponytail: trigger 'daily' adalah format yang valid di expo-notifications v47+
  // 'calendar' dengan hour/minute/repeats sudah deprecated sejak v47
  if (Notifications?.scheduleNotificationAsync) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pengingat: Pengisian Jurnal Harian',
        body: 'Mohon lengkapi jurnal kegiatan kerja Anda hari ini.',
        data: {
          type: 'local_daily_reminder',
          action: 'open_journal',
        },
        sound: 'notif.wav',
      },
      trigger: {
        type: 'daily',
        hour: 16,
        minute: 0,
        channelId: 'daily-reminder-v2',
      },
    });
  }
}

export async function cancelTodayReminder() {
  // Cancel jadwal lokal + bersihkan tray setelah karyawan absen
  if (Notifications?.cancelAllScheduledNotificationsAsync) {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
  if (Notifications?.dismissAllNotificationsAsync) {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export async function getExpoPushTokenDetails() {
  if (Platform?.OS === 'web') return { error: 'Web browser tidak mendukung Expo push token.' };
  if (!Notifications?.getPermissionsAsync) return { error: 'Layanan notifikasi tidak tersedia.' };

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      if (!Notifications?.requestPermissionsAsync) {
        return { error: 'Layanan izin notifikasi tidak tersedia.' };
      }
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { error: `Izin notifikasi belum aktif di HP (Status: ${finalStatus})` };
    }

    let tokenData;
    let errorLog = '';
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '0435be94-6cd0-4d8b-acac-865ae059b930',
      });
    } catch (e1) {
      errorLog += `[E1: ${e1.message}] `;
      try {
        tokenData = await Notifications.getExpoPushTokenAsync();
      } catch (e2) {
        errorLog += `[E2: ${e2.message}]`;
        return { error: `Gagal ambil token Expo: ${errorLog}` };
      }
    }

    if (tokenData && tokenData.data) {
      return { token: tokenData.data };
    }
    return { error: 'Token kosong dari layanan Expo.' };
  } catch (e) {
    return { error: e.message || 'Error tidak diketahui saat ambil token.' };
  }
}

export async function getExpoPushToken() {
  const res = await getExpoPushTokenDetails();
  return res.token || null;
}

export function setupNotificationReceivedListener() {
  if (!Notifications?.addNotificationReceivedListener) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener((notification) => {
    // Silent
  });
}

/**
 * Extracts normalized action string from an incoming notification response.
 * Handles both action: 'open_journal' and type: 'local_daily_reminder' / 'server_daily_reminder'.
 *
 * @param {object|null|undefined} response
 * @returns {string|null} Action identifier or null if unhandled.
 */
export function parseNotificationResponseAction(response) {
  if (!response || typeof response !== 'object') return null;
  const data = response?.notification?.request?.content?.data || response?.data || null;
  if (!data || typeof data !== 'object') return null;

  if (data.action === 'open_journal') {
    return 'open_journal';
  }
  if (data.type === 'local_daily_reminder' || data.type === 'server_daily_reminder') {
    return 'open_journal';
  }
  return null;
}

/**
 * Subscribes to notification response events (such as user tapping a notification).
 * Safely wraps listener with parsing and returns a removal handle.
 *
 * @param {function} onAction Callback invoked with (action, response).
 * @returns {{ remove: function }} Subscription removal handle.
 */
export function setupNotificationResponseReceivedListener(onAction) {
  if (Platform?.OS === 'web' || !Notifications?.addNotificationResponseReceivedListener) {
    return { remove: () => {} };
  }

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const action = parseNotificationResponseAction(response);
        if (action && typeof onAction === 'function') {
          onAction(action, response);
        }
      } catch (_) {
        // Safe handling during notification response dispatch
      }
    });

    return {
      remove: () => {
        try {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
          } else if (Notifications?.removeNotificationSubscription) {
            Notifications.removeNotificationSubscription(subscription);
          }
        } catch (_) {}
      },
    };
  } catch (_) {
    return { remove: () => {} };
  }
}

/**
 * Checks if the app was launched from a notification response (cold-start).
 * Resolves the initial notification response and parses its actionable intent.
 *
 * @returns {Promise<string|null>} Parsed action string or null.
 */
export async function checkInitialNotificationResponseAsync() {
  if (Platform?.OS === 'web' || !Notifications || typeof Notifications.getLastNotificationResponseAsync !== 'function') {
    return null;
  }

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return parseNotificationResponseAction(response);
  } catch (_) {
    return null;
  }
}
