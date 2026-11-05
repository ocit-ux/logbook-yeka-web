/**
 * RKB and KPI Executive Monitoring Screen
 * Displays employee monthly work plans, real-time KPI scores, task status counts,
 * 12-month performance curves, and detailed activity items.
 * Harmonized with Katulistiwa Green (#1b4d3e) and Executive Gold (#d4af37).
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
import { useTheme } from '../utils/theme';
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
  const { theme, isDark } = useTheme();

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

  // In admin mode, if targetNama is generic "Super Admin", auto-select first employee
  useEffect(() => {
    if (isAdmin && employeeList.length > 0) {
      const isGenericAdmin = !targetNama || targetNama.toLowerCase().includes('admin');
      if (isGenericAdmin) {
        const firstValidEmp = employeeList.find(e => e.Nama && !e.Nama.toLowerCase().includes('admin'));
        if (firstValidEmp && firstValidEmp.Nama) {
          setTargetNama(firstValidEmp.Nama);
          setTargetDivisi(firstValidEmp.Divisi || '');
        }
      }
    }
  }, [isAdmin, employeeList, targetNama]);

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
      setErrorMsg(err?.message || 'Gagal memuat berkas RKB dari server.');
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
        text: '#059669',
        bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5',
        border: 'rgba(16, 185, 129, 0.4)',
        label: 'Sangat Baik'
      };
    }
    if (p.includes('baik')) {
      return {
        text: isDark ? '#34d399' : '#1b4d3e',
        bg: isDark ? 'rgba(27, 77, 62, 0.3)' : '#f0fdf4',
        border: 'rgba(27, 77, 62, 0.4)',
        label: 'Baik'
      };
    }
    if (p.includes('cukup')) {
      return {
        text: '#b45309',
        bg: isDark ? 'rgba(212, 175, 55, 0.2)' : '#fefce8',
        border: 'rgba(212, 175, 55, 0.45)',
        label: 'Cukup'
      };
    }
    if (p.includes('kurang') && !p.includes('sangat')) {
      return {
        text: '#ea580c',
        bg: isDark ? 'rgba(234, 88, 12, 0.2)' : '#fff7ed',
        border: 'rgba(234, 88, 12, 0.4)',
        label: 'Kurang'
      };
    }
    return {
      text: '#dc2626',
      bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#fef2f2',
      border: 'rgba(220, 38, 38, 0.4)',
      label: 'Sangat Kurang'
    };
  }, [rkbData?.predikat, isDark]);

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
        const b = String(item.bulan || item.namaBulan || '').toLowerCase();
        return b === shortName.toLowerCase() || b === MONTH_NAMES[idx].toLowerCase() || item.month === idx + 1;
      });
      return {
        bulan: shortName,
        fullName: MONTH_NAMES[idx],
        score: found ? Number(found.score !== undefined ? found.score : found.skor) || 0 : 0
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header: Katulistiwa Green */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.7}
              accessibilityLabel="Kembali"
            >
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
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
            <ActivityIndicator size="small" color="#d4af37" />
          ) : (
            <Ionicons name="reload-outline" size={19} color="#d4af37" />
          )}
        </TouchableOpacity>
      </View>

      {/* Admin Employee Selector Bar */}
      {isAdmin && (
        <View style={[styles.adminBar, { backgroundColor: isDark ? '#1a2e26' : '#f0fdf4', borderBottomColor: theme.border }]}>
          <View style={styles.adminBarInfo}>
            <Ionicons name="person-circle-outline" size={16} color="#d4af37" style={{ marginRight: 6 }} />
            <Text style={styles.adminBarLabel}>Mode Admin:</Text>
            <Text style={[styles.adminBarTarget, { color: theme.text }]} numberOfLines={1}>
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
      <View style={[styles.monthScrollWrapper, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
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
                style={[
                  styles.monthTab,
                  {
                    backgroundColor: isSelected
                      ? theme.primary
                      : (isDark ? '#262626' : '#f3f4f6'),
                    borderColor: isSelected ? '#d4af37' : theme.border
                  }
                ]}
                onPress={() => setSelectedBulan(mName)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.monthTabText,
                    {
                      color: isSelected
                        ? '#ffffff'
                        : theme.textSecondary,
                      fontWeight: isSelected ? '800' : '600'
                    }
                  ]}
                >
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
            tintColor={theme.primary}
            colors={[theme.primary]}
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
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Mengambil berkas RKB dari server...</Text>
          </View>
        )}

        {/* Error Banner */}
        {errorMsg !== '' && !loading && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        )}

        {/* 3 Executive Metric Cards with Gold Accent */}
        <View style={styles.metricsContainer}>
          {/* Card 1: TOTAL KPI BULAN INI */}
          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>TOTAL KPI BULAN INI</Text>
              <View style={styles.scorePillBadge}>
                <Ionicons name="speedometer-outline" size={13} color={theme.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.scorePillText, { color: theme.primary }]}>Skor Capaian</Text>
              </View>
            </View>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreValue, { color: isDark ? '#34d399' : theme.primary }]}>
                {totalKpiFormatted}
              </Text>
              <Text style={[styles.scoreScale, { color: theme.textSecondary }]}>/ 100</Text>
            </View>
            <Text style={[styles.metricSubtext, { color: theme.textSecondary }]}>• Real-time active metric</Text>
          </View>

          {/* Card 2: PREDIKAT */}
          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>PREDIKAT</Text>
              <View style={[styles.scorePillBadge, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: 'rgba(212, 175, 55, 0.4)' }]}>
                <Ionicons name="ribbon-outline" size={13} color="#b45309" style={{ marginRight: 3 }} />
                <Text style={[styles.scorePillText, { color: '#b45309' }]}>Evaluasi</Text>
              </View>
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
            <Text style={[styles.metricSubtext, { color: theme.textSecondary }]}>Target Min. 80.00 (Baik)</Text>
          </View>

          {/* Card 3: STATUS KEGIATAN */}
          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>STATUS KEGIATAN</Text>
              <View style={[styles.scorePillBadge, { backgroundColor: 'rgba(27, 77, 62, 0.1)', borderColor: 'rgba(27, 77, 62, 0.3)' }]}>
                <Ionicons name="checkbox-outline" size={13} color={theme.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.scorePillText, { color: theme.primary }]}>Rincian Tugas</Text>
              </View>
            </View>
            <View style={styles.statusBadgesRow}>
              <View style={styles.statusPillSelesai}>
                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                <Text style={styles.statusPillTextSelesai}>
                  Selesai: {statusCounts.selesai}
                </Text>
              </View>
              <View style={styles.statusPillProses}>
                <Ionicons name="time" size={13} color="#d97706" />
                <Text style={styles.statusPillTextProses}>
                  Proses: {statusCounts.proses}
                </Text>
              </View>
              <View style={styles.statusPillBelum}>
                <Ionicons name="alert-circle" size={13} color="#dc2626" />
                <Text style={styles.statusPillTextBelum}>
                  Belum: {statusCounts.belum}
                </Text>
              </View>
            </View>
            <Text style={[styles.metricSubtext, { color: theme.textSecondary }]}>Total Kegiatan: {statusCounts.total}</Text>
          </View>
        </View>

        {/* Section: Yearly Performance Curve */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Tren KPI Tahunan</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Perkembangan performa tahun {selectedTahun}
              </Text>
            </View>
            <View style={[styles.tagPill, { backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : '#fefce8', borderColor: 'rgba(212, 175, 55, 0.4)' }]}>
              <Ionicons name="analytics" size={12} color="#b45309" style={{ marginRight: 4 }} />
              <Text style={[styles.tagPillText, { color: '#b45309' }]}>Performance Curve</Text>
            </View>
          </View>

          {/* Visual Bar / Curve Chart */}
          <View style={styles.chartContainer}>
            {/* 80 Target Benchmark Line */}
            <View style={[styles.benchmarkLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.benchmarkLabel, { color: theme.textSecondary }]}>Target: 80</Text>

            <View style={styles.chartBarsRow}>
              {yearlyTrend.map((item) => {
                const isCurrentMonth = item.fullName === selectedBulan;
                const score = Math.max(0, Math.min(100, item.score));
                const barHeightPercent = `${Math.max(8, score)}%`;
                const barColor = isCurrentMonth
                  ? '#d4af37'
                  : score >= 80
                  ? theme.primary
                  : score > 0
                  ? (isDark ? '#2d7a62' : '#3d8b74')
                  : (isDark ? '#333333' : '#e2e8f0');

                return (
                  <TouchableOpacity
                    key={item.bulan}
                    style={styles.chartBarCol}
                    onPress={() => setSelectedBulan(item.fullName)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.barTrack, { backgroundColor: isDark ? '#262626' : '#f1f5f9' }]}>
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
                        { color: theme.textSecondary },
                        isCurrentMonth && { color: theme.primary, fontWeight: '800' }
                      ]}
                    >
                      {item.bulan}
                    </Text>
                    <Text
                      style={[
                        styles.chartScoreLabel,
                        { color: theme.textSecondary },
                        isCurrentMonth && { color: '#b45309', fontWeight: '800' }
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
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Detail Rencana & Realisasi Kegiatan</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Daftar butir RKB periode {selectedBulan}
              </Text>
            </View>
            <View style={[styles.tagPill, { backgroundColor: 'rgba(27, 77, 62, 0.1)', borderColor: 'rgba(27, 77, 62, 0.3)' }]}>
              <Ionicons name="list" size={12} color={theme.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.tagPillText, { color: theme.primary }]}>Activities Overview</Text>
            </View>
          </View>

          {/* Activities List */}
          {(!rkbData?.activities || rkbData.activities.length === 0) ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Belum Ada Kegiatan RKB</Text>
              <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                {rkbData?.message || 'Tidak ada data rencana kerja bulanan untuk periode ini.'}
              </Text>
            </View>
          ) : (
            <View style={styles.activitiesList}>
              {rkbData.activities.map((act, index) => {
                const kode = act.kode || `KD-${String(index + 1).padStart(2, '0')}`;
                const status = String(act.status || 'Belum');
                const isSelesai = status.toLowerCase() === 'selesai' || status.toLowerCase() === 'terlaksana';
                const isProses = status.toLowerCase() === 'proses';

                let bobotDisplay = '0%';
                if (act.bobot != null && act.bobot !== '') {
                  const bNum = Number(act.bobot);
                  if (!isNaN(bNum)) {
                    bobotDisplay = (bNum <= 1 ? (bNum * 100).toFixed(0) : bNum.toFixed(0)) + '%';
                  } else {
                    bobotDisplay = String(act.bobot);
                  }
                }

                let skorDisplay = '-';
                if (act.skor != null && act.skor !== '') {
                  const sNum = Number(act.skor);
                  skorDisplay = !isNaN(sNum) ? sNum.toFixed(0) : String(act.skor);
                }

                return (
                  <View
                    key={act.id || `${kode}-${index}`}
                    style={[
                      styles.activityCard,
                      {
                        backgroundColor: isDark ? '#242424' : '#f8faf9',
                        borderColor: theme.border
                      }
                    ]}
                  >
                    {/* Activity Top Row: Kode, Bobot, Skor */}
                    <View style={styles.activityTopRow}>
                      <View style={[styles.kodeBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.kodeBadgeText}>{kode}</Text>
                      </View>

                      <View style={styles.activityMetaGroup}>
                        <View style={styles.metaPill}>
                          <Text style={[styles.metaPillLabel, { color: theme.textSecondary }]}>Bobot:</Text>
                          <Text style={[styles.metaPillVal, { color: theme.text }]}>{bobotDisplay}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Text style={[styles.metaPillLabel, { color: theme.textSecondary }]}>Skor:</Text>
                          <Text style={[styles.metaPillVal, { color: isDark ? '#34d399' : theme.primary }]}>
                            {skorDisplay}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Activity Title */}
                    <Text style={[styles.activityTitle, { color: theme.text }]}>
                      {act.kegiatan || act.uraian || 'Kegiatan RKB'}
                    </Text>

                    {/* Output / Target if available */}
                    {act.output ? (
                      <Text style={[styles.activityOutput, { color: theme.textSecondary }]}>
                        Target/Output: {act.output}
                      </Text>
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
                              ? '#059669'
                              : isProses
                              ? '#d97706'
                              : '#dc2626'
                          }
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[
                            styles.statusPillItemText,
                            {
                              color: isSelesai
                                ? '#059669'
                                : isProses
                                ? '#d97706'
                                : '#dc2626'
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
          transparent
          animationType="slide"
          onRequestClose={() => setAdminPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Pilih Personel RKB</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Pilih nama karyawan untuk melihat capaian KPI
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAdminPickerVisible(false)}
                >
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.modalSearchBox, { backgroundColor: isDark ? '#262626' : '#f1f5f9', borderColor: theme.border }]}>
                <Ionicons name="search" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.modalSearchInput, { color: theme.text }]}
                  placeholder="Cari nama atau divisi..."
                  placeholderTextColor={theme.textSecondary}
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                />
              </View>

              {loadingEmployees ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.modalLoadingText, { color: theme.textSecondary }]}>Memuat personel...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredEmployees}
                  keyExtractor={(item, idx) => item.Username || item.Nama || String(idx)}
                  renderItem={({ item }) => {
                    const isSelected = item.Nama === targetNama;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.empItem,
                          {
                            backgroundColor: isSelected
                              ? (isDark ? '#262626' : '#ecfdf5')
                              : 'transparent'
                          }
                        ]}
                        onPress={() => handleSelectEmployee(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.empAvatar, { backgroundColor: theme.primary }]}>
                          <Text style={styles.empAvatarText}>
                            {(item.Nama?.[0] || 'K').toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.empName, { color: theme.text }, isSelected && { color: theme.primary }]}>
                            {item.Nama || 'Karyawan'}
                          </Text>
                          <Text style={[styles.empDivisi, { color: theme.textSecondary }]}>{item.Divisi || '-'}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.empEmpty}>
                      <Text style={[styles.empEmptyText, { color: theme.textSecondary }]}>Personel tidak ditemukan</Text>
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
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    backgroundColor: '#d4af37',
    marginRight: 6
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#e2e8f0',
    marginTop: 2
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  adminBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1
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
    fontWeight: '600',
    flex: 1
  },
  adminSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b4d3e',
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
    borderBottomWidth: 1
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
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative'
  },
  monthTabText: {
    fontSize: 12
  },
  monthActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    width: 14,
    height: 2,
    backgroundColor: '#d4af37',
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
    marginTop: 8
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  errorBannerText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    flex: 1
  },
  metricsContainer: {
    marginBottom: 14
  },
  metricCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#d4af37',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
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
    letterSpacing: 0.8
  },
  scorePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(27, 77, 62, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 77, 62, 0.2)'
  },
  scorePillText: {
    fontSize: 10,
    fontWeight: '700'
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4
  },
  scoreValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums']
  },
  scoreScale: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6
  },
  metricSubtext: {
    fontSize: 11,
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
    color: '#059669',
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
    color: '#d97706',
    marginLeft: 4,
    fontVariant: ['tabular-nums']
  },
  statusPillBelum: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusPillTextBelum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 4,
    fontVariant: ['tabular-nums']
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderTopWidth: 4,
    borderTopColor: '#d4af37',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 14,
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700'
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
    opacity: 0.8
  },
  benchmarkLabel: {
    position: 'absolute',
    top: 22,
    right: 4,
    fontSize: 9,
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
    borderColor: '#d4af37'
  },
  chartMonthLabel: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '500'
  },
  chartScoreLabel: {
    fontSize: 8,
    marginTop: 1,
    fontVariant: ['tabular-nums']
  },
  activitiesList: {
    marginTop: 4
  },
  activityCard: {
    borderRadius: 12,
    borderWidth: 1,
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  kodeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff'
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
    marginRight: 3
  },
  metaPillVal: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4
  },
  activityOutput: {
    fontSize: 11,
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)'
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
    marginTop: 8
  },
  emptyDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    borderWidth: 1
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0
  },
  modalLoading: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  modalLoadingText: {
    fontSize: 12,
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
  empAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontWeight: '700'
  },
  empDivisi: {
    fontSize: 11
  },
  empEmpty: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  empEmptyText: {
    fontSize: 12
  }
});
