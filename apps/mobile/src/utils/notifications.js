import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set up behavior for when notification is received while app is in foreground
if (Notifications.setNotificationHandler) {
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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder-v2', {
      name: 'Pengingat Harian',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'notif.wav',
    });
  }

  if (!Device.isDevice) return false; // emulator - tidak bisa request izin notif

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }
  return true;
}

export async function scheduleDailyReminder() {
  if (Platform.OS === 'web') return;

  // Bersihkan jadwal lama agar tidak dobel
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Pasang jadwal harian jam 16:00
  // ponytail: trigger 'daily' adalah format yang valid di expo-notifications v47+
  // 'calendar' dengan hour/minute/repeats sudah deprecated sejak v47
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pengingat: Pengisian Jurnal Harian',
      body: 'Mohon lengkapi jurnal kegiatan kerja Anda hari ini.',
      data: { type: 'local_daily_reminder' },
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

export async function cancelTodayReminder() {
  // Cancel jadwal lokal + bersihkan tray setelah karyawan absen
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Notifications.dismissAllNotificationsAsync) {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export async function getExpoPushTokenDetails() {
  if (Platform.OS === 'web') return { error: 'Web browser tidak mendukung Expo push token.' };

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
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
        projectId: '0435be94-6cd0-4d8b-acac-865ae059b930'
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
  if (!Notifications.addNotificationReceivedListener) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(notification => {
    // Silent
  });
}
