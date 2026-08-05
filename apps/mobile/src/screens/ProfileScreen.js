import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';

export default function ProfileScreen({ user, onLogout }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nama: user?.nama || '',
    jabatan: user?.jabatan || '',
    devisi: user?.devisi || '',
    telepon: user?.telepon || '',
    email: user?.email || '',
  });

  const handleUpdate = () => {
    Alert.alert('Info', 'Fitur update profil belum tersedia. Silakan hubungi Admin.');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Konfirmasi Logout',
      'Apakah Anda yakin ingin keluar?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Hapus sesi di server (keamanan)
              if (user?.rowIndex && user.rowIndex > 0) {
                await axios.post(API_URL, {
                  action: 'logoutUser',
                  rowIndex: user.rowIndex
                });
              }
            } catch (e) {
              // Tetap logout lokal meski server error
            } finally {
              setLoading(false);
              onLogout();
            }
          }
        }
      ]
    );
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
            <Ionicons name="person-circle" size={80} color={theme.primary} />
            <Text style={styles.name}>{user?.nama || 'Pengguna'}</Text>
            <Text style={styles.subtitle}>{user?.jabatan || 'Karyawan'}</Text>
          </View>

          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput style={styles.input} value={form.nama} editable={false} />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={form.email} editable={false} />

          <Text style={styles.label}>Nomor Telepon</Text>
          <TextInput style={styles.input} value={form.telepon} editable={false} />

          <Text style={styles.label}>Jabatan</Text>
          <TextInput style={styles.input} value={form.jabatan} editable={false} />

          <Text style={styles.label}>Divisi</Text>
          <TextInput style={styles.input} value={form.devisi} editable={false} />

          <TouchableOpacity style={styles.btnUpdate} onPress={handleUpdate}>
            <Text style={styles.btnText}>Request Update Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={theme.primary} />
              <Text style={[styles.label, { marginBottom: 0 }]}>Mode Gelap (Dark Mode)</Text>
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
