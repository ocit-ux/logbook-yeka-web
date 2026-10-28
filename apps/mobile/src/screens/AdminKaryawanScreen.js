import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

export default function AdminKaryawanScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [karyawan, setKaryawan] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(API_URL, {
        action: 'getAllKaryawan'
      });

      const resData = response.data;
      if (resData.status === 'success') {
        let safeArray = [];
        if (Array.isArray(resData.data)) safeArray = resData.data;
        else if (resData.data && Array.isArray(resData.data.data)) safeArray = resData.data.data;
        setKaryawan(safeArray);
      } else {
        setError('Gagal memuat data karyawan.');
      }
    } catch (err) {
      setError('Koneksi bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const safeKaryawan = Array.isArray(karyawan) ? karyawan : [];
    const s = search.trim().toLowerCase();
    if (!s) return safeKaryawan;
    return safeKaryawan.filter(item =>
      String(item.Nama || '').toLowerCase().includes(s) ||
      String(item.Username || '').toLowerCase().includes(s)
    );
  }, [karyawan, search]);

  const styles = useMemo(() => getStyles(theme), [theme]);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.nama}>{item.Nama}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.Username}</Text>
        </View>
      </View>
      <Text style={styles.label}>Email / Telepon:</Text>
      <Text style={styles.value}>{item.Email} | {item.Telepon}</Text>
      <Text style={styles.label}>Divisi - Jabatan:</Text>
      <Text style={styles.value}>{item.Divisi} - {item.Jabatan}</Text>
    </View>
  ), [styles]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daftar Karyawan</Text>
        <Text style={styles.headerSubtitle}>Kelola Pengguna Sistem</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Cari nama atau Username..." 
          placeholderTextColor={theme.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="warning-outline" size={60} color={theme.textSecondary} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => item.Username || item.Email || String(index)}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color={theme.textSecondary} />
              <Text style={styles.emptyText}>Tidak ada karyawan ditemukan.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.primary,
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: { color: theme.secondary, fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#fff', fontSize: 12, opacity: 0.8 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: theme.text
  },
  content: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nama: { fontSize: 16, fontWeight: 'bold', color: theme.primary, flex: 1 },
  badge: { backgroundColor: theme.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: theme.primaryDark, fontSize: 10, fontWeight: 'bold' },
  label: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  value: { fontSize: 14, color: theme.text, fontWeight: '500', marginBottom: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: theme.textSecondary, fontSize: 14 }
});
