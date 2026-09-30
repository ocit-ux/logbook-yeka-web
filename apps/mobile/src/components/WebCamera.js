import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WebCamera({ onCapture, onClose, theme }) {
  if (Platform.OS !== 'web') return null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [hasPermission, setHasPermission] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Minta Izin & Dapatkan Daftar Lensa
  const initializeCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Minta izin awal (wajib untuk bisa membaca label lensa di iOS)
      const initialStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Matikan stream awal segera setelah dapat izin
      initialStream.getTracks().forEach(t => t.stop());
      setHasPermission(true);

      // Ambil daftar semua kamera
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      
      if (videoDevices.length > 0) {
        // Coba cari lensa belakang yang BUKAN telefoto/makro
        let bestIndex = 0;
        for (let i = 0; i < videoDevices.length; i++) {
          const label = videoDevices[i].label.toLowerCase();
          if (label.includes('back') && !label.includes('tele') && !label.includes('macro')) {
            bestIndex = i;
            break;
          }
        }
        
        setDevices(videoDevices);
        setCurrentDeviceIndex(bestIndex);
        startStream(videoDevices[bestIndex].deviceId);
      } else {
        setHasPermission(false);
      }
    } catch (err) {
      setHasPermission(false);
      setIsLoading(false);
    }
  }, []);

  // 2. Mulai Streaming Video
  const startStream = async (deviceId) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      setIsLoading(true);
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 4096 }, // Paksa resolusi setinggi mungkin agar tajam
          height: { ideal: 2160 },
          facingMode: deviceId ? undefined : 'environment'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      // Fallback jika resolusi 4K ditolak
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {}
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeCamera();
    return () => {
      // Bersihkan memori saat ditutup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [initializeCamera]);

  // 3. Ganti Lensa (Siklus melalui semua lensa yang ada)
  const switchCamera = () => {
    if (devices.length < 2) return;
    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    setCurrentDeviceIndex(nextIndex);
    startStream(devices[nextIndex].deviceId);
  };

  // 4. Tangkap Foto
  const takePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Gunakan dimensi asli video agar tidak melar
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');

    // Cek apakah ini kamera depan berdasarkan label
    const currentDevice = devices[currentDeviceIndex];
    const isFrontCamera = currentDevice && (currentDevice.label.toLowerCase().includes('front') || currentDevice.label.toLowerCase().includes('depan'));

    if (isFrontCamera) {
      // Jika kamera depan, balik (flip) horizontal agar teks/tulisan tidak terbalik
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Kembalikan transformasi
    if (isFrontCamera) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    // Kompresi (0.4) agar cepat di-upload tapi tetap jernih
    const base64Full = canvas.toDataURL('image/jpeg', 0.4);
    const cleanBase64 = base64Full.replace(/^data:image\/jpeg;base64,/, '');
    
    onCapture({ uri: base64Full, base64: cleanBase64 });
  };

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center' }]}>
        <Ionicons name="camera-outline" size={60} color="#fff" />
        <Text style={styles.errorText}>Izin kamera ditolak atau kamera tidak ditemukan.</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Elemen Video HTML Asli */}
      <View style={styles.videoContainer}>
        {React.createElement('video', {
          ref: videoRef,
          autoPlay: true,
          playsInline: true, // Wajib untuk iOS agar tidak fullscreen native
          muted: true,
          style: { 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            transform: (devices[currentDeviceIndex]?.label.toLowerCase().includes('front') || devices[currentDeviceIndex]?.label.toLowerCase().includes('depan')) ? 'scaleX(-1)' : 'none'
          }
        })}
      </View>

      {/* UI Overlay */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Kamera Absensi</Text>
        {devices.length > 1 ? (
          <TouchableOpacity style={styles.iconBtn} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 44 }} />}
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 10 }}>Membuka lensa...</Text>
        </View>
      )}

      {/* Tombol Shutter */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.shutterBtn} 
          onPress={takePhoto}
          disabled={isLoading}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        
        {devices.length > 1 && (
           <Text style={styles.lensInfo} numberOfLines={1}>
             Lensa: {currentDeviceIndex + 1}/{devices.length} - {devices[currentDeviceIndex]?.label || 'Kamera'}
           </Text>
        )}
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    paddingTop: 40, // Area status bar
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 30,
  },
  closeBtn: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  lensInfo: {
    color: 'rgba(255,255,255,0.7)',
    position: 'absolute',
    top: 10,
    fontSize: 12,
  }
});
