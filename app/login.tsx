import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { db } from '../firebase';
import { loginOrRegisterUser } from '../utils/firebase-auth';
import { saveUser } from '../utils/secure-store';
import { notifyAllAdmins } from '../utils/send-push';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const handleLogin = async () => {
    if (!name || !dob) {
      Alert.alert('입력 오류', '이름과 생년월일을 모두 입력하세요.');
      return;
    }
  
    setIsLoading(true);
  
    try {
      // ✅ 로그인 전 SecureStore 초기화
      // await SecureStore.deleteItemAsync('userInfo');
      // await SecureStore.deleteItemAsync('expoPushToken');
      // console.log('✅ SecureStore 초기화 완료');
      console.log('🔍 로그인 시도:', name, dob);

      const user = await loginOrRegisterUser(name, dob);
  
      if ('name' in user && 'dob' in user && 'uuid' in user) {
        console.log('🧾 로그인한 사용자:', user.name, user.uuid);
  
        // ✅ 1. 사용자 정보 저장
        await saveUser({
          name: user.name,
          dob: user.dob,
          uuid: user.uuid,
          isAdmin: user.isAdmin || false
        });
  
        // ✅ 2. 저장 확인 (동기화 보장)
        const storedUser = await SecureStore.getItemAsync('userInfo');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          console.log('✅ 저장 후 SecureStore userInfo:', parsed?.uuid);
        }
  
        // ✅ 3. Push Token 등록
        try {
          await registerPushToken(user.uuid);
  
          // ✅ 4. 신규 회원일 경우 관리자에게 알림
          if (!user.isAdmin && user.isNew) {
            await notifyAllAdmins(user.name);
          }
        } catch (pushError) {
          console.warn('❗ 푸시 토큰 등록 실패:', pushError);
        }
  
        // ✅ 5. 라우팅
        const targetPath = user.isAdmin ? '/admin' : '/stamp';
        router.push({
          pathname: targetPath,
          params: {
            name: user.name,
            dob: user.dob,
            uuid: user.uuid,
          },
        });
      } else {
        throw new Error('Invalid user data');
      }
    } catch (e) {
      console.error('❗ 로그인 에러:', e);
      Alert.alert('로그인 실패', '서버 오류 또는 연결 실패\n(' + e + ')');
      // 로그인 실패 시 SecureStore 초기화
      await SecureStore.deleteItemAsync('userInfo');
      await SecureStore.deleteItemAsync('expoPushToken');
      console.log('✅ 로그인 실패로 SecureStore 초기화 완료');
      console.log('🔍 로그인 실패:', name, dob);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ✅ Push Token 등록 함수
  const registerPushToken = async (uuid: string) => {
    try {
      const storedUserInfo = await SecureStore.getItemAsync('userInfo');
      const stored = storedUserInfo ? JSON.parse(storedUserInfo) : null;

      console.log('🧪 비교 - stored.uuid:', stored?.uuid);
      console.log('🧪 비교 - 전달된 uuid:', uuid);
      console.log('🧪 typeof stored.uuid:', typeof stored?.uuid);
      console.log('🧪 typeof uuid:', typeof uuid);
      console.log('🧪 일치 여부:', stored?.uuid === uuid);

      if (!stored || stored.uuid !== uuid) {
        console.warn('❗ 현재 로그인 사용자와 푸시 토큰 대상이 일치하지 않습니다.');
        return;
      }
  
      if (!Device.isDevice) {
        console.warn('❗ 푸시 알림은 실제 기기에서만 동작합니다.');
        return;
      }
  
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
  
      await setDoc(doc(db, 'users', uuid), {
        expoPushToken: token,
      }, { merge: true });
  
      await SecureStore.setItemAsync('expoPushToken', token);
  
      console.log('✅ 푸시 토큰 저장 완료:', token);
    } catch (err) {
      console.error('❗ registerPushToken 오류:', err);
    }
  };
  
  const handleNaverBand = () => {
    Linking.openURL('https://www.band.us/band/88348442');
  };

  const backgroundColor = isDark ? '#000' : '#f7f9fc';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: backgroundColor }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: isDark ? '#000' : backgroundColor }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
                오~ Go 피싱에 오신것을 환영 합니다! 🫶{'\n'}즐기는 낚시 🎣 오고~오Go
              </Text>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#222' : '#fff',
                    color: isDark ? '#fff' : '#000',
                    borderColor: isDark ? '#555' : '#ccc',
                  },
                ]}
                placeholderTextColor={isDark ? '#aaa' : '#999'}
                placeholder="이름"
                value={name}
                onChangeText={setName}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#222' : '#fff',
                    color: isDark ? '#fff' : '#000',
                    borderColor: isDark ? '#555' : '#ccc',
                  },
                ]}
                placeholderTextColor={isDark ? '#aaa' : '#999'}
                placeholder="생년월일 (예: 720610)"
                value={dob}
                onChangeText={setDob}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.button, isLoading && { opacity: 0.6 }]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <View style={styles.buttonContent}>
                  {isLoading ? (
                    <View style={styles.loadingWrapper}>
                      <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonText}>로그인 중...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>로그인</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bandButton} onPress={handleNaverBand}>
                <Image
                  source={require('../assets/images/naver-band-logo.png')}
                  style={styles.bandLogo}
                />
                <Text style={styles.bandButtonText}>네이버 밴드 바로가기</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'GiantRegular',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 18,
    height: 50,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'GiantRegular',
  },
  bandButton: {
    backgroundColor: '#06c755',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  bandLogo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginRight: 8,
  },
  bandButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
  },
  buttonContent: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
