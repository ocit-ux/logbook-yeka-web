import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const BULAN_LIST = [
  { label: 'Semua Bulan', value: '' },
  { label: 'Januari', value: 'January' },
  { label: 'Februari', value: 'February' },
  { label: 'Maret', value: 'March' },
  { label: 'April', value: 'April' },
  { label: 'Mei', value: 'May' },
  { label: 'Juni', value: 'June' },
  { label: 'Juli', value: 'July' },
  { label: 'Agustus', value: 'August' },
  { label: 'September', value: 'September' },
  { label: 'Oktober', value: 'October' },
  { label: 'November', value: 'November' },
  { label: 'Desember', value: 'December' },
];

export default function AdminScreen() {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [absensi, setAbsensi] = useState([]);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterBulan, setFilterBulan] = useState('');
  const [exporting, setExporting] = useState(false);
  
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterItems, setFilterItems] = useState(BULAN_LIST);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(API_URL, {
        action: 'getAllAbsensi'
      });

      const resData = response.data;
      if (resData.status === 'success') {
        let safeArray = [];
        if (Array.isArray(resData.data)) safeArray = resData.data;
        else if (resData.data && Array.isArray(resData.data.data)) safeArray = resData.data.data;
        setAbsensi(safeArray);
      } else {
        setError('Gagal memuat data absensi.');
      }
    } catch (err) {
      setError('Koneksi internet bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  const safeAbsensi = Array.isArray(absensi) ? absensi : [];
  
  const filteredData = safeAbsensi.filter(item => {
    const s = search.toLowerCase();
    const matchesSearch = String(item.Nama || '').toLowerCase().includes(s) || 
                          String(item.Kegiatan || '').toLowerCase().includes(s);
    const matchesBulan = filterBulan === '' || String(item.Bulan || '') === filterBulan;
    return matchesSearch && matchesBulan;
  });

  const totalHadir = filteredData.filter(i => i.Status === 'HADIR').length;
  const totalIzin = filteredData.filter(i => i.Status === 'IZIN' || i.Status === 'SAKIT').length;

  const exportPDF = async () => {
    if (filteredData.length === 0) {
      Alert.alert('Tidak Ada Data', 'Tidak ada rekap untuk diekspor.');
      return;
    }
    setExporting(true);
    try {
      const rows = filteredData.map(item => `
        <tr>
          <td>${item.Nama || '-'}</td>
          <td>${item.Tanggal || '-'} ${item.Bulan || ''}</td>
          <td><span class="badge ${item.Status === 'HADIR' ? 'hadir' : 'izin'}">${item.Status || '-'}</span></td>
          <td>${item.JamMulai || '-'} - ${item.JamAkhir || '-'}</td>
          <td>${item.Kegiatan || '-'}</td>
        </tr>
      `).join('');

      const html = `
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
            h1 { color: #1b4d3e; font-size: 16px; margin-bottom: 4px; }
            h2 { color: #555; font-size: 12px; font-weight: normal; margin-top: 0; }
            .summary { display: flex; gap: 20px; margin: 16px 0; }
            .sum-box { padding: 8px 16px; border-radius: 6px; font-weight: bold; }
            .sum-hadir { background: #d1fae5; color: #065f46; }
            .sum-izin  { background: #fef3c7; color: #92400e; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #1b4d3e; color: #fff; padding: 8px 6px; text-align: left; font-size: 11px; }
            td { padding: 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
            tr:nth-child(even) td { background: #f9fafb; }
            .badge { padding: 2px 8px; border-radius: 8px; font-weight: bold; font-size: 10px; }
            .hadir { background: #d1fae5; color: #065f46; }
            .izin  { background: #fef3c7; color: #92400e; }
          </style>
        </head>
        <body>
          <h1>Laporan Jurnal Seluruh Karyawan</h1>
          <p style="color:#888; font-size:11px;">Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${filterBulan ? ` | Filter: ${filterBulan}` : ''}</p>
          <div class="summary">
            <div class="sum-box sum-hadir">✅ Hadir: ${totalHadir}</div>
            <div class="sum-box sum-izin">🟡 Izin/Sakit: ${totalIzin}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nama Karyawan</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Jam</th>
                <th>Kegiatan</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Ekspor Laporan PDF' });
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuat PDF.');
    } finally {
      setExporting(false);
    }
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jurnal Seluruh Karyawan</Text>
        <Text style={styles.headerSubtitle}>Panel Administrator</Text>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Cari nama..." 
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={[styles.pickerWrap, { zIndex: 10, borderWidth: 0, backgroundColor: 'transparent' }]}>
          <DropDownPicker
            open={filterOpen}
            value={filterBulan}
            items={filterItems}
            setOpen={setFilterOpen}
            setValue={setFilterBulan}
            setItems={setFilterItems}
            theme={isDark ? "DARK" : "LIGHT"}
            style={{ backgroundColor: theme.surface, borderColor: theme.border, minHeight: 48 }}
            dropDownContainerStyle={{ backgroundColor: theme.surface, borderColor: theme.border }}
            textStyle={{ color: theme.text }}
            placeholder="Pilih Bulan"
            listMode="SCROLLVIEW"
          />
        </View>
        <TouchableOpacity style={styles.btnExport} onPress={exportPDF} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="print" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.sumCard, { borderColor: theme.success }]}>
          <Text style={[styles.sumNum, { color: theme.success }]}>{totalHadir}</Text>
          <Text style={styles.sumLabel}>Hadir</Text>
        </View>
        <View style={[styles.sumCard, { borderColor: theme.error }]}>
          <Text style={[styles.sumNum, { color: theme.error }]}>{totalIzin}</Text>
          <Text style={styles.sumLabel}>Izin/Sakit</Text>
        </View>
        <View style={[styles.sumCard, { borderColor: theme.primary }]}>
          <Text style={[styles.sumNum, { color: theme.primary }]}>{filteredData.length}</Text>
          <Text style={styles.sumLabel}>Total</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="warning-outline" size={60} color={theme.textSecondary} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Tidak ada data yang ditemukan.</Text>
          </View>
        ) : (
          filteredData.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.nama}>{item.Nama}</Text>
                <View style={[styles.badge, { backgroundColor: item.Status === 'HADIR' ? theme.success : item.Status === 'IZIN' ? theme.error : theme.primary }]}>
                  <Text style={styles.badgeText}>{item.Status}</Text>
                </View>
              </View>
              
              <Text style={styles.tanggal}>{item.Tanggal} {item.Bulan} {item.Tahun} ({item.JamMulai} - {item.JamAkhir})</Text>
              
              <Text style={styles.label}>Kegiatan:</Text>
              <Text style={styles.value}>{item.Kegiatan}</Text>

              <Text style={styles.label}>Hasil:</Text>
              <Text style={styles.value}>{item.HasilKegiatan}</Text>
              
              {item.IzinSakit && item.IzinSakit !== '-' && (
                <>
                  <Text style={styles.label}>Ket Izin/Sakit:</Text>
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
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: { color: theme.secondary, fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#fff', fontSize: 14, marginTop: 4 },
  
  filterRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    alignItems: 'center',
    gap: 10
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.text,
  },
  pickerWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    marginRight: 10
  },
  btnExport: {
    backgroundColor: theme.primary,
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },

  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  sumCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderTopWidth: 3,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sumNum: { fontSize: 20, fontWeight: 'bold' },
  sumLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },

  content: { padding: 16 },
  card: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.secondary,
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
    marginBottom: 8,
  },
  nama: { fontSize: 16, fontWeight: 'bold', color: theme.primary, flex: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tanggal: { fontSize: 12, color: theme.textSecondary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 8 },
  label: { fontSize: 12, color: theme.textSecondary, marginTop: 8 },
  value: { fontSize: 14, color: theme.text, fontWeight: '500', marginTop: 2 },
  
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: theme.textSecondary, marginTop: 16, fontSize: 16 }
});
