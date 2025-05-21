import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
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

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!name || !dob) {
      Alert.alert('입력 오류', '이름과 생년월일을 모두 입력하세요.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await loginOrRegisterUser(name, dob);

      if ('name' in user && 'dob' in user && 'uuid' in user) {
        await saveUser({ name: user.name, dob: user.dob, uuid: user.uuid, isAdmin: user.isAdmin || false });

        // ✅ Push Token 등록
        try {
          await registerPushToken(user.uuid);
        } catch (pushError) {
          console.warn('푸시 토큰 등록 실패:', pushError);
        }

        // router.push({
        //   pathname: '/stamp',
        //   params: { name: user.name, dob: user.dob, uuid: user.uuid },
        // });

        if (user.isAdmin === true || user.isAdmin === 'true') {
          router.push({
            pathname: '/admin',
            params: { name: user.name, dob: user.dob, uuid: user.uuid },
          });
        } else {
          router.push({
            pathname: '/stamp',
            params: { name: user.name, dob: user.dob, uuid: user.uuid },
          });
        }
      } else {
        throw new Error('Invalid user data');
      }
    } catch (e) {
      console.error('❗ 로그인 에러:', e);
      Alert.alert('로그인 실패', '서버 오류 또는 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Push Token 등록 함수
  const registerPushToken = async (uuid: string) => {
    try {
      if (!Device.isDevice) {
        console.warn('푸시 알림은 실제 기기에서만 동작합니다.');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('기존 권한 상태:', existingStatus);
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('권한 요청 결과:', status);
        finalStatus = status;
      }
  
      if (finalStatus !== 'granted') {
        Alert.alert('권한 거부됨', '푸시 알림 권한이 필요합니다.');
        return;
      }
  
      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log('받은 푸시 토큰:', tokenData.data);
      const token = tokenData.data;
  
      // ✅ Firestore 저장
      await setDoc(doc(db, 'users', uuid), {
        expoPushToken: token,
      }, { merge: true });

      // ✅ SecureStore에도 저장 (추가!)
      await SecureStore.setItemAsync('expoPushToken', token);
      console.log('✅ 푸시 토큰 저장 완료');
    } catch (err) {
      console.error('❗ registerPushToken 오류:', err);
    }
  };

  const handleNaverBand = () => {
    Linking.openURL('https://band.us/@yourbandid');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Text style={styles.title}>
              오~ Go 피싱 오신것을 환영 합니다! 🫶{'\n'}즐기는 낚시 🎣 오고~오Go
            </Text>

            <TextInput
              style={styles.input}
              placeholder="이름"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="생년월일 (예: 19810204)"
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
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
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
