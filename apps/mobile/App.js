import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/utils/theme';
import { API_URL } from './src/utils/api';
import axios from 'axios';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RiwayatScreen from './src/screens/RiwayatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';
import AdminKaryawanScreen from './src/screens/AdminKaryawanScreen';

function MainApp() {
  const { theme, isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // home | history | profile

  const isAdmin = user?.role?.toLowerCase().trim() === 'admin';

  // Efek Polling untuk Sesi Ganda (20 detik)
  useEffect(() => {
    let pollTimer = null;
    if (user && !isAdmin && user.rowIndex > 0) {
      pollTimer = setInterval(async () => {
        try {
          const res = await axios.post(API_URL, {
            action: 'checkSessionValid',
            rowIndex: user.rowIndex,
            sessionId: user.sessionId
          });
          const isValid = res.data?.data?.valid;
          if (isValid === false) {
            clearInterval(pollTimer);
            Alert.alert(
              '⚠️ KELUAR OTOMATIS!',
              'Akun Anda terdeteksi baru saja masuk di perangkat lain.',
              [{ text: 'OK', onPress: () => setUser(null) }]
            );
          }
        } catch (e) {
          // Abaikan jika error jaringan sesaat
        }
      }, 20000);
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
          return <ProfileScreen user={user} onLogout={() => setUser(null)} />;
        default:
          return <AdminScreen />;
      }
    } else {
      switch (activeTab) {
        case 'home':
          return <DashboardScreen user={user} onLogout={() => setUser(null)} />;
        case 'history':
          return <RiwayatScreen user={user} />;
        case 'profile':
          return <ProfileScreen user={user} onLogout={() => setUser(null)} />;
        default:
          return <DashboardScreen user={user} />;
      }
    }
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {!user ? (
        <LoginScreen onLoginSuccess={setUser} />
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
                {isAdmin ? 'REKAP JURNAL' : 'Absen'}
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const getStyles = (theme) => StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingVertical: 10,
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
  }
});
