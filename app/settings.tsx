import { useEffect, useState } from 'react';
import { View, Text, Switch, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { deleteField, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { clearUser } from '@/utils/secure-store';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const [isPushEnabled, setIsPushEnabled] = useState(true);
  const [userInfo, setUserInfo] = useState<{ name: string, dob: string, uuid: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('expoPushToken');
      setIsPushEnabled(!!token);

      const stored = await SecureStore.getItemAsync('userInfo');
      if (stored) {
        setUserInfo(JSON.parse(stored));
      }
    })();
  }, []);

  const togglePush = async () => {
    if (isPushEnabled) {
      await SecureStore.deleteItemAsync('expoPushToken');
      if (userInfo?.uuid) {
        await updateDoc(doc(db, 'users', userInfo.uuid), {
          expoPushToken: deleteField(),
        });
      }
      setIsPushEnabled(false);
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await SecureStore.setItemAsync('expoPushToken', token);
        if (userInfo?.uuid) {
          await updateDoc(doc(db, 'users', userInfo.uuid), {
            expoPushToken: token,
          });
        }
        setIsPushEnabled(true);
      } else {
        Alert.alert('알림 권한 필요', '알림을 받기 위해 권한을 허용해 주세요.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      const uuid = userInfo?.uuid;
      const token = await SecureStore.getItemAsync('expoPushToken');
  
      if (uuid && token) {
        const userRef = doc(db, 'users', uuid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          await updateDoc(userRef, {
            expoPushToken: deleteField(),
          });
        }
        await SecureStore.deleteItemAsync('expoPushToken');
      }
  
      await clearUser();
      // ✅ 알림 내역 초기화
      await SecureStore.deleteItemAsync('notificationHistory');

      console.log('✅ 로그아웃 완료: 사용자 정보 및 알림 내역 제거');
      if (!__DEV__) {
        await Updates.reloadAsync();
      } else {
        router.replace('/login');
      }
    } catch (e) {
      console.error('🚨 로그아웃 오류:', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>알림 설정</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/notification-history')}
          >
            <Ionicons name="notifications-outline" size={18} color="#1e88e5" />
            <Text style={styles.historyText}>내역</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.item}>
          <Text style={styles.label}>푸시 알림 받기</Text>
          <Switch value={isPushEnabled} onValueChange={togglePush} />
        </View>
        <Text style={styles.description}>
          알림을 끄면 스탬프 적립 및 쿠폰 발급 알림을 받을 수 없습니다.
        </Text>
      </View>
      {/* <View style={styles.cardBox}>
        <Text style={styles.title}>승선 정보 입력</Text>
        <TouchableOpacity style={styles.submitButton} onPress={() => router.push('/boarding-form')}>
          <Text style={styles.submitButtonText}>정보 입력하기</Text>
        </TouchableOpacity>
      </View> */}
      <View style={styles.cardBox}>
        <Text style={styles.title}>계정</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f9fc',
  },
  cardBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  description: {
    fontSize: 13,
    color: '#777',
    marginTop: 6,
    fontFamily: 'GiantRegular',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8
  },
  historyText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#1e88e5',
    fontFamily: 'GiantRegular',
  },
  submitButton: {
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: '#1e88e5',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
});