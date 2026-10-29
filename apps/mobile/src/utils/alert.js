/**
 * Enterprise Alert Event Bus & Dispatcher
 * Provides pub/sub alert notification across mobile screens,
 * replacing standard system dialogs with branded modal styling.
 * 
 * Anti-slop: zero em dashes allowed in code, comments, or strings.
 */

let nativeAlert = null;
let nativePlatform = null;

try {
  // Resolve react-native safely in Metro bundler while remaining headless-friendly
  if (typeof require === 'function') {
    const rn = require('react-native');
    nativeAlert = rn.Alert;
    nativePlatform = rn.Platform;
  }
} catch (e) {
  // Silent fallback for non-native runtimes
}

let fallbackAlert = {
  alert: (title, message, buttons) => {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n\n${message}`);
    }
  }
};

let fallbackPlatform = {
  OS: typeof window !== 'undefined' ? 'web' : 'android'
};

export const setFallbackAdapter = (adapter) => {
  if (adapter) {
    if (adapter.Alert) fallbackAlert = adapter.Alert;
    if (adapter.Platform) fallbackPlatform = adapter.Platform;
  }
};

export const getFallbackAdapter = () => ({
  Alert: nativeAlert || fallbackAlert,
  Platform: nativePlatform || fallbackPlatform
});

const subscribers = new Set();

/**
 * Infer alert visual theme and icon based on content heuristics.
 * Evaluation order:
 * 1. Error keywords: error, gagal, ditolak, batal
 * 2. Success keywords: sukses, berhasil, tersimpan, antrean, antri
 * 3. Warning keywords: inkomplit, wajib, tunggu, perhatian, peringatan, fake gps, root
 * 4. Confirm if buttons array length > 1
 * 5. Default to info
 */
export const inferAlertType = (title = '', message = '', buttons = null) => {
  const combined = `${title || ''} ${message || ''}`.toLowerCase();

  const errorKeywords = ['error', 'gagal', 'ditolak', 'batal'];
  const successKeywords = ['sukses', 'berhasil', 'tersimpan', 'antrean', 'antri'];
  const warningKeywords = ['inkomplit', 'wajib', 'tunggu', 'perhatian', 'peringatan', 'fake gps', 'root'];

  for (const kw of errorKeywords) {
    if (combined.includes(kw)) return 'error';
  }
  for (const kw of successKeywords) {
    if (combined.includes(kw)) return 'success';
  }
  for (const kw of warningKeywords) {
    if (combined.includes(kw)) return 'warning';
  }
  if (Array.isArray(buttons) && buttons.length > 1) {
    return 'confirm';
  }
  return 'info';
};

/**
 * Subscribe a listener callback to alert events.
 * Returns an unsubscription function for React useEffect lifecycle cleanups.
 */
export const subscribeAlert = (listener) => {
  if (typeof listener === 'function') {
    subscribers.add(listener);
  }
  return () => unsubscribeAlert(listener);
};

/**
 * Unsubscribe a listener callback.
 */
export const unsubscribeAlert = (listener) => {
  subscribers.delete(listener);
};

/**
 * Get current active subscriber count.
 */
export const getAlertSubscribersCount = () => {
  return subscribers.size;
};

/**
 * Fallback execution handler when zero subscribers are active.
 */
const executeFallbackAlert = (title, message, buttons) => {
  const currentPlatform = nativePlatform || fallbackPlatform;
  const currentAlert = nativeAlert || fallbackAlert;

  if (currentPlatform?.OS === 'web' && typeof window !== 'undefined') {
    if (buttons && buttons.length > 1 && typeof window.confirm === 'function') {
      const isConfirm = window.confirm(`${title}\n\n${message}`);
      if (isConfirm) {
        const confirmBtn = buttons.find(b => b.style === 'destructive' || b.text === 'Ya' || b.text === 'Keluar' || b.text === 'Hapus' || b.text === 'Lanjut') || buttons[1];
        if (confirmBtn && confirmBtn.onPress) confirmBtn.onPress();
      } else {
        const cancelBtn = buttons.find(b => b.style === 'cancel' || b.text === 'Batal' || b.text === 'Tidak') || buttons[0];
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
      return;
    }
    if (typeof window.alert === 'function') {
      window.alert(`${title}\n\n${message}`);
      if (buttons && buttons.length === 1 && buttons[0].onPress) {
        buttons[0].onPress();
      }
      return;
    }
  }

  if (currentAlert && typeof currentAlert.alert === 'function') {
    if (buttons) {
      currentAlert.alert(title, message, buttons);
    } else {
      currentAlert.alert(title, message);
    }
  }
};

/**
 * Primary alert dispatcher.
 * Dispatches to EnterpriseAlertModal subscribers, or falls back to native/web alert.
 */
export const showAlert = (title, message, buttons = null, options = {}) => {
  const alertType = options?.type || inferAlertType(title, message, buttons);
  const payload = {
    id: Date.now(),
    title: title || '',
    message: message || '',
    buttons,
    type: alertType
  };

  if (subscribers.size > 0) {
    subscribers.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        // Prevent single listener crash from breaking others
      }
    });
    return payload;
  }

  executeFallbackAlert(title, message, buttons);
  return payload;
};
