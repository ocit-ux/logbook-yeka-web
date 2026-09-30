import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NativeCamera({ onCapture, onClose }) {
  if (Platform.OS === 'web') return null;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isProcessing, setIsProcessing] = useState(false);
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
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (cameraRef.current && !isProcessing) {
      try {
        setIsProcessing(true);
        // Jepret tanpa kompresi berat dari native dulu
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          shutterSound: false,
        });

        // Pangkas dan kompres manual via ImageManipulator (Lebar max 1000px)
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        onCapture(manipResult);
      } catch (e) {
        console.log(e);
        setIsProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        
        {/* Top Bar */}
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
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Memproses Foto...</Text>
          </View>
        )}

        {/* Bottom Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity 
            style={styles.shutterBtn} 
            onPress={takePicture}
            disabled={isProcessing}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>

      </CameraView>
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
