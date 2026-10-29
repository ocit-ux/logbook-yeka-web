import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform, AppState, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/utils/theme';
import { API_URL } from './src/utils/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RiwayatScreen from './src/screens/RiwayatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminKaryawanScreen from './src/screens/AdminKaryawanScreen';
import EnterpriseAlertModal from './src/components/EnterpriseAlertModal';
import { getExpoPushToken, setupNotificationReceivedListener } from './src/utils/notifications';

function MainApp() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [authChecked, setAuthChecked] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const ua = navigator.userAgent.toLowerCase();
      const platform = (navigator.platform || '').toLowerCase();
      const maxTouch = navigator.maxTouchPoints || 0;
      
      // JALUR RAHASIA DEVELOPER (Bypass)
      // Tambahkan ?dev=yeka di akhir URL untuk mengakses via PC
      const isDev = window.location.search.includes('dev=yeka');

      // 1. Cek User Agent dasar
      let isIOS = /iphone|ipad|ipod/.test(ua);
      
      // 2. Deteksi iPadOS 13+ (terbaca sebagai MacIntel tapi punya touch screen)
      if (platform === 'macintel' && maxTouch > 0) {
        isIOS = true;
      }

      // 3. Deteksi Ekstensi Mobile Simulator di PC
      // Ekstensi PC biasanya memalsukan User-Agent, tapi lupa memalsukan hardware platform.
      let isSimulatorPC = false;
      if (platform.includes('win') || platform.includes('linux')) {
        isSimulatorPC = true; // Pasti Windows atau Linux PC
      }
      if (platform.includes('macintel') && maxTouch === 0) {
        isSimulatorPC = true; // Pasti Macbook/iMac biasa (karena tidak ada touch)
      }

      // 4. Deteksi Tingkat Lanjut: Chrome Developer Tools (F12) Device Emulator
      // iPhone asli (meski pakai browser Chrome iOS sekalipun) TIDAK PERNAH memiliki objek 'window.chrome'
      // karena Apple memaksa semua browser di iOS menggunakan mesin Safari (WebKit).
      // Jika sistem mengaku sebagai iPhone TAPI memiliki 'window.chrome', itu PASTI PC (Emulator)!
      if (isIOS && window.chrome !== undefined) {
        isSimulatorPC = true;
      }

      // Jika bukan iOS, ATAU ketahuan pakai simulator PC, blokir! (Kecuali Developer)
      if (!isDev && (!isIOS || isSimulatorPC)) {
        setDeviceBlocked(true);
      }
    }
  }, []);

  const isAdmin = user?.role?.toLowerCase().trim() === 'admin';

  if (deviceBlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8d7da', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(114, 28, 36, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#721c24' }}>
          <Ionicons name="lock-closed" size={44} color="#721c24" />
        </View>
        <Text style={{ color: '#721c24', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 20 }}>Akses Ditolak</Text>
        <Text style={{ color: '#721c24', fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 24 }}>
          Sistem mendeteksi Anda menggunakan PC/Laptop atau Android Browser.{"\n\n"}
          Web ini dikunci eksklusif hanya untuk pengguna iOS (Safari/iPhone). Pengguna Android diwajibkan menggunakan Aplikasi aslinya (APK).
        </Text>
      </View>
    );
  }

  const lastUpdateCheckRef = useRef(0);
  const [updateReady, setUpdateReady] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    const checkAutoUpdate = async () => {
      if (Platform.OS === 'web' || __DEV__) return;
      const now = Date.now();
      if (now - lastUpdateCheckRef.current < 15000) return;
      lastUpdateCheckRef.current = now;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          // Unduh di latar belakang secara hening tanpa mengganggu sesi pengguna
          await Updates.fetchUpdateAsync();
          setUpdateReady(true);
        }
      } catch (e) {
        // Abaikan gangguan jaringan sesaat
      }
    };

    checkAutoUpdate();
    // Polling live di latar belakang tiap 30 detik saat aplikasi tetap menyala
    const liveUpdateInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkAutoUpdate();
      }
    }, 30000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkAutoUpdate();
    });
    const notifSub = setupNotificationReceivedListener();

    return () => {
      clearInterval(liveUpdateInterval);
      appStateSub?.remove?.();
      notifSub?.remove?.();
    };
  }, []);

  const handleApplyUpdate = async () => {
    if (isApplyingUpdate || isRestarting) return;
    setIsApplyingUpdate(true);
    setIsRestarting(true);
    setUpdateReady(false);

    // Berikan jeda 800ms agar layar enterprise transition tampil mulus dan bridge native membersihkan listener
    setTimeout(async () => {
      try {
        await Updates.reloadAsync();
      } catch (e) {
        setIsApplyingUpdate(false);
        setIsRestarting(false);
      }
    }, 800);
  };

  const syncPushTokenToServer = async (targetUser) => {
    if (!targetUser || targetUser.role === 'admin') return;
    try {
      const token = await getExpoPushToken();
      if (token) {
        await axios.post(API_URL, {
          action: 'simpanPushToken',
          rowIndex: targetUser.rowIndex,
          email: targetUser.email,
          username: targetUser.username,
          token: token
        });
      }
    } catch (e) {
      // Silent fail on network error atau Firebase error
    }
  };

  // Auto-login dari cache - instan tanpa perlu network
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('@cached_user');
        if (cached) {
          const u = JSON.parse(cached);
          setUser(u);
          syncPushTokenToServer(u);
        }
      } catch(e) {}
      finally { setAuthChecked(true); }
    })();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@cached_user');
    setUser(null);
    setActiveTab('home');
  };

  // Efek Polling untuk Sesi Ganda (120 detik)
  useEffect(() => {
    let pollTimer = null;
    if (user && !isAdmin && user.rowIndex > 0) {
      pollTimer = setInterval(async () => {
        try {
          const res = await axios.post(API_URL, {
            action: 'checkSessionValid',
            rowIndex: user.rowIndex,
            username: user.username,
            sessionId: user.sessionId
          });
          const isValid = res.data?.data?.valid;
          if (isValid === false) {
            clearInterval(pollTimer);
            if (Platform.OS === 'web') {
              window.alert('Peringatan Sesi\n\nAkun Anda terdeteksi baru saja masuk di perangkat lain.');
              setUser(null);
            } else {
              Alert.alert(
                'Peringatan Sesi',
                'Akun Anda terdeteksi baru saja masuk di perangkat lain.',
                [{ text: 'OK', onPress: () => setUser(null) }]
              );
            }
          }
        } catch (e) {
          // Abaikan jika error jaringan sesaat
        }
      }, 120000); // 2 menit sekali, hemat baterai & data
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [user, isAdmin]);

  const renderScreen = () => {
    if (isAdmin) {
      switch (activeTab) {
        case 'home':
          return <AdminScreen />;
        case 'history':
          return <AdminKaryawanScreen />;
        case 'profile':
          return <ProfileScreen user={user} onLogout={handleLogout} onUpdateUser={setUser} />;
        default:
          return <AdminScreen />;
      }
    } else {
      switch (activeTab) {
        case 'home':
          return <DashboardScreen user={user} onLogout={handleLogout} />;
        case 'history':
          return <RiwayatScreen user={user} />;
        case 'profile':
          return <ProfileScreen user={user} onLogout={handleLogout} onUpdateUser={setUser} />;
        default:
          return <DashboardScreen user={user} />;
      }
    }
  };

  const styles = useMemo(() => getStyles(theme, insets), [theme, insets]);

  // Tunggu cek cache selesai dulu agar tidak flicker ke halaman login
  if (!authChecked) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {!user ? (
        <LoginScreen onLoginSuccess={async (u) => {
          setUser(u);
          syncPushTokenToServer(u);
        }} />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          {/* Main Content Area */}
          <View style={{ flex: 1 }}>
            {renderScreen()}
          </View>
          
          {/* Custom Bottom Tab Bar */}
          <View style={[styles.bottomNav, isAdmin && { backgroundColor: theme.secondary }]}>
            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
              <Ionicons 
                name={activeTab === 'home' ? (isAdmin ? 'document-text' : 'home') : (isAdmin ? 'document-text-outline' : 'home-outline')} 
                size={24} 
                color={activeTab === 'home' ? (isAdmin ? theme.primaryDark : theme.primary) : theme.textSecondary} 
              />
              <Text style={[styles.navText, activeTab === 'home' && { color: isAdmin ? theme.primaryDark : theme.primary, fontWeight: 'bold' }]}>
                {isAdmin ? 'REKAP JURNAL' : 'Logbook'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('history')}>
              <Ionicons 
                name={activeTab === 'history' ? (isAdmin ? 'people' : 'time') : (isAdmin ? 'people-outline' : 'time-outline')} 
                size={24} 
                color={activeTab === 'history' ? (isAdmin ? theme.primaryDark : theme.primary) : theme.textSecondary} 
              />
              <Text style={[styles.navText, activeTab === 'history' && { color: isAdmin ? theme.primaryDark : theme.primary, fontWeight: 'bold' }]}>
                {isAdmin ? 'DATA KARYAWAN' : 'Riwayat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
              <Ionicons 
                name={activeTab === 'profile' ? 'person' : 'person-outline'} 
                size={24} 
                color={activeTab === 'profile' ? (isAdmin ? theme.primaryDark : theme.primary) : theme.textSecondary} 
              />
              <Text style={[styles.navText, activeTab === 'profile' && { color: isAdmin ? theme.primaryDark : theme.primary, fontWeight: 'bold' }]}>
                Profil
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
          {updateReady && (
        <View style={styles.updateCard}>
          <View style={styles.updateCardLeft}>
            <View style={styles.updateIconWrapper}>
              <Ionicons name="sparkles" size={18} color="#d4af37" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.updateCardTitle}>Pembaruan Sistem Siap</Text>
              <Text style={styles.updateCardDesc}>
                Versi baru telah diunduh. Terapkan sekarang atau otomatis saat membuka aplikasi kembali.
              </Text>
            </View>
          </View>
          <View style={styles.updateCardActions}>
            <TouchableOpacity 
              style={styles.updateApplyBtn} 
              onPress={handleApplyUpdate}
              disabled={isApplyingUpdate}
              activeOpacity={0.8}
            >
              {isApplyingUpdate ? (
                <ActivityIndicator size="small" color="#12382c" />
              ) : (
                <Text style={styles.updateApplyBtnText}>Terapkan</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.updateDismissBtn} 
              onPress={() => setUpdateReady(false)}
              activeOpacity={0.7}
              accessibilityLabel="Tutup"
            >
              <Ionicons name="close" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isRestarting && (
        <View style={styles.enterpriseRestartOverlay}>
          <View style={styles.enterpriseRestartBox}>
            <View style={styles.restartIconPulse}>
              <Ionicons name="sync-circle-outline" size={68} color="#d4af37" />
            </View>
            <Text style={styles.restartTitle}>Memulai Ulang Sistem</Text>
            <Text style={styles.restartSubtitle}>
              Pembaruan aplikasi telah siap. Menyinkronkan komponen dan memuat ulang antarmuka...
            </Text>
            <View style={styles.restartProgressBox}>
              <ActivityIndicator size="small" color="#d4af37" />
              <Text style={styles.restartProgressText}>Memuat versi terbaru...</Text>
            </View>
            <Text style={styles.restartFooter}>Yayasan Elang Katulistiwa Adipavitra</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f8d7da', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#721c24', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>CRASH TERDETEKSI</Text>
          <Text style={{ color: '#721c24', fontSize: 14, textAlign: 'center' }}>
            {this.state.error?.toString()}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <MainApp />
          <EnterpriseAlertModal />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const getStyles = (theme, insets) => StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
    paddingBottom: Math.max(15, (insets?.bottom || 0)),
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  updateCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? Math.max(12, insets?.top || 0) : 12,
    left: 14,
    right: 14,
    zIndex: 9999,
    backgroundColor: 'rgba(18, 56, 44, 0.98)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  updateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  updateIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  updateCardTitle: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  updateCardDesc: {
    color: '#ecfdf5',
    fontSize: 11,
    lineHeight: 15,
  },
  updateCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateApplyBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  updateApplyBtnText: {
    color: '#12382c',
    fontSize: 12,
    fontWeight: '700',
  },
  updateDismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  enterpriseRestartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    backgroundColor: 'rgba(11, 33, 25, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  enterpriseRestartBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#12382c',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d4af37',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  restartIconPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  restartTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  restartSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  restartProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  restartProgressText: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  restartFooter: {
    color: 'rgba(236, 253, 245, 0.6)',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  }
});
