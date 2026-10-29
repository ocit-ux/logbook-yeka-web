import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeAlert, unsubscribeAlert } from '../utils/alert';
import { useTheme } from '../utils/theme';

const BADGE_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    color: '#10b981',
    badgeLight: '#ecfdf5',
    badgeDark: '#064e3b'
  },
  warning: {
    icon: 'warning',
    color: '#f59e0b',
    badgeLight: '#fffbeb',
    badgeDark: '#78350f'
  },
  error: {
    icon: 'close-circle',
    color: '#ef4444',
    badgeLight: '#fef2f2',
    badgeDark: '#7f1d1d'
  },
  info: {
    icon: 'information-circle',
    color: '#1b4d3e',
    badgeLight: '#e6f4ea',
    badgeDark: '#134e4a'
  },
  confirm: {
    icon: 'information-circle',
    color: '#1b4d3e',
    badgeLight: '#e6f4ea',
    badgeDark: '#134e4a'
  }
};

/**
 * EnterpriseAlertModal
 * Branded modal dialog supporting light/dark theme, icon badges, and smooth animations.
 * Subscribes to the alert pub/sub bus to intercept all app alerts.
 */
export default function EnterpriseAlertModal() {
  let isDark = false;
  try {
    const themeContext = useTheme();
    if (themeContext) isDark = Boolean(themeContext.isDark);
  } catch (e) {
    isDark = false;
  }

  const [visible, setVisible] = useState(false);
  const [alertData, setAlertData] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const handleAlert = useCallback((data) => {
    setAlertData(data);
    setVisible(true);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.92);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    const unsubscribe = subscribeAlert(handleAlert);
    return () => {
      unsubscribe();
    };
  }, [handleAlert]);

  const closeModal = useCallback((callback) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true
    }).start(() => {
      setVisible(false);
      setAlertData(null);
      if (typeof callback === 'function') {
        callback();
      }
    });
  }, [fadeAnim]);

  const handleDismiss = useCallback(() => {
    if (!alertData) {
      closeModal();
      return;
    }
    const buttons = alertData.buttons || [];
    const cancelBtn = buttons.find((b) => b.style === 'cancel' || b.text === 'Batal');
    if (cancelBtn && cancelBtn.onPress) {
      closeModal(cancelBtn.onPress);
    } else {
      closeModal();
    }
  }, [alertData, closeModal]);

  if (!visible || !alertData) {
    return null;
  }

  const alertType = alertData.type || 'info';
  const config = BADGE_CONFIG[alertType] || BADGE_CONFIG.info;
  const badgeBg = isDark ? config.badgeDark : config.badgeLight;
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const titleColor = isDark ? '#f8fafc' : '#0f172a';
  const messageColor = isDark ? '#cbd5e1' : '#475569';

  const rawButtons = alertData.buttons;
  const buttons = Array.isArray(rawButtons) && rawButtons.length > 0
    ? rawButtons
    : [{ text: 'OK' }];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.dialogCard,
                {
                  backgroundColor: cardBg,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              {/* Header Icon Badge */}
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Ionicons name={config.icon} size={32} color={config.color} />
              </View>

              {/* Title */}
              {alertData.title ? (
                <Text style={[styles.title, { color: titleColor }]}>
                  {alertData.title}
                </Text>
              ) : null}

              {/* Gold Accent Line */}
              <View style={styles.goldLine} />

              {/* Message */}
              {alertData.message ? (
                <Text style={[styles.message, { color: messageColor }]}>
                  {alertData.message}
                </Text>
              ) : null}

              {/* Action Buttons */}
              {buttons.length === 1 ? (
                <View style={styles.singleButtonContainer}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      const btn = buttons[0];
                      closeModal(btn.onPress);
                    }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {buttons[0].text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : buttons.length === 2 ? (
                <View style={styles.twoButtonRow}>
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel' || (index === 0 && !btn.style);
                    const isDestructive = btn.style === 'destructive';

                    if (isCancel) {
                      return (
                        <TouchableOpacity
                          key={`btn-${index}`}
                          style={[
                            styles.cancelButton,
                            { borderColor: isDark ? '#475569' : '#cbd5e1' }
                          ]}
                          activeOpacity={0.8}
                          onPress={() => closeModal(btn.onPress)}
                        >
                          <Text
                            style={[
                              styles.cancelButtonText,
                              { color: isDark ? '#cbd5e1' : '#475569' }
                            ]}
                          >
                            {btn.text || 'Batal'}
                          </Text>
                        </TouchableOpacity>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={`btn-${index}`}
                        style={[
                          styles.confirmButton,
                          {
                            backgroundColor: isDestructive ? '#ef4444' : '#1b4d3e'
                          }
                        ]}
                        activeOpacity={0.85}
                        onPress={() => closeModal(btn.onPress)}
                      >
                        <Text style={styles.confirmButtonText}>
                          {btn.text || 'Lanjutkan'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.multiButtonContainer}>
                  {buttons.map((btn, index) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel';

                    return (
                      <TouchableOpacity
                        key={`btn-${index}`}
                        style={[
                          styles.multiButton,
                          isCancel
                            ? [
                                styles.cancelButton,
                                { borderColor: isDark ? '#475569' : '#cbd5e1', marginBottom: 8 }
                              ]
                            : {
                                backgroundColor: isDestructive ? '#ef4444' : '#1b4d3e',
                                marginBottom: 8
                              }
                        ]}
                        activeOpacity={0.85}
                        onPress={() => closeModal(btn.onPress)}
                      >
                        <Text
                          style={
                            isCancel
                              ? [
                                  styles.cancelButtonText,
                                  { color: isDark ? '#cbd5e1' : '#475569' }
                                ]
                              : styles.primaryButtonText
                          }
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  dialogCard: {
    width: '88%',
    maxWidth: 400,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center'
  },
  goldLine: {
    height: 2,
    width: 40,
    backgroundColor: '#d4af37',
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 1
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20
  },
  singleButtonContainer: {
    width: '100%'
  },
  primaryButton: {
    backgroundColor: '#1b4d3e',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600'
  },
  twoButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  confirmButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600'
  },
  multiButtonContainer: {
    width: '100%'
  },
  multiButton: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
