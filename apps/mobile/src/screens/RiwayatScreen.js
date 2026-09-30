import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RiwayatScreen({ user }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riwayat, setRiwayat] = useState([]);
  const [error, setError] = useState('');

  const userEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
  const CACHE_KEY = userEmail ? `@riwayat_${userEmail}` : null;

  const fetchRiwayat = useCallback(async (isRefresh = false) => {
    if (!userEmail) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Tampilkan cache dulu biar instan
      if (!isRefresh && CACHE_KEY) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setRiwayat(JSON.parse(cached));
          setLoading(false);
        }
      }

      const response = await axios.post(API_URL, {
        action: 'getRiwayatUser',
        email: userEmail
      }, { timeout: 20000 });

      const resData = response.data;
      if (resData.status === 'success') {
        let safeArray = [];
        if (Array.isArray(resData.data)) safeArray = resData.data;
        else if (resData.data && Array.isArray(resData.data.data)) safeArray = resData.data.data;
        setRiwayat(safeArray);
        if (CACHE_KEY) {
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(safeArray));
        }
        setError('');
      } else {
        setError('Gagal memuat riwayat.');
      }
    } catch (err) {
      const errorMsg = err.message || 'Koneksi internet bermasalah.';
      if (!riwayat.length) {
        setError(errorMsg);
      } else {
        alert('Gagal memperbarui: ' + errorMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => { fetchRiwayat(); }, [fetchRiwayat]);

  const safeRiwayat = Array.isArray(riwayat) ? riwayat : [];
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Riwayat Jurnal Aktivitas</Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => fetchRiwayat(true)} disabled={refreshing}>
            <Ionicons name={refreshing ? "sync" : "refresh"} size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchRiwayat(true)} colors={[theme.primary]} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={60} color={theme.textSecondary} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : safeRiwayat.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Belum ada riwayat aktivitas.</Text>
          </View>
        ) : (
          safeRiwayat.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.tanggal}>{item.Tanggal} {item.Bulan} {item.Tahun}</Text>
                <View style={[styles.badge, { backgroundColor: item.Status === 'HADIR' ? theme.success : (item.Status === 'IZIN' ? theme.error : theme.primary) }]}>
                  <Text style={styles.badgeText}>{item.Status}</Text>
                </View>
              </View>
              
              <Text style={styles.label}>Waktu:</Text>
              <Text style={styles.value}>{item.JamMulai} - {item.JamAkhir}</Text>
              
              <Text style={styles.label}>Kegiatan:</Text>
              <Text style={styles.value}>{item.Kegiatan}</Text>

              <Text style={styles.label}>Hasil:</Text>
              <Text style={styles.value}>{item.HasilKegiatan}</Text>

              {item.IzinSakit && item.IzinSakit !== '-' && (
                <>
                  <Text style={styles.label}>Keterangan Izin/Sakit:</Text>
                  <Text style={styles.value}>{item.IzinSakit}</Text>
                </>
              )}
            </View>
          ))
        )}
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
  content: { padding: 16 },
  card: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tanggal: { fontSize: 14, fontWeight: 'bold', color: theme.text },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  label: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
  value: { fontSize: 14, color: theme.text, fontWeight: '500', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: theme.textSecondary, marginTop: 16, fontSize: 16 }
});
