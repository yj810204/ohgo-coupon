import {
  CameraView,
  useCameraPermissions
} from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { findCaptains } from '../utils/find-captains';
import { sendPushToUser } from '../utils/send-push';
import { addStamp } from '../utils/stamp-service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as Location from 'expo-location';

// 거리 계산 함수
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let scanInProgress = false;

export default function QRScanScreen() {
  const { name, dob, uuid } = useLocalSearchParams();
  const router = useRouter();
  const [locationGranted, setLocationGranted] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraActive, setCameraActive] = useState(true);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('#fff');

  // 기준 위치 불러오기
  const fetchTargetLocation = async (): Promise<{ lat: number; lon: number }> => {
    const ref = doc(db, 'config', 'location');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('기준 위치 정보가 존재하지 않습니다.');
    const data = snap.data();
    return {
      lat: data.lat,
      lon: data.lon,
    };
  };

  useEffect(() => {
    const prepare = async () => {
      // 카메라 권한
      const cam = await requestPermission();
      if (!cam.granted) {
        Alert.alert('카메라 권한 필요', 'QR 스캔을 위해 카메라 접근 권한이 필요합니다.');
        return;
      }
  
      // 위치 권한
      const loc = await Location.requestForegroundPermissionsAsync();
      if (loc.status !== 'granted') {
        Alert.alert('위치 권한 필요', 'QR 스캔을 위해 위치 권한이 필요합니다.');
        return;
      }
  
      setLocationGranted(true);
      scanInProgress = false;
    };
  
    prepare();
  }, []);

  // ✅ 타임아웃 유틸 함수
  const withTimeout = <T extends unknown>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('⏰ 응답이 지연되고 있습니다.'));
      }, timeoutMs);
  
      promise
        .then((res) => {
          clearTimeout(timeout);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  };
  

  const handleScan = async ({ data }: { data: string }) => {
    if (!cameraActive || scanInProgress) return;
    scanInProgress = true;
    // ✅ 카메라 화면은 유지하고, 스캔만 중지
    //setCameraActive(false);

    // ✅ 사용자에게 스캐닝 처리중임을 표시
    setMessage('스캔한 QR을 처리 중입니다...');
    setMessageColor('#fff');

    let msg = '', color = '#fff';

    try {
      // ✅ Firestore 기준 위치 가져오기
      const { lat: targetLat, lon: targetLon } = await fetchTargetLocation();

      // ✅ 현재 위치 가져오기
      const loc = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        5000 // 5초 제한
      );

      const userLat = loc.coords.latitude;
      const userLon = loc.coords.longitude;

      // ✅ 거리 계산
      const distance = getDistanceFromLatLonInKm(userLat, userLon, targetLat, targetLon);
      if (distance > 0.3) { //0.3km = 300m
        msg = '멤버십 스탬프는 오고피씽 근처(약 300m 이내)에서만 적립할 수 있습니다.';
        color = '#f44336';
        setMessage(msg);
        setMessageColor(color);
        setTimeout(() => {
          scanInProgress = false;
          router.back();
        }, 2000);
        return;
      }

      if (data === 'OHGO-STAMP-BOAT19033326262005') {
        try {
          // ✅ 타임아웃 적용 (예: 5초)
          await withTimeout(addStamp(String(uuid)), 5000);
  
          msg = '스탬프가 적립되었어요!\n오늘도 즐거운 낚시 되세요 🎣';
          color = '#4CAF50';
  
          await handleRequestToCaptains(name, uuid, dob);
        } catch (e: any) {
          msg = `❗ 오류: ${e.message || '적립 실패'}`;
          color = '#f44336';
        }
      } else {
        msg = '❌ 잘못된 QR 코드입니다.';
        color = '#f44336';
      }
    } catch (e: any) {
      msg = `위치 또는 적립 오류: ${e.message}`;
      color = '#f44336';
    }

    // ✅ 메시지 설정
    setMessage(msg);
    setMessageColor(color);

    setTimeout(() => {
      scanInProgress = false;
      router.back();
    }, 2000);
  };

  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>카메라 권한 요청 중...</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>카메라 권한이 거부되었습니다.</Text>
      </View>
    );
  }

return (
  <View style={styles.container}>
    <View style={StyleSheet.absoluteFill}>
    {permission?.granted && locationGranted && cameraActive && (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          {scanInProgress && (
            <View style={styles.dimmedOverlay} />
          )}
        </>
      )}
    </View>

    <View style={styles.overlay}>
      <Text style={[styles.message, { color: messageColor }]}>
        {message || 'QR을 스캔해주세요'}
      </Text>
    </View>
  </View>
  );
}

// ✅ 선장에게 푸시 전송
const handleRequestToCaptains = async (name: string | string[], uuid: string | string[], dob: string | string[]) => {
  const captains = await findCaptains();

  if (captains.length === 0) {
    Alert.alert('에러', '등록된 선장이 없습니다.');
    return;
  }

  const requests = captains.map((captain) => {
    if (!captain.expoPushToken) return null;

    return sendPushToUser({
      uuid: captain.uuid,
      title: '스탬프 적립 알림',
      body: `${name} 님이 스탬프를 적립했습니다.`,
      data: {
        screen: 'member-detail',
        uuid,
        name,
        dob,
      },
    });
  });

  await Promise.all(requests);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dimmedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlay: {
    position: 'absolute',
    bottom: 90,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 20,
    fontFamily: 'GiantRegular',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    textAlign: 'center',
    maxWidth: '100%',
    color: '#fff',
    overflow: 'hidden',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f9fc',
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
});
