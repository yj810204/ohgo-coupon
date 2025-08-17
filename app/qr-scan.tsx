import {
  CameraView,
  useCameraPermissions
} from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { findCaptains } from '../utils/find-captains';
import { sendPushToUser } from '../utils/send-push';
import { addStamp } from '../utils/stamp-service';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import * as Location from 'expo-location';

// 거리 계산 함수
function getDistanceFromLatLngInKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function QRScanScreen() {
  const { name, dob, uuid } = useLocalSearchParams();
  const router = useRouter();
  const [locationGranted, setLocationGranted] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraActive, setCameraActive] = useState(true);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('#fff');

  // 기준 위치 불러오기
  const fetchTargetLocation = async (): Promise<{ lat: number; lng: number; limit: number }> => {
    const ref = doc(db, 'config', 'location');
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('기준 위치 정보가 존재하지 않습니다.');
    const data = snap.data();

    console.log('📍 기준 위치:', data.lat, data.lng, '제한 거리:', data.limitDistanceKm);
    return {
      lat: data.lat,
      lng: data.lng,
      limit: data.limitDistanceKm || 0.3, // 기본 300m
    };
  };

  const scanInProgress = useRef(false); // ✅ useRef로 처리 (글로벌 변수 피함)

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
      scanInProgress.current = false;
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
    if (!cameraActive || scanInProgress.current) return;
    scanInProgress.current = true;

    const showMessageAndBack = (msg: string, color: string, delay = 2000) => {
      setMessage(msg);
      setMessageColor(color);
      setTimeout(() => {
        scanInProgress.current = false;
        if (router.canGoBack?.()) router.back();
      }, delay);
    };

    setMessage('스캔한 QR을 처리 중입니다...');
    setMessageColor('#fff');

    try {
      // ✅ Firestore 기준 위치
      const { lat: targetLat, lng: targetLng, limit } = await fetchTargetLocation();

      // ✅ 위치 가져오기: 우선 캐시된 위치 → 실패 시 저정밀도 새 위치
      let loc = await withTimeout(Location.getLastKnownPositionAsync(), 2000);
      if (!loc) {
        loc = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          }),
          7000
        );
      }

      if (!loc) throw new Error('위치를 가져오지 못했습니다.');

      const userLat = loc.coords.latitude;
      const userLng = loc.coords.longitude;

      console.log('📍 위치 비교:', userLat, userLng, targetLat, targetLng);

      // ✅ 거리 계산
      const distance = getDistanceFromLatLngInKm(userLat, userLng, targetLat, targetLng);
      if (distance > limit) {
        return showMessageAndBack(
          `오고피씽 근처(약 ${Math.round(limit * 1000).toLocaleString()}m 이내)에서만 스탬프 적립이 가능합니다.`,
          '#f44336'
        );
      }

      // ✅ QR 코드 유효성 검사 및 적립
      if (data === 'OHGO-STAMP-BOAT19033326262005') {
        try {
          await withTimeout(addStamp(String(uuid)), 5000);
          
          // 미끼 교환권 발행
          try {
            const userRef = doc(db, 'users', String(uuid));
            await updateDoc(userRef, {
              baitCoupons: increment(1)
            });
            console.log('게임미끼 교환권이 발행되었습니다.');
          } catch (error) {
            console.error('미끼 교환권 발행 오류:', error);
          }
          
          await handleRequestToCaptains(name, uuid, dob);
          return showMessageAndBack(
            '스탬프가 적립되었어요!\n게임 미끼 교환권이 발행되었습니다.\n오늘도 즐거운 낚시 되세요 🎣',
            '#4CAF50',
            5000
          );
        } catch (e: any) {
          console.error('❗ 오류:', e.message);
          return showMessageAndBack(`❗ 오류: ${e.message || '적립 실패'}`, '#f44336');
        }
      } else {
        return showMessageAndBack('❌ 잘못된 QR 코드입니다.', '#f44336');
      }
    } catch (e: any) {
      return showMessageAndBack(`위치 또는 적립 오류: ${e.message}`, '#f44336');
    }
  };

  // ✅ 카메라 권한 체크
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
