import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import { showAlert } from '../utils/alert';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ onLoginSuccess }) {
  const { theme, isDark } = useTheme();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // State Register
  const [regForm, setRegForm] = useState({
    nama: '', email: '', telepon: '', jabatan: '', divisi: '', username: '', pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!employeeId || !pin) {
      setError('Username dan PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post(API_URL, {
        action: 'login',
        username: employeeId,
        password: pin
      }, { timeout: 15000 }); // Menyerah setelah 15 detik
      
      const resData = response.data;
      if (resData.status === 'success') {
        const loggedInUser = resData.data;
        // Cache user agar auto-login bekerja
        await AsyncStorage.setItem('@cached_user', JSON.stringify(loggedInUser));
        onLoginSuccess(loggedInUser);
      } else {
        setError(resData.message || 'Gagal login, periksa kembali ID dan PIN.');
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Server lambat. Coba lagi dalam beberapa detik.');
      } else {
        setError('Gagal menghubungi server. Pastikan internet Anda aktif.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regForm.nama || !regForm.username || !regForm.pin || !regForm.email) {
      setError('Nama, Username, Email, dan PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(API_URL, {
        action: 'register',
        data: {
          nama: regForm.nama,
          email: regForm.email,
          telepon: regForm.telepon,
          devisi: regForm.divisi,
          jabatan: regForm.jabatan,
          username: regForm.username,
          password: regForm.pin
        }
      });

      const resData = response.data;
      if (resData.status === 'success') {
        showAlert(
          "Pendaftaran Berhasil!",
          `Username Anda adalah:\n\n${regForm.username}\n\nHarap simpan Username ini baik-baik untuk Login.`,
          [{ text: "Mengerti", onPress: () => setMode('login') }]
        );
        setRegForm({ nama: '', email: '', telepon: '', jabatan: '', divisi: '', username: '', pin: '' });
      } else {
        setError(resData.message || 'Gagal mendaftar.');
      }
    } catch (err) {
      setError('Gagal menghubungi server. Pastikan internet Anda aktif.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    if (!employeeId) {
      setError('Masukkan Username Anda terlebih dahulu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(API_URL, {
        action: 'forgotPassword',
        username: employeeId
      });
      const resData = response.data;
      if (resData.status === 'success') {
        showAlert('Berhasil', 'PIN baru telah dikirim ke email terdaftar Anda.');
        setMode('login');
      } else {
        setError(resData.message || 'Gagal reset PIN.');
      }
    } catch (err) {
      setError('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  const updateRegForm = (field, value) => {
    setRegForm({ ...regForm, [field]: value });
  };

  const styles = getStyles(theme);

  return (
    <LinearGradient
      colors={[theme.primaryDark, theme.primary]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, minHeight: 40 }} />
          <View style={styles.boxLogin}>
            <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={{ width: 80, height: 80, marginBottom: 10 }} resizeMode="contain" />
          <Text style={styles.appTitle}>Yayasan Elang Katulistiwa Adipavitra</Text>
          <Text style={styles.appSubtitle}>SISTEM JURNAL CLOUD</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={16} color={theme.error} style={{marginRight: 6}}/>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {mode === 'login' && (
          <View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username / E-mail</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color={theme.primary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Masukkan Username / E-mail" placeholderTextColor={theme.textSecondary} value={employeeId} onChangeText={setEmployeeId} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PIN / Sandi Keamanan</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color={theme.primary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Masukkan PIN" placeholderTextColor={theme.textSecondary} secureTextEntry={!showPin} value={pin} onChangeText={setPin} />
                <TouchableOpacity onPress={() => setShowPin(!showPin)} style={{ paddingHorizontal: 10 }}>
                  <Ionicons name={showPin ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonContent}>
                  <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Masuk Sistem</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => setMode('forgot')}>
                <Text style={styles.linkText}>Lupa PIN?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('register')}>
                <Text style={styles.linkTextBold}>Buat Akun Baru</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mode === 'register' && (
          <View>
            <Text style={styles.sectionTitle}>Pendaftaran Akun</Text>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Nama Lengkap" placeholderTextColor={theme.textSecondary} value={regForm.nama} onChangeText={(t) => updateRegForm('nama', t)} /></View>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Username" placeholderTextColor={theme.textSecondary} value={regForm.username} onChangeText={(t) => updateRegForm('username', t)} /></View>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Email" placeholderTextColor={theme.textSecondary} value={regForm.email} onChangeText={(t) => updateRegForm('email', t)} /></View>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Telepon / WA" placeholderTextColor={theme.textSecondary} value={regForm.telepon} onChangeText={(t) => updateRegForm('telepon', t)} /></View>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Jabatan" placeholderTextColor={theme.textSecondary} value={regForm.jabatan} onChangeText={(t) => updateRegForm('jabatan', t)} /></View>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Divisi" placeholderTextColor={theme.textSecondary} value={regForm.divisi} onChangeText={(t) => updateRegForm('divisi', t)} /></View>
            <View style={[styles.inputContainer2, { flexDirection: 'row', alignItems: 'center' }]}>
              <TextInput style={[styles.input2, { flex: 1 }]} placeholder="Buat PIN" placeholderTextColor={theme.textSecondary} secureTextEntry={!showPin} value={regForm.pin} onChangeText={(t) => updateRegForm('pin', t)} />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={{ padding: 10 }}>
                <Ionicons name={showPin ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Daftar Sekarang</Text>}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.linkText}>Sudah punya akun? <Text style={styles.linkTextBold}>Login</Text></Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mode === 'forgot' && (
          <View>
            <Text style={styles.sectionTitle}>Reset PIN</Text>
            <Text style={{textAlign: 'center', marginBottom: 16, color: theme.textSecondary}}>Masukkan Username Anda. Sistem akan membuat PIN baru dan mengirimkannya ke email yang terdaftar.</Text>
            <View style={styles.inputContainer2}><TextInput style={styles.input2} placeholder="Username" placeholderTextColor={theme.textSecondary} value={employeeId} onChangeText={setEmployeeId} autoCapitalize="none" /></View>
            
            <TouchableOpacity style={styles.button} onPress={handleForgotPin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kirim PIN Baru ke Email</Text>}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.linkTextBold}>Kembali ke Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
          </View>
          <View style={{ flex: 1, minHeight: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 16,
  },
  boxLogin: {
    backgroundColor: theme.surface,
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 32,
    borderTopWidth: 4,
    borderColor: theme.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.primary,
    marginTop: 10,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center'
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
  },
  inputContainer2: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input2: {
    paddingVertical: 12,
    fontSize: 14,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  linkText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  linkTextBold: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 20,
    textAlign: 'center'
  },
  errorBox: {
    backgroundColor: theme.mode === 'dark' ? 'rgba(248, 113, 113, 0.2)' : '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: theme.error
  },
  errorText: {
    color: theme.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  }
});
