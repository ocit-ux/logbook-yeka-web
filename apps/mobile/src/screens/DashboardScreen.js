import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, TextInput, ActivityIndicator, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import DropDownPicker from 'react-native-dropdown-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { registerForPushNotificationsAsync, scheduleDailyReminder, cancelTodayReminder } from '../utils/notifications';
import { showAlert } from '../utils/alert';
import { getDeviceInfo, isMockedLocation, isDeviceRooted } from '../utils/device';
import WebCamera from '../components/WebCamera';
import NativeCamera from '../components/NativeCamera';

const JSWheelPicker = ({ items, selectedValue, onValueChange, theme }) => {
  const itemHeight = 50;
  const scrollViewRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, items.indexOf(selectedValue)));
  const snapOffsets = React.useMemo(() => items.map((_, i) => i * itemHeight), [items]);

  React.useEffect(() => {
    const idx = Math.max(0, items.indexOf(selectedValue));
    setActiveIndex(idx);
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: idx * itemHeight, animated: false });
      }
    }, 50);
  }, []); // Only run on mount!

  return (
    <View style={{ height: itemHeight * 5, overflow: 'hidden', flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        onScroll={(e) => {
          const offset = Math.max(0, e.nativeEvent.contentOffset.y);
          const idx = Math.floor((offset + itemHeight / 2) / itemHeight);
          const validIdx = Math.max(0, Math.min(items.length - 1, idx));
          if (validIdx !== activeIndex && items[validIdx]) {
            setActiveIndex(validIdx); // Update local visual state only
            // ponytail: web lacks momentumScrollEnd; only update parent on web so Android APK stays unimpacted
            if (Platform.OS === 'web') {
              onValueChange(items[validIdx]);
            }
          }
        }}
        onMomentumScrollEnd={(e) => {
          const offset = Math.max(0, e.nativeEvent.contentOffset.y);
          const idx = Math.floor((offset + itemHeight / 2) / itemHeight);
          const validIdx = Math.max(0, Math.min(items.length - 1, idx));
          if (items[validIdx]) onValueChange(items[validIdx]); // Update parent when settled
        }}
        onScrollEndDrag={(e) => {
          const offset = Math.max(0, e.nativeEvent.contentOffset.y);
          const idx = Math.floor((offset + itemHeight / 2) / itemHeight);
          const validIdx = Math.max(0, Math.min(items.length - 1, idx));
          if (items[validIdx]) onValueChange(items[validIdx]); // Update parent if drag ends
        }}
        scrollEventThrottle={16}
      >
        <View style={{ height: itemHeight * 2 }} />
        {items.map((item, index) => (
          <TouchableOpacity 
            key={item} 
            style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => {
              setActiveIndex(index);
              onValueChange(item);
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({ y: index * itemHeight, animated: true });
              }
            }}
          >
            <Text style={{ fontSize: index === activeIndex ? 26 : 20, fontWeight: index === activeIndex ? 'bold' : 'normal', color: index === activeIndex ? theme.text : theme.textSecondary }}>{item}</Text>
          </TouchableOpacity>
        ))}
        {/* Bantalan presisi agar angka terakhir tetap di tengah pembatas (hanya +2px untuk bug sub-pixel Android) */}
        <View style={{ height: itemHeight * 2 + 2 }} />
      </ScrollView>
      <View style={{ position: 'absolute', top: itemHeight * 2, width: '100%', height: itemHeight, borderTopWidth: 2, borderBottomWidth: 2, borderColor: theme.primary, pointerEvents: 'none', borderRadius: 8 }} />
    </View>
  );
};



