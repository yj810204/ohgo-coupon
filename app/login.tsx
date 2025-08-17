import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { WebView } from 'react-native-webview';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyHtml, setPrivacyHtml] = useState('');
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  
  useEffect(() => {
    // Set privacy policy HTML content
    setPrivacyHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e88e5; }
          h2 { color: #333; margin-top: 20px; }
          hr { margin: 15px 0; border: 0; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <p>오고피씽은(는) 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한바를 준수하여, 적법하게 개인정보를 처리하고 안전하 기준을 안내하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
        
        <hr />
        <h2>개인정보의 처리목적</h2>
        <p>오고피씽은(는) 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
        <p>
          1. 회원 가입 및 관리<br>
          회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 만 14세 미만 아동의 개인정보 처리 시 법정대리인의 동의여부 확인, 각종 고지·통지, 고충처리 목적으로 개인정보를 처리합니다.
        </p>
        
        <hr />
        <h2>개인정보의 처리 및 보유기간</h2>
        <p>
          ① 오고피씽은(는) 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.<br><br>
          ② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.<br>
          1. 어플리케이션 회원 가입 및 관리 : 어플리케이션 회원삭제(탈퇴) 시까지<br>
          다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료 시까지<br>
          1) 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지
        </p>
        
        <hr />
        <h2>처리하는 개인정보 항목</h2>
        <p>오고피씽은(는) 다음의 개인정보 항목을 처리하고 있습니다.</p>
        <p>
          1. 회원 가입 및 관리<br>
          • 필수항목 : 성명, 생년월일<br><br>
          2. 재화 또는 서비스 제공<br>
          • 필수항목 : 성명, 생년월일
        </p>
        
        <hr />
        <h2>개인정보의 파기 절차 및 방법</h2>
        <p>
          ① 오고피씽은(는) 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.<br><br>
          ② 정보주체로부터 동의받은 개인정보 보유기간이 경과하거나 처리목적이 달성되었음에도 불구하고 다른 법령에 따라 개인정보를 계속 보존하여야 하는 경우에는, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나 보관장소를 달리하여 보존합니다.<br><br>
          ③ 개인정보 파기의 절차 및 방법은 다음과 같습니다.<br>
          1. 파기절차<br>
          오고피씽은(는) 파기 사유가 발생한 개인정보를 선정하고, 오고피씽의 개인 정보 보호책임자의 승인을 받아 개인정보를 파기합니다.<br>
          2. 파기방법<br>
          오고피씽은(는) 전자적 파일 형태로 기록·저장된 개인정보는 기록을 재생할 수 없도록 파기하며, 종이 문서에 기록·저장된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.
        </p>
        
        <hr />
        <h2>정보주체와 법정대리인의 권리·의무 및 행사방법</h2>
        <p>
          ① 정보주체는 오고피씽에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.<br><br>
          ② 권리 행사는 오고피씽에 대해 「개인정보 보호법」 시행령 제41조 제1항에 따라 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며, 오고피씽은(는) 이에 대해 지체없이 조치하겠습니다.<br><br>
          ③ 권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수도 있습니다. 이 경우 "개인정보 처리 방법에 관한 고시(제2020-7호)" 별지 제11호 서식에 따른 위임장을 제출하셔야 합니다.<br><br>
          ④ 개인정보 열람 및 처리정지 요구는 「개인정보 보호법」 제35조 제4항, 제37조 제2항에 의하여 정보주체의 권리가 제한 될 수 있습니다.<br><br>
          ⑤ 개인정보의 정정 및 삭제 요구는 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 그 삭제를 요구할 수 없습니다.<br><br>
          ⑥ 오고피씽은(는) 정보주체 권리에 따른 열람의 요구, 정정·삭제의 요구, 처리정지의 요구 시 열람 등 요구를 한 자가 본인이거나 정당한 대리인인지를 확인합니다.
        </p>
        
        <hr />
        <h2>개인정보의 안전성 확보조치</h2>
        <p>
          오고피씽은(는) 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.<br><br>
          1. 관리적 조치 : 내부관리계획 수립·시행, 전담조직 운영, 정기적 직원 교육<br>
          2. 기술적 조치 : 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 개인정보의 암호화, 보안프로그램 설치 및 갱신<br>
          3. 물리적 조치 : 전산실, 자료보관실 등의 접근통제
        </p>
        
        <hr />
        <h2>개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항</h2>
        <p>오고피씽은 정보주체의 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용하지 않습니다.</p>
        
        <hr />
        <h2>행태정보의 수집·이용·제공 및 거부 등에 관한 사항</h2>
        <p>오고피씽은(는) 온라인 맞춤형 광고 등을 위한 행태정보를 수집·이용·제공하지 않습니다.</p>
        
        <hr />
        <h2>개인정보 보호책임자</h2>
        <p>
          ① 오고피씽은(는) 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.<br><br>
          ‣ 개인정보 보호책임자<br>
          성명 : 정영남<br>
          연락처 : yj63486202@gmail.com<br><br>
          ② 정보주체는 오고피씽의 서비스(또는 사업)을 이용하시면서 발생한 모든 개인정보보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 오고피씽은(는) 정보주체의 문의에 대해 지체없이 답변 및 처리해드릴 것입니다.
        </p>
        
        <hr />
        <h2>개인정보 열람청구</h2>
        <p>
          정보주체는 「개인정보 보호법」 제35조에 따른 개인정보의 열람 청구를 아래의 부서에 할 수 있습니다.<br>
          오고피씽은(는) 정보주체의 개인정보 열람청구가 신속하게 처리되도록 노력하겠습니다.<br><br>
          ‣ 개인정보 열람청구 접수·처리 부서<br>
          담당자 : 정영남<br>
          연락처 : yj63486202@gmail.com
        </p>
        
        <hr />
        <h2>권익침해 구제방법</h2>
        <p>
          ① 정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.<br><br>
          1. 개인정보분쟁조정위원회 : (국번없이) 1833-6972 (www.kopico.go.kr)<br>
          2. 개인정보침해신고센터 : (국번없이) 118 (privacy.kisa.or.kr)<br>
          3. 대검찰청 : (국번없이) 1301 (www.spo.go.kr)<br>
          4. 경찰청 : (국번없이) 182 (ecrm.cyber.go.kr)<br><br>
          ② 오고피씽은(는) 정보주체의 개인정보자기결정권을 보장하고, 개인정보침해로 인한 상담 및 피해 구제를 위해 노력하고 있으며, 신고나 상담이 필요하신 경우 위의 담당부서로 연락해 주시기 바랍니다.<br><br>
          ‣ 개인정보보호 관련 고객 상담 및 신고<br>
          담당자 : 정영남<br>
          연락처 : yj63486202@gmail.com<br><br>
          ③ 「개인정보 보호법」 제35조(개인정보의 열람), 제36조(개인정보의 정정·삭제), 제37조(개인정보의 처리정지 등)의 규정에 의한 요구에 대하여 공공기관의 장이 행한 처분 또는 부작위로 인하여 권리 또는 이익의 침해를 받은 자는 행정심판법이 정하는 바에 따라 행정심판을 청구할 수 있습니다.<br><br>
          ‣ 중앙행정심판위원회 : (국번없이) 110 (www.simpan.go.kr)
        </p>
        
        <hr />
        <h2>개인정보 처리방침의 변경</h2>
        <p>① 이 개인정보 처리방침은 2025. 5. 28부터 적용됩니다.</p>
      </body>
      </html>
    `);
  }, []);

  const handleLogin = async () => {
    if (!name || !dob) {
      Alert.alert('입력 오류', '이름과 생년월일을 모두 입력하세요.');
      return;
    }
    
    if (!agreed) {
      Alert.alert('동의 필요', '개인정보처리방침에 동의하셔야 합니다.');
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
            await notifyAllAdmins(
                `${user.name}님이 새로 가입했어요!`,
                '회원 가입 알림',
                'admin-main'
            );
          }
        } catch (pushError) {
          console.warn('❗ 푸시 토큰 등록 실패:', pushError);
        }
  
        // ✅ 5. 라우팅
        const targetPath = user.isAdmin ? '/admin-main' : '/main';
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

              <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
                <Ionicons 
                  name={agreed ? 'checkbox-outline' : 'square-outline'} 
                  size={22} 
                  color={agreed ? '#2196F3' : isDark ? '#555' : '#888'} 
                />
                <View style={styles.checkboxLabelContainer}>
                  <Text style={[styles.checkboxLabel, { color: isDark ? '#fff' : '#333' }]}> </Text>
                  <TouchableOpacity onPress={() => setShowPrivacyModal(true)}>
                    <Text style={[styles.checkboxLabel, styles.linkText]}>개인정보 처리방침</Text>
                  </TouchableOpacity>
                  <Text style={[styles.checkboxLabel, { color: isDark ? '#fff' : '#333' }]}>에 동의합니다.</Text>
                </View>
              </TouchableOpacity>

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

      <Modal isVisible={showPrivacyModal} onBackdropPress={() => setShowPrivacyModal(false)} style={styles.modalWrap}>
        <View style={styles.webViewModalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>개인정보 처리방침</Text>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <WebView 
            source={{ 
              html: privacyHtml || '<html><body><h1>로딩 중...</h1></body></html>',
              baseUrl: ''
            }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
            }}
          />
        </View>
      </Modal>
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
  // Checkbox styles
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
  },
  linkText: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalWrap: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  webViewModalBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    height: '80%',
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  webView: {
    flex: 1,
  },
});
