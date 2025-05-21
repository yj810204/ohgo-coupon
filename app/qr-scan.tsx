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

let scanInProgress = false;

export default function QRScanScreen() {
  const { name, dob, uuid } = useLocalSearchParams();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraActive, setCameraActive] = useState(true);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('#fff');

  useEffect(() => {
    if (!permission || !permission.granted) {
      requestPermission();
    }
    scanInProgress = false;
  }, []);

  // ✅ 타임아웃 유틸 함수
  const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
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
    // setCameraActive(false); 👈 이 줄 제거

    let msg = '', color = '#fff';

    if (data === 'https://codejaka01.cafe24.com/cj_ohgo/onBoarding') {
      try {
        // ✅ 타임아웃 적용 (예: 5초)
        await withTimeout(addStamp(String(uuid)), 5000);

        msg = '✅ 스탬프 적립 성공!';
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

    setMessage(msg);
    setMessageColor(color);

    setTimeout(() => {
      scanInProgress = false;
      router.back();
    }, 2000);
  };

  if (!permission) return <Text>카메라 권한 요청 중...</Text>;
  if (!permission.granted) return <Text>카메라 권한이 거부되었습니다.</Text>;

  return (
    <View style={styles.container}>
  <View style={StyleSheet.absoluteFill}>
    {cameraActive && (
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
});
