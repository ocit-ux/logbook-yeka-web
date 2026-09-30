import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Switch, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import { showAlert } from '../utils/alert';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen({ user, onLogout, onUpdateUser }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    nama: user?.nama || '',
    jabatan: user?.jabatan || '',
    devisi: user?.devisi || '',
    telepon: user?.telepon || '',
    email: user?.email || '',
  });

  useEffect(() => {
    // Sinkronisasi data di background agar otomatis update tanpa log out
    const syncProfile = async () => {
      try {
        const response = await axios.post(API_URL, {
          action: 'getUserProfile',
          rowIndex: user.rowIndex
        });
        if (response.data && response.data.status === 'success' && response.data.data) {
          const freshData = response.data.data;
          const updatedUser = { ...user, ...freshData };
          
          // Cek apakah ada perubahan (menghindari render tak perlu jika sama)
          if (
            user.nama !== freshData.nama || 
            user.telepon !== freshData.telepon || 
            user.jabatan !== freshData.jabatan || 
            user.devisi !== freshData.devisi
          ) {
            setForm({
              nama: freshData.nama || '',
              jabatan: freshData.jabatan || '',
              devisi: freshData.devisi || '',
              telepon: freshData.telepon || '',
              email: freshData.email || '',
            });
            onUpdateUser(updatedUser);
            await AsyncStorage.setItem('@cached_user', JSON.stringify(updatedUser));
          }
        }
      } catch (error) {
        // Gagal sync diamkan saja (bisa karena offline)
      }
    };
    syncProfile();
  }, []);

  const handleUpdate = async () => {
    if (!form.nama || !form.telepon || !form.jabatan || !form.devisi) {
      showAlert('Error', 'Semua field (kecuali foto) harus diisi.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        action: 'updateProfile',
        rowIndex: user.rowIndex,
        data: {
          nama: form.nama,
          telepon: form.telepon,
          jabatan: form.jabatan,
          devisi: form.devisi
        }
      });

      if (response.data && response.data.status === 'success') {
        const updatedUser = { 
          ...user, 
          nama: form.nama, 
          telepon: form.telepon, 
          jabatan: form.jabatan, 
          devisi: form.devisi 
        };
        onUpdateUser(updatedUser);
        await AsyncStorage.setItem('@cached_user', JSON.stringify(updatedUser));
        showAlert('Sukses', 'Profil berhasil diperbarui.');
      } else {
        showAlert('Gagal', response.data?.message || 'Terjadi kesalahan saat mengupdate profil.');
      }
    } catch (error) {
      showAlert('Error', 'Koneksi gagal. Pastikan internet Anda aktif.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Izin Ditolak', 'Maaf, kami butuh izin akses galeri untuk mengganti foto profil.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        const response = await axios.post(API_URL, {
          action: 'uploadProfilePhoto',
          rowIndex: user.rowIndex,
          base64: base64Data
        });
        
        if (response.data && response.data.status === 'success' && response.data.data && response.data.data.success) {
          const updatedUser = { ...user, fotoProfil: response.data.data.fotoURL };
          onUpdateUser(updatedUser);
          await AsyncStorage.setItem('@cached_user', JSON.stringify(updatedUser));
          showAlert('Sukses', 'Foto profil berhasil diperbarui.');
        } else {
          showAlert('Gagal', 'Terjadi kesalahan saat mengunggah foto profil.');
        }
      }
    } catch (error) {
      showAlert('Error', 'Gagal mengunggah foto. Pastikan koneksi internet stabil.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      setLoading(true);
      try {
        if (user?.rowIndex && user.rowIndex > 0) {
          await axios.post(API_URL, { action: 'logoutUser', rowIndex: user.rowIndex });
        }
      } catch (e) {
      } finally {
        setLoading(false);
        onLogout();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Apakah Anda yakin ingin keluar?')) {
        doLogout();
      }
    } else {
      showAlert(
        'Konfirmasi Logout',
        'Apakah Anda yakin ingin keluar?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Keluar', style: 'destructive', onPress: doLogout }
        ]
      );
    }
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Profil Akun</Text>
      </View>
      <ScrollView style={styles.content}>
        
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={handleUploadPhoto} disabled={uploadingImage} style={styles.avatarTouch}>
              {uploadingImage ? (
                <View style={[styles.avatarImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e1e1e1' }]}>
                  <ActivityIndicator size="large" color={theme.primary} />
                </View>
              ) : user?.fotoProfil ? (
                <Image source={{ uri: user.fotoProfil }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person-circle" size={80} color={theme.primary} />
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{user?.nama || 'Pengguna'}</Text>
            <Text style={styles.subtitle}>{user?.jabatan || 'Karyawan'}</Text>
          </View>

          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput style={styles.input} value={form.nama} onChangeText={(text) => setForm({...form, nama: text})} />

          <Text style={styles.label}>Email (Tidak dapat diubah)</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.surface }]} value={form.email} editable={false} />

          <Text style={styles.label}>Nomor Telepon</Text>
          <TextInput style={styles.input} value={form.telepon} onChangeText={(text) => setForm({...form, telepon: text})} keyboardType="phone-pad" />

          <Text style={styles.label}>Jabatan</Text>
          <TextInput style={styles.input} value={form.jabatan} onChangeText={(text) => setForm({...form, jabatan: text})} />

          <Text style={styles.label}>Divisi</Text>
          <TextInput style={styles.input} value={form.devisi} onChangeText={(text) => setForm({...form, devisi: text})} />

          <TouchableOpacity style={styles.btnUpdate} onPress={handleUpdate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Simpan Perubahan</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={theme.primary} />
              <Text style={[styles.label, { marginBottom: 0, marginLeft: 10 }]}>Mode Gelap (Dark Mode)</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={isDark ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleTheme}
              value={isDark}
            />
          </View>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            Pilih tema gelap untuk kenyamanan mata di malam hari.
          </Text>
        </View>

        <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.btnText}>{loading ? 'Memproses...' : 'Keluar (Logout)'}</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { 
    backgroundColor: theme.primary, 
    padding: 24, 
    paddingTop: 48, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: theme.secondary 
  },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16, flex: 1 },
  card: {
    backgroundColor: theme.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderTopWidth: 4,
    borderColor: theme.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarTouch: { position: 'relative' },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: theme.primary },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.surface
  },
  name: { fontSize: 20, fontWeight: 'bold', color: theme.primary, marginTop: 8 },
  subtitle: { fontSize: 14, color: theme.textSecondary },
  label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 },
  input: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    color: theme.text,
  },
  btnUpdate: {
    backgroundColor: theme.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  btnLogout: {
    backgroundColor: theme.error,
    padding: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
