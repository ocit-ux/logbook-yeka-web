import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/theme';
import { API_URL } from '../utils/api';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import DropDownPicker from 'react-native-dropdown-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { registerForPushNotificationsAsync, scheduleDailyReminder, cancelTodayReminder } from '../utils/notifications';

export default function DashboardScreen({ user, onLogout }) {
  const { theme, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [cameraRef, setCameraRef] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState('hadir'); // 'hadir' | 'izin'
  const [showTimePicker, setShowTimePicker] = useState({ visible: false, field: 'jamMulai' });
  
  const [izinOpen, setIzinOpen] = useState(false);
  const [pilihanIzin, setPilihanIzin] = useState([
    {label: 'Sakit', value: 'Sakit'},
    {label: 'Izin Keperluan Keluarga', value: 'Izin Keperluan Keluarga'},
    {label: 'WFH', value: 'WFH'},
    {label: 'Lain - Lain', value: 'Lain - Lain'}
  ]);
  
  const [form, setForm] = useState({
    jamMulai: '',
    jamAkhir: '',
    kegiatan: '',
    hasil: '',
    kategoriIzin: 'Sakit',
    keteranganIzin: ''
  });

  const handleTimeChange = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      setForm({ ...form, [showTimePicker.field]: timeStr });
    }
    setShowTimePicker({ ...showTimePicker, visible: false });
  };

  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setPhoto(null); // Mencegah foto kehadiran nempel ke form izin (bug fix)
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Izin lokasi GPS dibutuhkan untuk absensi.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Cepat, tidak perlu GPS presisi tinggi
        timeInterval: 5000,
        distanceInterval: 0
      });
      setLocation(loc.coords);
    })();
    
    // Setup Notification
    (async () => {
      const hasPermission = await registerForPushNotificationsAsync();
      if (hasPermission) {
        const lastSubmit = await AsyncStorage.getItem('@last_submit_date');
        const today = new Date().toDateString();
        // Hanya jadwalkan notifikasi jika hari ini belum pernah submit
        if (lastSubmit !== today) {
          await scheduleDailyReminder();
        }
      }
    })();

    loadDraft();
    // Ambil pilihan izin dari server
    (async () => {
      try {
        const res = await axios.post(API_URL, { action: 'getPilihanIzin' });
        if (res.data?.status === 'success' && res.data?.data?.data?.length > 0) {
          const mapped = res.data.data.data.map(item => ({ label: item, value: item }));
          setPilihanIzin(mapped);
        }
      } catch (e) { /* pakai default */ }
    })();
  }, []);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem('@absensi_draft');
      if (draft) setForm(JSON.parse(draft));
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
    if (cameraRef) {
      let rawPhoto = await cameraRef.takePictureAsync({ quality: 0.3, shutterSound: false });
      let actions = [{ resize: { width: 800 } }];
      
      if (cameraFacing === 'front') {
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }
      
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          rawPhoto.uri || rawPhoto.localUri,
          actions,
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        setPhoto(manipResult);
      } catch(e) {
        console.log("Failed to manipulate image:", e);
        // Fallback to raw if manipulate fails for some reason
        let fallback = await cameraRef.takePictureAsync({ base64: true, quality: 0.1, shutterSound: false });
        setPhoto(fallback);
      }
      setShowCamera(false);
    }
  };

  const submitAbsensi = async () => {
    if (mode === 'hadir') {
      if (!form.jamMulai || !form.jamAkhir || !form.kegiatan) {
        Alert.alert('Inkomplit', 'Jam mulai, selesai, dan kegiatan wajib diisi.'); return;
      }
      if (!photo) {
        Alert.alert('Wajib Foto', 'Lookbook kehadiran diwajibkan untuk foto!'); return;
      }
    } else {
      if (!form.kategoriIzin) {
        Alert.alert('Inkomplit', 'Kategori keterangan izin wajib diisi.'); return;
      }
    }

    if (!location) {
      Alert.alert('Tunggu', 'Sedang mengunci lokasi GPS...'); return;
    }

    setLoading(true);
    
    const payload = {
        nama: user?.nama || "Test User",
        email: user?.email || "test@test.com",
        telepon: user?.telepon || "-",
        jabatan: user?.jabatan || "Staff",
        devisi: user?.devisi || "-",
        status: mode.toUpperCase(),
        jamMulai: mode === 'hadir' ? form.jamMulai : "-",
        jamAkhir: mode === 'hadir' ? form.jamAkhir : "-",
        kegiatan: mode === 'hadir' ? form.kegiatan : "-",
        hasil_kegiatan: mode === 'hadir' ? form.hasil : "-",
        izin_sakit: mode === 'izin' ? `${form.kategoriIzin} - ${form.keteranganIzin}` : "-",
        gps: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        foto: photo?.base64 || "",
        device: "Aplikasi Expo (Mobile)"
    };

    try {
      const response = await axios.post(API_URL, {
        action: 'submitAttendance',
        data: payload
      }, { timeout: 25000 }); // Menyerah setelah 25 detik

      const resData = response.data;
      if (resData.status === 'success') {
        Alert.alert('Sukses', 'Jurnal absensi berhasil dikirim!');
        await AsyncStorage.removeItem('@absensi_draft');
        
        // Simpan tanggal submit dan batalkan notifikasi hari ini
        await AsyncStorage.setItem('@last_submit_date', new Date().toDateString());
        await cancelTodayReminder();

        setForm({ jamMulai: '', jamAkhir: '', kegiatan: '', hasil: '', kategoriIzin: 'Sakit', keteranganIzin: '' });
        setPhoto(null);
      } else {
        Alert.alert('Gagal', resData.message || 'Gagal mengirim absensi.');
      }
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(theme);

  if (showCamera) {
    if (!permission) return <View style={styles.container}><Text>Meminta akses kamera...</Text></View>;
    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={{ textAlign: 'center', marginBottom: 20 }}>Aplikasi butuh akses kamera.</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}><Text style={styles.btnText}>Izinkan Kamera</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10, backgroundColor: theme.error }]} onPress={() => setShowCamera(false)}><Text style={styles.btnText}>Batal</Text></TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView style={{ flex: 1 }} facing={cameraFacing} mirror={false} ref={(ref) => setCameraRef(ref)}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.camBtn} onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}>
              <Ionicons name="camera-reverse" size={32} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.camCapture} onPress={takePicture}>
              <View style={styles.camCaptureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.camBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.retakeBtn} onPress={() => setShowCamera(true)}>
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
            <TouchableOpacity style={styles.cameraPlaceholder} onPress={() => setShowCamera(true)}>
              <Ionicons name="camera" size={40} color={theme.textSecondary} />
              <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Ketuk untuk Ambil Foto</Text>
            </TouchableOpacity>
          )}
        </View>

        {mode === 'hadir' ? (
          <>
            {/* Form Rincian Hadir */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rincian Kegiatan</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTimePicker({ visible: true, field: 'jamMulai' })}>
                  <View pointerEvents="none">
                    <TextInput style={styles.input} placeholder="Jam Mulai" placeholderTextColor={theme.textSecondary} value={form.jamMulai} editable={false} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTimePicker({ visible: true, field: 'jamAkhir' })}>
                  <View pointerEvents="none">
                    <TextInput style={styles.input} placeholder="Jam Selesai" placeholderTextColor={theme.textSecondary} value={form.jamAkhir} editable={false} />
                  </View>
                </TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Jurnal kegiatan yang dikerjakan" placeholderTextColor={theme.textSecondary} multiline value={form.kegiatan} onChangeText={(t) => handleInputChange('kegiatan', t)} />
              <TextInput style={styles.input} placeholder="Hasil kegiatan / Output" placeholderTextColor={theme.textSecondary} value={form.hasil} onChangeText={(t) => handleInputChange('hasil', t)} />
            </View>
          </>
        ) : (
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
            <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top', marginTop: 16 }]} placeholder="Keterangan tambahan (Alasan lengkap)" placeholderTextColor={theme.textSecondary} multiline value={form.keteranganIzin} onChangeText={(t) => handleInputChange('keteranganIzin', t)} />
          </View>
        )}

        {/* GPS Info */}
        <View style={styles.gpsContainer}>
          <Ionicons name="location-sharp" size={18} color={location ? theme.success : theme.error} />
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginLeft: 6 }}>
            {location ? `GPS Terkunci: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Mencari sinyal GPS...'}
          </Text>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submitAbsensi} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={20} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.submitBtnText}>Kirim Jurnal Sekarang</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {showTimePicker.visible && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
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
    backgroundColor: '#f9fafb',
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
