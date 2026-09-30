import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getDeviceInfo = async () => {
  try {
    let deviceId = await AsyncStorage.getItem('@device_uuid');
    if (!deviceId) {
      deviceId = uuidv4();
      await AsyncStorage.setItem('@device_uuid', deviceId);
    }
    const shortId = deviceId.split('-')[0].toUpperCase();

    if (Platform.OS === 'web') {
      const userAgent = navigator.userAgent.toLowerCase();
      let browserName = "Web Browser";
      if (userAgent.indexOf('edg') > -1) browserName = "Edge";
      else if (userAgent.indexOf('opr') > -1) browserName = "Opera";
      else if (userAgent.indexOf('chrome') > -1 && userAgent.indexOf('safari') > -1) browserName = "Chrome";
      else if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1) browserName = "Safari";
      else if (userAgent.indexOf('firefox') > -1) browserName = "Firefox";

      let osName = "OS";
      if (userAgent.indexOf('windows') > -1) osName = "Windows";
      else if (userAgent.indexOf('mac') > -1) osName = "Mac";
      else if (userAgent.indexOf('linux') > -1) osName = "Linux";
      else if (userAgent.indexOf('android') > -1) osName = "Android";
      else if (userAgent.indexOf('iphone') > -1 || userAgent.indexOf('ipad') > -1) osName = "iOS";

      return `Web: ${browserName} di ${osName} [ID: ${shortId}]`;
    } else {
      const model = Device.modelName || "HP";
      return `${model} [ID: ${shortId}]`;
    }
  } catch (e) {
    return Platform.OS === 'web' ? "Web App" : "Aplikasi Expo";
  }
};

// ponytail: flag 'mocked' membaca langsung Android isFromMockProvider.
export const isMockedLocation = (loc) => Boolean(loc?.mocked || loc?.coords?.mocked);

// ponytail: deteksi su binary & test-keys via expo-device. Upgrade ke Google Play Integrity API jika APK didistribusikan via Play Store.
export const isDeviceRooted = async () => {
  if (Platform.OS === 'web') return false;
  try {
    return await Device.isRootedExperimentalAsync();
  } catch (e) {
    return false;
  }
};
