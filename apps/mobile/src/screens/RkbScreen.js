/**
 * RKB and KPI Executive Monitoring Screen
 * Displays employee monthly work plans, real-time KPI scores, task status counts,
 * 12-month performance curves, and detailed activity items.
 *
 * Rule R-02 compliant: Zero em dashes in code, strings, and comments.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchRkbDataMobile } from '../utils/rkbApi';
import { API_URL } from '../utils/api';
import axios from 'axios';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export default function RkbScreen({ user, isAdmin = false, onBack }) {
  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [selectedBulan, setSelectedBulan] = useState(MONTH_NAMES[currentMonthIndex]);
  const [selectedTahun, setSelectedTahun] = useState(currentYear);

  // Selected employee for inspection (admin mode)
  const [targetNama, setTargetNama] = useState(user?.nama || '');
  const [targetDivisi, setTargetDivisi] = useState(user?.divisi || '');

  // Admin employee picker modal state
  const [adminPickerVisible, setAdminPickerVisible] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Dashboard state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rkbData, setRkbData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch admin employee list once if admin
  useEffect(() => {
    if (isAdmin) {
      let isMounted = true;
      const fetchEmployees = async () => {
        try {
          setLoadingEmployees(true);
          const res = await axios.post(API_URL, { action: 'getAllKaryawan' });
          if (isMounted && res.data && res.data.status === 'success') {
            const rawList = Array.isArray(res.data.data)
              ? res.data.data
              : (res.data.data?.data || []);
            setEmployeeList(rawList);
          }
        } catch (_) {
          // Silent fallback for employee listing
        } finally {
          if (isMounted) setLoadingEmployees(false);
        }
      };
      fetchEmployees();
      return () => {
        isMounted = false;
      };
    }
  }, [isAdmin]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMsg('');

      const res = await fetchRkbDataMobile({
        nama: targetNama,
        divisi: targetDivisi,
        bulan: selectedBulan,
        tahun: selectedTahun,
        forceRefresh: isRefresh
      });

      setRkbData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memuat berkas RKB dari server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetNama, targetDivisi, selectedBulan, selectedTahun]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const predikatStyle = useMemo(() => {
    const p = String(rkbData?.predikat || '').toLowerCase();
    if (p.includes('sangat baik')) {
      return {
        text: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.4)',
        label: 'Sangat Baik'
      };
    }
    if (p.includes('baik')) {
      return {
        text: '#06b6d4',
        bg: 'rgba(6, 182, 212, 0.15)',
        border: 'rgba(6, 182, 212, 0.4)',
        label: 'Baik'
      };
    }
    if (p.includes('cukup')) {
      return {
        text: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.4)',
        label: 'Cukup'
      };
    }
    if (p.includes('kurang') && !p.includes('sangat')) {
      return {
        text: '#f97316',
        bg: 'rgba(249, 115, 22, 0.15)',
        border: 'rgba(249, 115, 22, 0.4)',
        label: 'Kurang'
      };
    }
    return {
      text: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.15)',
      border: 'rgba(244, 63, 94, 0.4)',
      label: 'Sangat Kurang'
    };
  }, [rkbData?.predikat]);

  const totalKpiFormatted = useMemo(() => {
    const num = Number(rkbData?.totalKpi);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }, [rkbData?.totalKpi]);

  const statusCounts = useMemo(() => {
    return {
      selesai: rkbData?.statusKegiatan?.selesai || 0,
      proses: rkbData?.statusKegiatan?.proses || 0,
      belum: rkbData?.statusKegiatan?.belum || 0,
      total: rkbData?.statusKegiatan?.total || (rkbData?.activities?.length || 0)
    };
  }, [rkbData]);

  const yearlyTrend = useMemo(() => {
    const raw = rkbData?.trenKpi || [];
    return MONTH_SHORT.map((shortName, idx) => {
      const found = raw.find((item) => {
        const b = String(item.bulan || '').toLowerCase();
        return b === shortName.toLowerCase() || b === MONTH_NAMES[idx].toLowerCase();
      });
      return {
        bulan: shortName,
        fullName: MONTH_NAMES[idx],
        score: found ? Number(found.score) || 0 : 0
      };
    });
  }, [rkbData?.trenKpi]);

  const filteredEmployees = useMemo(() => {
    const s = employeeSearch.trim().toLowerCase();
    if (!s) return employeeList;
    return employeeList.filter((emp) =>
      String(emp.Nama || '').toLowerCase().includes(s) ||
      String(emp.Divisi || '').toLowerCase().includes(s)
    );
  }, [employeeList, employeeSearch]);

  const handleSelectEmployee = (emp) => {
    setTargetNama(emp.Nama || '');
    setTargetDivisi(emp.Divisi || '');
    setAdminPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.7}
              accessibilityLabel="Kembali"
            >
              <Ionicons name="arrow-back" size={20} color="#f8fafc" />
            </TouchableOpacity>
          )}
          <View style={styles.titleGroup}>
            <View style={styles.badgeLiveRow}>
              <View style={styles.pulsingDot} />
              <Text style={styles.headerTitle}>Dashboard KPI YEKA</Text>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Selamat datang, {targetNama || user?.nama || 'Karyawan'} • Periode: {selectedBulan} {selectedTahun}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadData(true)}
          disabled={loading || refreshing}
          activeOpacity={0.7}
          accessibilityLabel="Perbarui Data"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : (
            <Ionicons name="reload-outline" size={19} color="#10b981" />
          )}
        </TouchableOpacity>
      </View>

      {/* Admin Employee Selector Bar */}
      {isAdmin && (
        <View style={styles.adminBar}>
          <View style={styles.adminBarInfo}>
            <Ionicons name="person-circle-outline" size={16} color="#d4af37" style={{ marginRight: 6 }} />
            <Text style={styles.adminBarLabel}>Mode Admin:</Text>
            <Text style={styles.adminBarTarget} numberOfLines={1}>
              {targetNama || 'Pilih Personel'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.adminSwitchBtn}
            onPress={() => setAdminPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.adminSwitchText}>Ganti Personel</Text>
            <Ionicons name="chevron-forward" size={14} color="#d4af37" />
          </TouchableOpacity>
        </View>
      )}

      {/* Month Selector Tabs */}
      <View style={styles.monthScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthScrollContent}
        >
          {MONTH_NAMES.map((mName, idx) => {
            const isSelected = selectedBulan === mName;
            return (
              <TouchableOpacity
                key={mName}
                style={[styles.monthTab, isSelected && styles.monthTabActive]}
                onPress={() => setSelectedBulan(mName)}
                activeOpacity={0.75}
              >
                <Text style={[styles.monthTabText, isSelected && styles.monthTabTextActive]}>
                  {MONTH_SHORT[idx]}
                </Text>
                {isSelected && <View style={styles.monthActiveIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {/* Offline Cache Notice */}
        {rkbData?.fromCache && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={15} color="#f59e0b" style={{ marginRight: 6 }} />
            <Text style={styles.offlineNoticeText}>
              Mode Offline: Menampilkan data tersimpan lokal
            </Text>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && !refreshing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Mengambil berkas RKB dari server...</Text>
          </View>
        )}

        {/* Error Banner */}
        {errorMsg !== '' && !loading && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#f43f5e" style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        )}

        {/* 3 Executive Metric Cards */}
        <View style={styles.metricsContainer}>
          {/* Card 1: TOTAL KPI BULAN INI */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>TOTAL KPI BULAN INI</Text>
              <Ionicons name="speedometer-outline" size={16} color="#10b981" />
            </View>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreValue}>{totalKpiFormatted}</Text>
              <Text style={styles.scoreScale}>/ 100</Text>
            </View>
            <Text style={styles.metricSubtext}>• Real-time active metric</Text>
          </View>

          {/* Card 2: PREDIKAT */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>PREDIKAT</Text>
              <Ionicons name="ribbon-outline" size={16} color={predikatStyle.text} />
            </View>
            <View style={styles.predikatWrapper}>
              <View
                style={[
                  styles.predikatBadge,
                  {
                    backgroundColor: predikatStyle.bg,
                    borderColor: predikatStyle.border
                  }
                ]}
              >
                <Text style={[styles.predikatText, { color: predikatStyle.text }]}>
                  {predikatStyle.label}
                </Text>
              </View>
            </View>
            <Text style={styles.metricSubtext}>Target Min. 80.00 (Baik)</Text>
          </View>

          {/* Card 3: STATUS KEGIATAN */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>STATUS KEGIATAN</Text>
              <Ionicons name="checkbox-outline" size={16} color="#38bdf8" />
            </View>
            <View style={styles.statusBadgesRow}>
              <View style={styles.statusPillSelesai}>
                <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                <Text style={styles.statusPillTextSelesai}>
                  Selesai: {statusCounts.selesai}
                </Text>
              </View>
              <View style={styles.statusPillProses}>
                <Ionicons name="time" size={13} color="#f59e0b" />
                <Text style={styles.statusPillTextProses}>
                  Proses: {statusCounts.proses}
                </Text>
              </View>
              <View style={styles.statusPillBelum}>
                <Ionicons name="alert-circle" size={13} color="#f43f5e" />
                <Text style={styles.statusPillTextBelum}>
                  Belum: {statusCounts.belum}
                </Text>
              </View>
            </View>
            <Text style={styles.metricSubtext}>Total Kegiatan: {statusCounts.total}</Text>
          </View>
        </View>

        {/* Section: Yearly Performance Curve */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Tren KPI Tahunan</Text>
              <Text style={styles.sectionSubtitle}>
                Perkembangan performa tahun {selectedTahun}
              </Text>
            </View>
            <View style={styles.tagPill}>
              <Ionicons name="analytics" size={12} color="#10b981" style={{ marginRight: 4 }} />
              <Text style={styles.tagPillText}>Performance Curve</Text>
            </View>
          </View>

          {/* Visual Bar / Curve Chart */}
          <View style={styles.chartContainer}>
            {/* 80 Target Benchmark Line */}
            <View style={styles.benchmarkLine} />
            <Text style={styles.benchmarkLabel}>Target: 80</Text>

            <View style={styles.chartBarsRow}>
              {yearlyTrend.map((item) => {
                const isCurrentMonth = item.fullName === selectedBulan;
                const score = Math.max(0, Math.min(100, item.score));
                const barHeightPercent = `${Math.max(6, score)}%`;
                const barColor =
                  score >= 80 ? '#10b981' : score > 0 ? '#06b6d4' : '#1e293b';

                return (
                  <TouchableOpacity
                    key={item.bulan}
                    style={styles.chartBarCol}
                    onPress={() => setSelectedBulan(item.fullName)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: barHeightPercent,
                            backgroundColor: barColor
                          },
                          isCurrentMonth && styles.barFillActive
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.chartMonthLabel,
                        isCurrentMonth && styles.chartMonthLabelActive
                      ]}
                    >
                      {item.bulan}
                    </Text>
                    <Text
                      style={[
                        styles.chartScoreLabel,
                        isCurrentMonth && styles.chartScoreLabelActive
                      ]}
                    >
                      {score > 0 ? Math.round(score) : '-'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Section: Activities Overview */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Detail Rencana & Realisasi Kegiatan</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar butir RKB periode {selectedBulan}
              </Text>
            </View>
            <View style={styles.tagPill}>
              <Ionicons name="list" size={12} color="#38bdf8" style={{ marginRight: 4 }} />
              <Text style={[styles.tagPillText, { color: '#38bdf8' }]}>Activities Overview</Text>
            </View>
          </View>

          {/* Activities List */}
          {(!rkbData?.activities || rkbData.activities.length === 0) ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color="#475569" />
              <Text style={styles.emptyTitle}>Belum Ada Kegiatan RKB</Text>
              <Text style={styles.emptyDesc}>
                {rkbData?.message || 'Tidak ada data rencana kerja bulanan untuk periode ini.'}
              </Text>
            </View>
          ) : (
            <View style={styles.activitiesList}>
              {rkbData.activities.map((act, index) => {
                const kode = act.kode || `KD-${String(index + 1).padStart(2, '0')}`;
                const status = String(act.status || 'Belum');
                const isSelesai = status.toLowerCase() === 'selesai';
                const isProses = status.toLowerCase() === 'proses';

                return (
                  <View key={act.id || `${kode}-${index}`} style={styles.activityCard}>
                    {/* Activity Top Row: Kode, Bobot, Skor */}
                    <View style={styles.activityTopRow}>
                      <View style={styles.kodeBadge}>
                        <Text style={styles.kodeBadgeText}>{kode}</Text>
                      </View>

                      <View style={styles.activityMetaGroup}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillLabel}>Bobot:</Text>
                          <Text style={styles.metaPillVal}>{act.bobot || '0%'}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillLabel}>Skor:</Text>
                          <Text style={styles.metaPillVal}>{act.skor !== undefined ? act.skor : '-'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Activity Title */}
                    <Text style={styles.activityTitle}>
                      {act.kegiatan || act.uraian || 'Kegiatan RKB'}
                    </Text>

                    {/* Output / Target if available */}
                    {act.output ? (
                      <Text style={styles.activityOutput}>Output: {act.output}</Text>
                    ) : null}

                    {/* Activity Footer Row: Status Pill */}
                    <View style={styles.activityFooterRow}>
                      <View
                        style={[
                          styles.statusPillItem,
                          isSelesai
                            ? styles.statusPillItemSelesai
                            : isProses
                            ? styles.statusPillItemProses
                            : styles.statusPillItemBelum
                        ]}
                      >
                        <Ionicons
                          name={
                            isSelesai
                              ? 'checkmark-circle'
                              : isProses
                              ? 'time'
                              : 'alert-circle'
                          }
                          size={14}
                          color={
                            isSelesai
                              ? '#10b981'
                              : isProses
                              ? '#f59e0b'
                              : '#f43f5e'
                          }
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[
                            styles.statusPillItemText,
                            {
                              color: isSelesai
                                ? '#10b981'
                                : isProses
                                ? '#f59e0b'
                                : '#f43f5e'
                            }
                          ]}
                        >
                          {status}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Admin Employee Picker Modal */}
      {isAdmin && (
        <Modal
          visible={adminPickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAdminPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Pilih Personel</Text>
                  <Text style={styles.modalSubtitle}>Pilih berkas RKB karyawan untuk dipantau</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAdminPickerVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearchBox}>
                <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Cari nama atau divisi..."
                  placeholderTextColor="#64748b"
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                />
              </View>

              {loadingEmployees ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <Text style={styles.modalLoadingText}>Memuat personel...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredEmployees}
                  keyExtractor={(item, idx) => item.Username || item.Nama || String(idx)}
                  renderItem={({ item }) => {
                    const isSelected = item.Nama === targetNama;
                    return (
                      <TouchableOpacity
                        style={[styles.empItem, isSelected && styles.empItemActive]}
                        onPress={() => handleSelectEmployee(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.empAvatar}>
                          <Text style={styles.empAvatarText}>
                            {(item.Nama?.[0] || 'K').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.empName, isSelected && styles.empNameActive]}>
                            {item.Nama || 'Karyawan'}
                          </Text>
                          <Text style={styles.empDivisi}>{item.Divisi || '-'}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.empEmpty}>
                      <Text style={styles.empEmptyText}>Personel tidak ditemukan</Text>
                    </View>
                  }
                  style={{ maxHeight: 380 }}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19'
  },
  header: {
    backgroundColor: '#131b2e',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  titleGroup: {
    flex: 1
  },
  badgeLiveRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center'
  },
  adminBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#162238',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  adminBarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  adminBarLabel: {
    fontSize: 11,
    color: '#d4af37',
    fontWeight: '700',
    marginRight: 6
  },
  adminBarTarget: {
    fontSize: 11,
    color: '#f8fafc',
    fontWeight: '600',
    flex: 1
  },
  adminSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d4af37'
  },
  adminSwitchText: {
    fontSize: 11,
    color: '#d4af37',
    fontWeight: '700',
    marginRight: 2
  },
  monthScrollWrapper: {
    backgroundColor: '#131b2e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  monthScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  monthTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    position: 'relative'
  },
  monthTabActive: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981'
  },
  monthTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8'
  },
  monthTabTextActive: {
    color: '#34d399',
    fontWeight: '800'
  },
  monthActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    width: 14,
    height: 2,
    backgroundColor: '#10b981',
    borderRadius: 1
  },
  content: {
    flex: 1,
    padding: 14
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12
  },
  offlineNoticeText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600'
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  errorBannerText: {
    fontSize: 12,
    color: '#f43f5e',
    fontWeight: '600',
    flex: 1
  },
  metricsContainer: {
    marginBottom: 14
  },
  metricCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 10
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4
  },
  scoreValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: -1,
    fontVariant: ['tabular-nums']
  },
  scoreScale: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 6
  },
  metricSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4
  },
  predikatWrapper: {
    marginVertical: 4
  },
  predikatBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1
  },
  predikatText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6
  },
  statusPillSelesai: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusPillTextSelesai: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 4,
    fontVariant: ['tabular-nums']
  },
  statusPillProses: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusPillTextProses: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 4,
    fontVariant: ['tabular-nums']
  },
  statusPillBelum: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusPillTextBelum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f43f5e',
    marginLeft: 4,
    fontVariant: ['tabular-nums']
  },
  sectionCard: {
    backgroundColor: '#131b2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 14
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981'
  },
  chartContainer: {
    height: 140,
    justifyContent: 'flex-end',
    position: 'relative',
    paddingTop: 20
  },
  benchmarkLine: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#334155',
    opacity: 0.8
  },
  benchmarkLabel: {
    position: 'absolute',
    top: 22,
    right: 4,
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600'
  },
  chartBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end'
  },
  barTrack: {
    width: 8,
    height: 70,
    backgroundColor: '#0b0f19',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    width: '100%',
    borderRadius: 4
  },
  barFillActive: {
    borderWidth: 1,
    borderColor: '#34d399'
  },
  chartMonthLabel: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500'
  },
  chartMonthLabelActive: {
    color: '#10b981',
    fontWeight: '800'
  },
  chartScoreLabel: {
    fontSize: 8,
    color: '#475569',
    marginTop: 1,
    fontVariant: ['tabular-nums']
  },
  chartScoreLabelActive: {
    color: '#34d399',
    fontWeight: '700'
  },
  activitiesList: {
    marginTop: 4
  },
  activityCard: {
    backgroundColor: '#0b0f19',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 8
  },
  activityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  kodeBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  kodeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8'
  },
  activityMetaGroup: {
    flexDirection: 'row',
    gap: 8
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaPillLabel: {
    fontSize: 10,
    color: '#64748b',
    marginRight: 3
  },
  metaPillVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
    fontVariant: ['tabular-nums']
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: 18,
    marginBottom: 4
  },
  activityOutput: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6
  },
  activityFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4
  },
  statusPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  statusPillItemSelesai: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)'
  },
  statusPillItemProses: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)'
  },
  statusPillItemBelum: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.35)'
  },
  statusPillItemText: {
    fontSize: 11,
    fontWeight: '700'
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8
  },
  emptyDesc: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: '#131b2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#f8fafc',
    padding: 0
  },
  modalLoading: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  modalLoadingText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6
  },
  empItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4
  },
  empItemActive: {
    backgroundColor: '#1e293b'
  },
  empAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0b0f19',
    borderWidth: 1,
    borderColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  empAvatarText: {
    color: '#d4af37',
    fontSize: 13,
    fontWeight: '800'
  },
  empName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  empNameActive: {
    color: '#10b981'
  },
  empDivisi: {
    fontSize: 11,
    color: '#64748b'
  },
  empEmpty: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  empEmptyText: {
    fontSize: 12,
    color: '#64748b'
  }
});
