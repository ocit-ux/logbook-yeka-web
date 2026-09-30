import { Alert, Platform } from 'react-native';

export const showAlert = (title, message, buttons = null) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const isConfirm = window.confirm(`${title}\n\n${message}`);
      if (isConfirm) {
        const confirmBtn = buttons.find(b => b.style === 'destructive' || b.text === 'Ya' || b.text === 'Keluar' || b.text === 'Hapus' || b.text === 'Lanjut') || buttons[1];
        if (confirmBtn && confirmBtn.onPress) confirmBtn.onPress();
      } else {
        const cancelBtn = buttons.find(b => b.style === 'cancel' || b.text === 'Batal' || b.text === 'Tidak') || buttons[0];
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
      if (buttons && buttons.length === 1 && buttons[0].onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    if (buttons) {
      Alert.alert(title, message, buttons);
    } else {
      Alert.alert(title, message);
    }
  }
};
