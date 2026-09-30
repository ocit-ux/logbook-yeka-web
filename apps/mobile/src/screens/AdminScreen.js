import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import { showAlert } from '../utils/alert';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
const generateMonthYear = () => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const labels = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const items = [{ label: 'Semua Periode', value: '' }];
  const currentYear = new Date().getFullYear();
  for(let y = currentYear; y >= currentYear - 1; y--) {
    for(let m = 0; m < 12; m++) {
      items.push({ label: `${labels[m]} ${y}`, value: `${months[m]}-${y}` });
    }
  }
  return items;
};
const BULAN_LIST = generateMonthYear();

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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterDate, setFilterDate] = useState(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      // Tampilkan cache dulu biar instan
      const cached = await AsyncStorage.getItem('@admin_absensi_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setAbsensi(parsed);
        setLoading(false); // Tampilkan cache, loading selesai
      }

      // Fetch data segar di background
      const response = await axios.post(API_URL, {
        action: 'getAllAbsensi'
      }, { timeout: 30000 });

      const resData = response.data;
      if (resData.status === 'success') {
        let safeArray = [];
        if (Array.isArray(resData.data)) safeArray = resData.data;
        else if (resData.data && Array.isArray(resData.data.data)) safeArray = resData.data.data;
        setAbsensi(safeArray);
        AsyncStorage.setItem('@admin_absensi_cache', JSON.stringify(safeArray));
      } else if (!cached) {
        setError('Gagal memuat data absensi.');
      }
    } catch (err) {
      if (!absensi.length) setError('Koneksi internet bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  const safeAbsensi = Array.isArray(absensi) ? absensi : [];
  
  const filteredData = safeAbsensi.filter(item => {
    const s = search.toLowerCase();
    const matchesSearch = String(item.Nama || '').toLowerCase().includes(s) || 
                          String(item.Kegiatan || '').toLowerCase().includes(s);
    
    let matchesTime = true;
    if (filterDate) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      matchesTime = String(item.Tanggal) === String(filterDate.getDate()) && 
                    String(item.Bulan) === months[filterDate.getMonth()] && 
                    String(item.Tahun) === String(filterDate.getFullYear());
    } else if (filterBulan) {
      const [fMonth, fYear] = filterBulan.split('-');
      matchesTime = String(item.Bulan) === fMonth && String(item.Tahun) === fYear;
    }

    return matchesSearch && matchesTime;
  });

  const totalHadir = filteredData.filter(i => i.Status === 'HADIR').length;
  const totalIzin = filteredData.filter(i => i.Status === 'IZIN' || i.Status === 'SAKIT').length;

  const exportPDF = async () => {
    if (filteredData.length === 0) {
      showAlert('Tidak Ada Data', 'Tidak ada rekap untuk diekspor.');
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
          <td>${item.Kegiatan || '-'}${item.StatusKeamanan && item.StatusKeamanan.includes('TERDETEKSI') ? `<br><b style="color:#b91c1c;font-size:10px;">[${item.StatusKeamanan}]</b>` : ''}</td>
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
            .summary { display: flex; margin: 16px 0; }
            .sum-box { padding: 8px 16px; border-radius: 6px; font-weight: bold; margin-right: 20px; }
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
      showAlert('Gagal', 'Terjadi kesalahan saat membuat PDF.');
    } finally {
      setExporting(false);
    }
  };

  const renderCalendar = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<View key={'e'+i} style={styles.calDay} />);
    
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = filterDate && filterDate.getDate() === i && filterDate.getMonth() === month && filterDate.getFullYear() === year;
      days.push(
        <TouchableOpacity 
          key={i} 
          style={[styles.calDay, isSelected && {backgroundColor: theme.primary}]}
          onPress={() => {
            setFilterDate(new Date(year, month, i));
            setFilterBulan('');
            setShowDatePicker(false);
          }}
        >
          <Text style={[styles.calDayText, isSelected && {color: '#fff'}]}>{i}</Text>
        </TouchableOpacity>
      );
    }
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    return (
      <View style={styles.calContainer}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => setCurrentMonthDate(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.calMonthYear}>{monthNames[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCurrentMonthDate(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.calWeekRow}>
          {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => <Text key={i} style={styles.calWeekDay}>{d}</Text>)}
        </View>
        <View style={styles.calDaysGrid}>{days}</View>
      </View>
    );
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

        <TouchableOpacity 
          style={[styles.btnFilter, filterDate && {backgroundColor: theme.secondary}]} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={18} color={filterDate ? theme.primaryDark : theme.textSecondary} />
        </TouchableOpacity>

        <View style={[styles.pickerWrap, { zIndex: 10, borderWidth: 0, backgroundColor: 'transparent' }]}>
          <DropDownPicker
            open={filterOpen}
            value={filterBulan}
            items={filterItems}
            setOpen={setFilterOpen}
            setValue={setFilterBulan}
            onChangeValue={(val) => {
              if (val) setFilterDate(null);
            }}
            setItems={setFilterItems}
            theme={isDark ? "DARK" : "LIGHT"}
            style={{ backgroundColor: theme.surface, borderColor: theme.border, minHeight: 48 }}
            dropDownContainerStyle={{ backgroundColor: theme.surface, borderColor: theme.border }}
            textStyle={{ color: theme.text, fontSize: 12 }}
            placeholder="Bulan & Tahun"
            listMode="MODAL"
            modalProps={{ animationType: "slide" }}
            modalTitle="Pilih Bulan & Tahun"
            modalTitleStyle={{ color: theme.text, fontWeight: 'bold' }}
          />
        </View>

        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: theme.surface}]}>
              {renderCalendar()}
              <TouchableOpacity style={styles.btnBatal} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.btnBatalText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {filterDate && (
           <TouchableOpacity style={styles.btnClear} onPress={() => setFilterDate(null)}>
             <Ionicons name="close-circle" size={20} color={theme.error} />
           </TouchableOpacity>
        )}

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

              {item.StatusKeamanan && item.StatusKeamanan.includes('TERDETEKSI') && (
                <View style={{ backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 1, padding: 8, borderRadius: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="warning" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: 'bold' }}>{item.StatusKeamanan}</Text>
                </View>
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
    zIndex: 10,
    elevation: 10
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
    height: 40,
    marginRight: 6
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.text,
  },
  pickerWrap: {
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 48,
    marginRight: 6
  },
  btnFilter: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  btnClear: {
    marginRight: 6,
    justifyContent: 'center'
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
    justifyContent: 'space-between',
  },
  sumCard: {
    flex: 1,
    marginHorizontal: 5,
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
  emptyText: { color: theme.textSecondary, marginTop: 16, fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 20, borderRadius: 12, shadowColor: '#000', elevation: 5 },
  calContainer: { width: '100%' },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  calMonthYear: { fontSize: 16, fontWeight: 'bold', color: theme.text },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  calWeekDay: { width: '14%', textAlign: 'center', fontWeight: 'bold', color: theme.textSecondary },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDay: { width: '14%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  calDayText: { fontSize: 14, color: theme.text },
  btnBatal: { marginTop: 20, padding: 12, backgroundColor: theme.error, borderRadius: 8, alignItems: 'center' },
  btnBatalText: { color: '#fff', fontWeight: 'bold' }
});
