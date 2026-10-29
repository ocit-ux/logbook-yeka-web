import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stampWatermarkNativeAsync } from '../utils/watermark';

export default function NativeCamera({ onCapture, onClose, theme, watermarkMeta }) {
  if (Platform.OS === 'web') return null;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  // Kamera akan tertutup otomatis saat komponen ini di-unmount oleh Modal

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="camera-outline" size={60} color="#fff" />
        <Text style={styles.errorText}>Aplikasi membutuhkan izin untuk menggunakan kamera.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Beri Izin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { marginTop: 10, backgroundColor: '#333' }]} onPress={onClose}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setIsCameraReady(false);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (cameraRef.current && isCameraReady && !isProcessing) {
      try {
        setIsProcessing(true);
        // Beri jeda singkat 150ms agar pipeline auto-exposure Camera2 OPPO/ColorOS stabil
        await new Promise(r => setTimeout(r, 150));
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          base64: false,
          skipProcessing: false,
          shutterSound: false,
        });

        // Pangkas dan kompres manual via ImageManipulator (Lebar max 1000px)
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        // ponytail: solid-black JPEG (1000px @ 0.7) compresses to <4KB base64 due to uniform zero DCT blocks; real camera photos are 35KB-180KB
        if (!manipResult.base64 || manipResult.base64.length < 6000) {
          setIsProcessing(false);
          alert('Kamera belum siap menangkap cahaya (hasil foto gelap/hitam). Mohon tunggu 1 detik lalu tekan tombol potret lagi.');
          return;
        }

        // Fast pre-capture GPS lookup jika koordinat saat kamera dibuka masih null
        let activeLocation = watermarkMeta?.location;
        if (!activeLocation) {
          try {
            const rawCached = await AsyncStorage.getItem('@last_known_location');
            if (rawCached) {
              const parsed = JSON.parse(rawCached);
              if (parsed && (Date.now() - (parsed.timestamp || 0) < 300000)) {
                activeLocation = parsed;
              }
            }
          } catch (e) {}
        }
        if (!activeLocation) {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown && lastKnown.coords) {
              activeLocation = { ...lastKnown.coords, timestamp: Date.now() };
            }
          } catch (e) {}
        }

        const effectiveMeta = {
          ...watermarkMeta,
          location: activeLocation || watermarkMeta?.location,
          coords: activeLocation || watermarkMeta?.coords
        };

        let finalResult = manipResult;
        try {
          if (effectiveMeta) { watermarkMeta = effectiveMeta; }
          if (watermarkMeta) {
            finalResult = await stampWatermarkNativeAsync(manipResult.base64, watermarkMeta);
          }
        } catch (wmErr) {
          console.warn('Gagal menambahkan watermark pada foto:', wmErr);
          finalResult = manipResult;
        }

        onCapture({
          ...finalResult,
          coords: watermarkMeta?.location || null
        });
      } catch (e) {
        console.log(e);
        setIsProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        onCameraReady={() => setIsCameraReady(true)}
      />

      {/* Top Bar (di luar CameraView agar surface Android tidak tertutup layer hitam) */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Kamera Absensi</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {(isProcessing || !isCameraReady) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10 }}>
            {isProcessing ? 'Memproses Foto...' : 'Menyiapkan Lensa Kamera...'}
          </Text>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity 
          style={[styles.shutterBtn, (!isCameraReady || isProcessing) && { opacity: 0.5 }]} 
          onPress={takePicture}
          disabled={!isCameraReady || isProcessing}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 30,
  },
  btn: {
    backgroundColor: '#1E90FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  }
});