export default function DashboardScreen({ user, onLogout }) {
  const { theme, isDark } = useTheme();
  const [location, setLocation] = useState(null);
  const [wilayah, setWilayah] = useState('');
  const [isMocked, setIsMocked] = useState(false);
  const [isRooted, setIsRooted] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [syncCount, setSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = React.useRef(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  const [mode, setMode] = useState('hadir'); // 'hadir' | 'izin'
  const [showCameraModal, setShowCameraModal] = useState(false);
  
  const [timePickerModal, setTimePickerModal] = useState(null); // 'mulai' | 'akhir' | null
  const [pickerHour, setPickerHour] = useState('08');
  const [pickerMinute, setPickerMinute] = useState('00');
  
  const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));
  
  const [izinOpen, setIzinOpen] = useState(false);
  const [pilihanIzin, setPilihanIzin] = useState([
    {label: 'Sakit', value: 'Sakit'},
    {label: 'Izin Keperluan Keluarga', value: 'Izin Keperluan Keluarga'},
    {label: 'WFH', value: 'WFH'},
    {label: 'Lain - Lain', value: 'Lain - Lain'}
  ]);
  
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const [form, setForm] = useState({
    jamMulai: getCurrentTime(),
    jamAkhir: getCurrentTime(),
    kegiatan: '',
    hasil: '',
    kategoriIzin: 'Sakit',
    keteranganIzin: ''
  });

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setPhoto(null); // Mencegah foto kehadiran nempel ke form izin (bug fix)
    }
  };

  const fetchWilayahAsync = async (latitude, longitude) => {
    if (latitude == null || longitude == null) return;
    try {
      let wilayahText = '';
      if (Platform.OS !== 'web') {
        try {
          const res = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (res && res.length > 0) {
            const item = res[0];
            const parts = [
              item.district || item.subregion,
              item.city || item.region
            ].filter(Boolean);
            if (parts.length > 0) {
              wilayahText = parts.join(', ');
            }
          }
        } catch (locErr) {
          // Fallback ke backend API jika reverseGeocode native tidak tersedia
        }
      }

      if (!wilayahText) {
        try {
          const apiRes = await axios.post(
            API_URL,
            { action: 'reverseGeocode', data: { gps: `${latitude},${longitude}` } },
            { timeout: 8000 }
          );
          if (apiRes.data?.status === 'success' && apiRes.data?.data) {
            const d = apiRes.data.data;
            if (typeof d === 'string') {
              wilayahText = d;
            } else if (typeof d === 'object') {
              const parts = [d.desa, d.kecamatan, d.kabupaten].filter(p => p && p !== '-');
              wilayahText = parts.join(', ');
            }
          }
        } catch (apiErr) {}
      }

      if (wilayahText) {
        setWilayah(wilayahText);
        AsyncStorage.setItem(
          '@last_known_wilayah',
          JSON.stringify({ latitude, longitude, wilayahText, timestamp: Date.now() })
        ).catch(() => {});
      }
    } catch (err) {}
  };

  useEffect(() => {
    // Jalankan semua inisialisasi secara paralel agar tidak blocking satu sama lain
    Promise.all([
      // 1. GPS: coba cache dulu, kalau tidak ada baru minta dari hardware
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Izin Ditolak', 'Izin lokasi GPS dibutuhkan untuk absensi.');
          return;
        }
        try {
          const lastLoc = await AsyncStorage.getItem('@last_known_location');
          if (lastLoc) {
            const parsedLoc = JSON.parse(lastLoc);
            if (parsedLoc.timestamp && (Date.now() - parsedLoc.timestamp < 300000)) {
              setLocation(parsedLoc);
            } else {
              await AsyncStorage.removeItem('@last_known_location');
            }
          }
          const lastWil = await AsyncStorage.getItem('@last_known_wilayah');
          if (lastWil) {
            const parsedWil = JSON.parse(lastWil);
            if (parsedWil.wilayahText) {
              setWilayah(parsedWil.wilayahText);
            }
          }
          
          const qStr = await AsyncStorage.getItem('@offline_queue');
          if (qStr) {
            const qArr = JSON.parse(qStr);
            setSyncCount(qArr.length);
          }
        } catch(e) {}
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 10000
        }).then(loc => {
          if (isMockedLocation(loc)) {
            setIsMocked(true);
            setLocation(null);
            return;
          }
          setIsMocked(false);
          const freshCoords = { ...loc.coords, timestamp: Date.now() };
          setLocation(freshCoords);
          AsyncStorage.setItem('@last_known_location', JSON.stringify(freshCoords));
          fetchWilayahAsync(freshCoords.latitude, freshCoords.longitude);
        }).catch(() => {});
      })(),

      // 2. PilihanIzin: cache di AsyncStorage, hanya fetch ulang sekali sehari
      (async () => {
        try {
          const cached = await AsyncStorage.getItem('@pilihan_izin_cache');
          if (cached) setPilihanIzin(JSON.parse(cached));
          // Fetch terbaru di background tanpa blocking
          axios.post(API_URL, { action: 'getPilihanIzin' }, { timeout: 10000 })
            .then(res => {
              if (res.data?.status === 'success' && res.data?.data?.data?.length > 0) {
                const mapped = res.data.data.data.map(item => ({ label: item, value: item }));
                setPilihanIzin(mapped);
                AsyncStorage.setItem('@pilihan_izin_cache', JSON.stringify(mapped));
              }
            }).catch(() => {});
        } catch(e) {}
      })(),

      // 3. Notifikasi: pastikan jadwal lokal harian aktif jika belum absen hari ini
      (async () => {
        const hasPermission = await registerForPushNotificationsAsync();
        if (hasPermission) {
          const lastSubmitDate = await AsyncStorage.getItem('@last_submit_date');
          const today = new Date().toDateString();
          
          try {
            if (lastSubmitDate !== today) {
              await scheduleDailyReminder();
            } else {
              // Sudah absen hari ini, hapus sisa jadwal jika ada
              await cancelTodayReminder();
            }
          } catch (error) {
            console.log('Push notification scheduler error:', error);
          }
        }
      })(),

      // 4. Keamanan: Deteksi perangkat Root / Jailbreak
      (async () => {
        const rooted = await isDeviceRooted();
        if (rooted) setIsRooted(true);
      })(),

      loadDraft()
    ]);
  }, []);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem('@absensi_draft');
      if (draft) setForm(JSON.parse(draft));

      // Web: Pulihkan mode & foto yang tersimpan sebelum kamera dibuka
      if (Platform.OS === 'web') {
        try {
          const savedMode = sessionStorage.getItem('@web_mode');
          if (savedMode) setMode(savedMode);

          const savedPhoto = sessionStorage.getItem('@web_photo');
          if (savedPhoto) setPhoto(JSON.parse(savedPhoto));
          
          // Bersihkan setelah dipulihkan agar tidak stuck jika user sengaja refresh
          sessionStorage.removeItem('@web_mode');
          sessionStorage.removeItem('@web_photo');
        } catch(e) {}
      }
    } catch (e) {}
  };

  const saveDraft = async (newForm) => {
    try {
      await AsyncStorage.setItem('@absensi_draft', JSON.stringify(newForm));
    } catch (e) {}
  };

  const handleInputChange = (field, value) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    saveDraft(newForm);
  };

  const takePicture = async () => {
    if (Platform.OS === 'web') {
      // Simpan seluruh state sebelum kamera dibuka (antisipasi RAM web)
      try {
        sessionStorage.setItem('@web_mode', mode);
        if (photo) sessionStorage.setItem('@web_photo', JSON.stringify(photo));
      } catch(e) {}
    }
    // Tampilkan Modal Kamera In-App (baik Web maupun Native)
    setShowCameraModal(true);
  };

  const processQueue = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      setIsSyncing(true);
      const queueStr = await AsyncStorage.getItem('@offline_queue');
      let queue = queueStr ? JSON.parse(queueStr) : [];
      setSyncCount(queue.length);
      
      if (queue.length === 0) {
        setIsSyncing(false);
        return;
      }

      // Ambil data pertama
      const item = queue[0];
      if (item && item.payload && !item.payload.submissionId) {
        item.payload.submissionId = `${item.payload.email || 'user'}_${item.id || Date.now()}`;
      }

      // Kirim ke server
      const response = await axios.post(API_URL, {
        action: 'submitAttendance',
        data: item.payload
      }, { timeout: 25000 });

      const resData = response.data;
      if (resData.status === 'success') {
        // Berhasil, buang dari antrean
        queue.shift();
        await AsyncStorage.setItem('@offline_queue', JSON.stringify(queue));
        
        // Cek lagi sisa antrean
        setSyncCount(queue.length);
        
        // Simpan tanggal submit dan batalkan notifikasi
        await AsyncStorage.setItem('@last_submit_date', new Date().toDateString());
        try { await cancelTodayReminder(); } catch (e) {}

        // Tampilkan pesan sukses sebentar tanpa pop-up
        setSyncSuccessMsg('✅ Jurnal berhasil terkirim ke server admin!');
        setTimeout(() => setSyncSuccessMsg(''), 6000); // Hilang otomatis dalam 6 detik

        // Jika masih ada antrean, rekursif
        if (queue.length > 0) {
          setIsSyncing(false);
          isSyncingRef.current = false;
          setTimeout(processQueue, 2000); // jeda 2 detik antar kiriman
          return;
        }
      } else {
        // Gagal logika server (misal duplikat), buang dari antrean agar tidak nyangkut
        queue.shift();
        await AsyncStorage.setItem('@offline_queue', JSON.stringify(queue));
        setSyncCount(queue.length);
      }
    } catch (err) {
      // Gagal jaringan: biarkan di antrean untuk dicoba lagi nanti
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // Jalankan pekerja latar belakang tiap 15 detik untuk sinkronisasi
    const timer = setInterval(() => {
      processQueue();
    }, 15000);
    
    // Coba langsung saat komponen dimuat (jeda 3 detik)
    setTimeout(processQueue, 3000);
    
    return () => clearInterval(timer);
  }, []);

  const submitAbsensi = async () => {
    if (loading) return;
    if (mode === 'hadir' || (mode === 'izin' && form.kategoriIzin === 'WFH')) {
      if (!form.jamMulai || !form.jamAkhir || !form.kegiatan) {
        showAlert('Inkomplit', 'Jam mulai, selesai, dan kegiatan wajib diisi.'); return;
      }
      if (!photo) {
        showAlert('Wajib Foto', 'Bukti foto lokasi/kegiatan diwajibkan!'); return;
      }
    }

    if (mode === 'izin') {
      if (!form.kategoriIzin) {
        showAlert('Inkomplit', 'Kategori keterangan izin wajib diisi.'); return;
      }
    }

    setLoading(true);

    const rooted = isRooted || (await isDeviceRooted());
    if (rooted) setIsRooted(true);

    let currentCoords = (location && location.timestamp && (Date.now() - location.timestamp < 300000)) ? location : null;
    let isCurrentMocked = isMocked;
    try {
      const freshLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 10000,
        timeout: 15000
      });
      isCurrentMocked = isMockedLocation(freshLoc);
      setIsMocked(isCurrentMocked);
      const freshCoords = { ...freshLoc.coords, timestamp: Date.now() };
      currentCoords = freshCoords;
      setLocation(freshCoords);
      AsyncStorage.setItem('@last_known_location', JSON.stringify(freshCoords));
    } catch (e) {}

    if (!currentCoords) {
      setLoading(false);
      showAlert('Tunggu', 'Sedang mengunci lokasi GPS...');
      return;
    }

    let statusKeamanan = 'AMAN (GPS Asli)';
    if (isCurrentMocked && rooted) {
      statusKeamanan = '⚠️ TERDETEKSI FAKE GPS & ROOT';
    } else if (isCurrentMocked) {
      statusKeamanan = '⚠️ TERDETEKSI FAKE GPS';
    } else if (rooted) {
      statusKeamanan = '⚠️ TERDETEKSI HP ROOT';
    }
    
    const isWfh = mode === 'izin' && form.kategoriIzin === 'WFH';
    
    const deviceInfo = await getDeviceInfo();
    const submissionId = `${user?.email || 'user'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    
    const payload = {
        submissionId,
        nama: user?.nama || "Test User",
        email: user?.email || "test@test.com",
        telepon: user?.telepon || "-",
        jabatan: user?.jabatan || "Staff",
        devisi: user?.devisi || "-",
        status: mode.toUpperCase(),
        jamMulai: (mode === 'hadir' || isWfh) ? form.jamMulai : "-",
        jamAkhir: (mode === 'hadir' || isWfh) ? form.jamAkhir : "-",
        kegiatan: (mode === 'hadir' || isWfh) ? form.kegiatan : "-",
        hasil_kegiatan: (mode === 'hadir' || isWfh) ? form.hasil : "-",
        izin_sakit: mode === 'izin' ? (isWfh ? "WFH" : `${form.kategoriIzin} - ${form.keteranganIzin}`) : "-",
        gps: `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`,
        foto: photo?.base64 || "",
        device: deviceInfo,
        statusKeamanan: statusKeamanan
    };

    try {
      // 1. Simpan ke antrean offline terlebih dahulu (Offline-First)
      const queueStr = await AsyncStorage.getItem('@offline_queue');
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push({ id: Date.now(), payload });
      await AsyncStorage.setItem('@offline_queue', JSON.stringify(queue));
      setSyncCount(queue.length);
      
      // 2. Reset form & UI seketika
      await AsyncStorage.removeItem('@absensi_draft');
      setForm({ jamMulai: '', jamAkhir: '', kegiatan: '', hasil: '', kategoriIzin: 'Sakit', keteranganIzin: '' });
      setPhoto(null);
      if (statusKeamanan !== 'AMAN (GPS Asli)') {
        showAlert('Jurnal Tersimpan', 'Jurnal absensi disimpan offline. Catatan integritas perangkat & lokasi terekam pada sistem HRD.');
      } else {
        showAlert('Masuk Antrean', 'Jurnal absensi disimpan offline. Sedang dikirim ke server secara otomatis di latar belakang...');
      }

      // 3. Pancing pemrosesan antrean
      setTimeout(processQueue, 1000);
      
    } catch (err) {
      showAlert('Error', 'Gagal memproses ke antrean penyimpanan lokal.');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(theme);



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Halo, {user?.nama?.split(' ')[0] || 'Karyawan'} 👋</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Toggle Mode */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'hadir' && styles.toggleActive]} onPress={() => handleModeChange('hadir')}>
            <Ionicons name="briefcase-outline" size={18} color={mode === 'hadir' ? '#fff' : theme.textSecondary} style={{marginRight: 6}} />
            <Text style={[styles.toggleText, mode === 'hadir' && { color: '#fff' }]}>Form Hadir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'izin' && styles.toggleActive]} onPress={() => handleModeChange('izin')}>
            <Ionicons name="medkit-outline" size={18} color={mode === 'izin' ? '#fff' : theme.textSecondary} style={{marginRight: 6}} />
            <Text style={[styles.toggleText, mode === 'izin' && { color: '#fff' }]}>Izin / Sakit</Text>
          </TouchableOpacity>
        </View>

        {/* Foto Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'hadir' ? 'Foto Lokasi / Lookbook' : 'Foto Lokasi / Bukti (Opsional)'}
          </Text>
          {photo ? (
            <View style={{ alignItems: 'center' }}>
              <Image source={{ uri: photo.uri || `data:image/jpg;base64,${photo.base64}` }} style={styles.previewImage} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                <TouchableOpacity style={[styles.retakeBtn, { marginRight: 10 }]} onPress={takePicture}>
                  <Ionicons name="camera-outline" size={18} color="#fff" style={{marginRight: 6}} />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ulangi Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.retakeBtn, { backgroundColor: theme.error }]} onPress={() => setPhoto(null)}>
                  <Ionicons name="trash-outline" size={18} color="#fff" style={{marginRight: 6}} />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Hapus Foto</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.cameraPlaceholder} onPress={takePicture}>
              <Ionicons name="camera" size={40} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Ketuk untuk Ambil Foto</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kategori Izin (HANYA MUNCUL JIKA MODE === 'izin') */}
        {mode === 'izin' && (
          <View style={[styles.card, { zIndex: 10 }]}>
            <Text style={styles.cardTitle}>Keterangan Izin / Sakit</Text>
            <View style={{ marginBottom: 10 }}>
              <DropDownPicker
                open={izinOpen}
                value={form.kategoriIzin}
                items={pilihanIzin}
                setOpen={setIzinOpen}
                setValue={(callback) => {
                  const val = callback(form.kategoriIzin);
                  handleInputChange('kategoriIzin', val);
                }}
                setItems={setPilihanIzin}
                theme={isDark ? "DARK" : "LIGHT"}
                style={{ backgroundColor: theme.background, borderColor: theme.border }}
                dropDownContainerStyle={{ backgroundColor: theme.background, borderColor: theme.border }}
                textStyle={{ color: theme.text }}
                listMode="SCROLLVIEW"
              />
            </View>
            {form.kategoriIzin !== 'WFH' && (
              <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top', marginTop: 16 }]} placeholder="Keterangan tambahan (Alasan lengkap)" placeholderTextColor={theme.textSecondary} multiline value={form.keteranganIzin} onChangeText={(t) => handleInputChange('keteranganIzin', t)} />
            )}
          </View>
        )}

        {/* Waktu Jurnal & Kegiatan (MUNCUL JIKA HADIR, ATAU JIKA IZIN & WFH) */}
        {(mode === 'hadir' || (mode === 'izin' && form.kategoriIzin === 'WFH')) && (
          <>
            <View style={[styles.card, { zIndex: 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.cardTitle, {marginBottom: 0}]}>Waktu Jurnal</Text>
                <TouchableOpacity 
                  onPress={() => {
                    const now = new Date();
                    handleInputChange('jamAkhir', `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
                  }}
                  style={{ backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>Jam Selesai = Sekarang</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.label}>Jam Mulai</Text>
                  <TouchableOpacity 
                    style={[styles.input, {justifyContent: 'center', backgroundColor: theme.background}]} 
                    onPress={() => {
                      if (form.jamMulai) {
                        const [h,m] = form.jamMulai.split(':');
                        setPickerHour(h); setPickerMinute(m);
                      }
                      setTimePickerModal('mulai');
                    }}
                  >
                    <Text style={{color: theme.text, fontSize: 16}}>{form.jamMulai || "08:00"}</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.label}>Jam Selesai</Text>
                  <TouchableOpacity 
                    style={[styles.input, {justifyContent: 'center', backgroundColor: theme.background}]} 
                    onPress={() => {
                      if (form.jamAkhir) {
                        const [h,m] = form.jamAkhir.split(':');
                        setPickerHour(h); setPickerMinute(m);
                      }
                      setTimePickerModal('akhir');
                    }}
                  >
                    <Text style={{color: theme.text, fontSize: 16}}>{form.jamAkhir || "17:00"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Form Rincian Hadir */}
            <View style={[styles.card, { zIndex: 1 }]}>
              <Text style={styles.cardTitle}>Rincian Kegiatan</Text>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Jurnal kegiatan yang dikerjakan" placeholderTextColor={theme.textSecondary} multiline={true} numberOfLines={4} value={form.kegiatan} onChangeText={(t) => handleInputChange('kegiatan', t)} />
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Hasil kegiatan / Output" placeholderTextColor={theme.textSecondary} multiline={true} numberOfLines={4} value={form.hasil} onChangeText={(t) => handleInputChange('hasil', t)} />
            </View>
          </>
        )}

        <Modal
          visible={!!timePickerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setTimePickerModal(null)}
        >
          <View style={{flex: 1, justifyContent: 'flex-end'}}>
            <TouchableWithoutFeedback onPress={() => setTimePickerModal(null)}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            </TouchableWithoutFeedback>

            <View 
              style={{backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10}}
            >
              <View style={{width: 40, height: 5, backgroundColor: theme.border, alignSelf: 'center', borderRadius: 3, marginBottom: 20}} />
              <Text style={{fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 10, textAlign: 'center'}}>
                Geser Jam {timePickerModal === 'mulai' ? 'Mulai' : 'Selesai'}
              </Text>
              
              <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 250, width: '100%', paddingHorizontal: 20}}>
                <JSWheelPicker key={`hour-${timePickerModal}`} items={hours} selectedValue={pickerHour} onValueChange={setPickerHour} theme={theme} />
                <Text style={{fontSize: 24, fontWeight: 'bold', color: theme.text, marginHorizontal: 20}}>:</Text>
                <JSWheelPicker key={`min-${timePickerModal}`} items={minutes} selectedValue={pickerMinute} onValueChange={setPickerMinute} theme={theme} />
              </View>
              
              <TouchableOpacity 
                style={{backgroundColor: theme.primary, width: '100%', paddingVertical: 16, borderRadius: 12, marginTop: 20, alignItems: 'center'}}
                onPress={() => {
                  handleInputChange(timePickerModal === 'mulai' ? 'jamMulai' : 'jamAkhir', `${pickerHour}:${pickerMinute}`);
                  setTimePickerModal(null);
                }}
              >
                <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold'}}>Simpan Pilihan Waktu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* GPS Info */}
        <View style={[styles.gpsContainer, (isMocked || isRooted) && { borderColor: theme.error, borderWidth: 1.5 }]}>
          <Ionicons name="location-sharp" size={18} color={(isMocked || isRooted) ? theme.error : (location ? theme.success : theme.error)} />
          <Text style={{ fontSize: 12, color: (isMocked || isRooted) ? theme.error : theme.textSecondary, marginLeft: 6, fontWeight: (isMocked || isRooted) ? 'bold' : 'normal' }}>
            {isRooted
              ? '⚠️ HP Root Terdeteksi! Absensi diblokir.'
              : isMocked
              ? '⚠️ Terdeteksi Fake GPS! Matikan lokasi palsu.'
              : (location ? `GPS Terkunci: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Mencari sinyal GPS...')}
          </Text>
        </View>

          {syncCount > 0 && (
            <View style={{ marginBottom: 12, padding: 10, backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24', flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#fbbf24" style={{ marginRight: 8 }} />
              <Text style={{ color: '#d97706', fontSize: 13, flex: 1 }}>Menyinkronkan {syncCount} data tertunda ke server...</Text>
            </View>
          )}
          
          {syncCount === 0 && syncSuccessMsg !== '' && (
            <View style={{ marginBottom: 12, padding: 10, backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: '#10b981', flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={{ color: '#047857', fontSize: 13, flex: 1, fontWeight: 'bold' }}>{syncSuccessMsg}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, loading && {opacity: 0.7}]} onPress={submitAbsensi} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Jurnal Sekarang</Text>
              </>
            )}
          </TouchableOpacity>
        
        <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tampilkan Modal Kamera In-App */}
      {showCameraModal && (
        <Modal visible={showCameraModal} animationType="slide" onRequestClose={() => setShowCameraModal(false)}>
          {Platform.OS === 'web' ? (
            <WebCamera 
              watermarkMeta={{ user, location, wilayah }}
              theme={theme}
              onClose={() => setShowCameraModal(false)}
              onCapture={(photoData) => {
                setPhoto(photoData);
                setShowCameraModal(false);
              }}
            />
          ) : (
            <NativeCamera 
              watermarkMeta={{ user, location, wilayah }}
              theme={theme}
              onClose={() => setShowCameraModal(false)}
              onCapture={(photoData) => {
                setPhoto({ uri: photoData.uri, base64: photoData.base64 });
                setShowCameraModal(false);
              }}
            />
          )}
        </Modal>
      )}
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
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: theme.secondary 
  },
  greeting: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  date: { color: '#e5e7eb', fontSize: 12, marginTop: 4 },
  iconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  content: { padding: 16 },
  
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  toggleActive: {
    backgroundColor: theme.primary,
  },
  toggleText: {
    fontWeight: 'bold',
    color: theme.textSecondary
  },
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
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: theme.primary, marginBottom: 16 },
  cameraPlaceholder: {
    height: 180,
    backgroundColor: theme.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16
  },
  retakeBtn: {
    backgroundColor: theme.textSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  label: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: 'bold',
    marginBottom: 8
  },
  input: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    color: theme.text,
  },
  pickerContainer: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    overflow: 'hidden'
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: theme.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  submitBtn: {
    backgroundColor: theme.primary,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 },
  
  // Camera Overlay
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 40,
  },
  camBtn: {
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
  },
  camCapture: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  camCaptureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  }
});
