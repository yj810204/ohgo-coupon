import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import { useRouter } from 'expo-router';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUser } from '../utils/secure-store';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

export default function BoardingForm() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<{
    name: string;
    birth: string;
    gender: string;
    phone: string;
    emergency: string;
    address: string;
  }>({
    name: '',
    birth: '',
    gender: '',
    phone: '',
    emergency: '',
    address: '',
  });

  const [agreed, setAgreed] = useState(false);
  const [agreedThirdParty, setAgreedThirdParty] = useState(false);
  const [showBirthModal, setShowBirthModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showThirdPartyModal, setShowThirdPartyModal] = useState(false);
  const [privacyHtml, setPrivacyHtml] = useState('');
  const [thirdPartyHtml, setThirdPartyHtml] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());

  const loadHtmlFile = async (filename: string) => {
    try {
      console.log(`[DEBUG] Loading HTML file: ${filename}`);
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      console.log(`[DEBUG] File URI: ${fileUri}`);
      
      // Get asset module
      const assetModule = filename === 'privacy-policy.html'
        ? require('../assets/privacy-policy.html')
        : require('../assets/third-party-agreement.html');
      console.log(`[DEBUG] Asset module loaded: ${!!assetModule}`);
      
      // Create asset and ensure it's downloaded
      const asset = Asset.fromModule(assetModule);
      console.log(`[DEBUG] Asset created: ${!!asset}`);
      
      // Download the asset if it's not downloaded yet
      if (!asset.downloaded) {
        console.log(`[DEBUG] Asset not downloaded yet, downloading...`);
        await asset.downloadAsync();
        console.log(`[DEBUG] Asset downloaded successfully`);
      }
      
      const assetUri = asset.localUri || asset.uri;
      console.log(`[DEBUG] Asset URI: ${assetUri}`);

      // Check if file exists in document directory
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log(`[DEBUG] File exists in document directory: ${fileInfo.exists}`);

      if (!fileInfo.exists) {
        console.log(`[DEBUG] Copying file from assets to document directory`);
        // Copy from assets to document directory
        await FileSystem.copyAsync({
          from: assetUri,
          to: fileUri
        });
        console.log(`[DEBUG] File copied successfully`);
      }

      // Read the file
      console.log(`[DEBUG] Reading file content`);
      const htmlContent = await FileSystem.readAsStringAsync(fileUri);
      console.log(`[DEBUG] HTML content length: ${htmlContent.length}`);
      
      // If content is empty or very short, try to read directly from asset
      if (htmlContent.length < 10) {
        console.log(`[DEBUG] HTML content too short, reading directly from asset`);
        const directContent = await FileSystem.readAsStringAsync(assetUri);
        console.log(`[DEBUG] Direct content length: ${directContent.length}`);
        return directContent;
      }
      
      return htmlContent;
    } catch (error) {
      console.error('Error loading HTML file:', error);
      return `<html><body><h1>Error loading content</h1><p>${error}</p></body></html>`;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Load user data
        const user = await getUser();
        if (user?.uuid) {
          const snap = await getDoc(doc(db, 'users', user.uuid, 'boarding', 'info'));
          if (snap.exists()) {
            const data = snap.data();
            setForm(data as typeof form);
            setAgreed(!!data.agreed);
            setAgreedThirdParty(!!data.agreedThirdParty);
          }
        }
        
        // Load HTML content
        console.log('[DEBUG] Starting to load HTML files in useEffect');
        
        try {
          const privacyContent = await loadHtmlFile('privacy-policy.html');
          console.log('[DEBUG] Privacy content loaded successfully');
          if (privacyContent && privacyContent.length > 10) {
            setPrivacyHtml(privacyContent);
          } else {
            console.warn('[DEBUG] Privacy content is empty or too short');
            // Fallback to direct HTML content
            setPrivacyHtml(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  h1 { color: #1e88e5; }
                </style>
              </head>
              <body>
                <p>오고피씽 서비스를 이용해 주셔서 감사합니다. 본 서비스는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수하고 있습니다.</p>
                <h2>1. 수집하는 개인정보 항목</h2>
                <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집하고 있습니다: 이름, 생년월일, 성별, 연락처, 비상 연락처, 주소</p>
                <h2>2. 개인정보의 수집 및 이용목적</h2>
                <p>서비스 제공, 회원 관리, 안전 관리 등의 목적으로 개인정보를 수집합니다.</p>
                <h2>3. 개인정보의 보유 및 이용기간</h2>
                <p>원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
                <h2>4. 동의 거부권 및 거부 시 불이익</h2>
                <p>귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 다만, 동의를 거부할 경우 서비스 이용이 제한될 수 있습니다.</p>
              </body>
              </html>
            `);
          }
        } catch (error) {
          console.error('[DEBUG] Error loading privacy content:', error);
          // Set fallback content
          setPrivacyHtml(`
            <html><body>
            <p>콘텐츠를 불러오는 중 오류가 발생했습니다.</p>
            </body></html>
          `);
        }
        
        try {
          const thirdPartyContent = await loadHtmlFile('third-party-agreement.html');
          console.log('[DEBUG] Third party content loaded successfully');
          if (thirdPartyContent && thirdPartyContent.length > 10) {
            setThirdPartyHtml(thirdPartyContent);
          } else {
            console.warn('[DEBUG] Third party content is empty or too short');
            // Fallback to direct HTML content
            setThirdPartyHtml(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  h1 { color: #1e88e5; }
                </style>
              </head>
              <body>
                <p>오고피씽 서비스는 원활한 서비스 제공 및 안전한 승선 관리를 위해 아래와 같이 개인정보를 제3자에게 제공하고 있습니다.</p>
                <h2>1. 개인정보를 제공받는 자</h2>
                <p>해양경찰청</p>
                <h2>2. 제공하는 개인정보 항목</h2>
                <p>이름, 생년월일, 성별, 연락처, 주소 등</p>
                <h2>3. 개인정보를 제공받는 자의 개인정보 보유 및 이용기간</h2>
                <p>개인정보를 제공받는 자는 개인정보를 제공받은 날로부터 동의 철회 시 또는 제공 목적을 달성할 때까지 보유 및 이용합니다.</p>
                <h2>4. 동의 거부권 및 거부 시 불이익</h2>
                <p>귀하는 개인정보 제공에 대한 동의를 거부할 권리가 있습니다. 다만, 동의를 거부할 경우 서비스 이용이 제한될 수 있습니다.</p>
              </body>
              </html>
            `);
          }
        } catch (error) {
          console.error('[DEBUG] Error loading third party content:', error);
          // Set fallback content
          setThirdPartyHtml(`
            <html><body>
            <p>콘텐츠를 불러오는 중 오류가 발생했습니다.</p>
            </body></html>
          `);
        }
      } catch (e) {
        console.warn('불러오기 오류:', e);
      }
    })();
  }, []);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const formatPhone = (value: string) => {
    const numbersOnly = value.replace(/[^0-9]/g, '');
    if (numbersOnly.length < 4) return numbersOnly;
    if (numbersOnly.length < 7)
      return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3)}`;
    if (numbersOnly.length < 11)
      return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 6)}-${numbersOnly.slice(6)}`;
    return `${numbersOnly.slice(0, 3)}-${numbersOnly.slice(3, 7)}-${numbersOnly.slice(7, 11)}`;
  };

  const handlePhoneChange = (key: keyof typeof form, value: string) => {
    const formatted = formatPhone(value);
    handleChange(key, formatted);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.birth || !form.gender || !form.phone || !form.emergency || !form.address) {
      Alert.alert('입력 필요', '모든 항목을 빠짐없이 입력해 주세요.');
      return;
    }
    if (!agreed) {
      Alert.alert('동의 필요', '개인정보 수집 및 이용에 동의하셔야 합니다.');
      return;
    }
    if (!agreedThirdParty) {
      Alert.alert('동의 필요', '제3자 개인정보 제공에 동의하셔야 합니다.');
      return;
    }
    if (!/^[0-9]{6}$|^[0-9]{8}$/.test(form.birth.replace(/-/g, ''))) {
      Alert.alert('생년월일 확인', '생년월일은 6자리 또는 8자리여야 합니다.');
      return;
    }
    try {
      const user = await getUser();
      if (!user?.uuid) throw new Error('UUID가 없습니다.');
      await setDoc(doc(db, 'users', user.uuid, 'boarding', 'info'), { ...form, agreed, agreedThirdParty });
      Alert.alert('저장 완료', '승선 정보가 저장되었습니다.');
      router.back();
    } catch (e) {
      console.error('저장 오류:', e);
      Alert.alert('오류', '정보 저장 중 오류가 발생했습니다.');
    }
  };

  const confirmBirthDate = () => {
    const yyyy = birthDate.getFullYear();
    const mm = String(birthDate.getMonth() + 1).padStart(2, '0');
    const dd = String(birthDate.getDate()).padStart(2, '0');
    handleChange('birth', `${yyyy}-${mm}-${dd}`);
    setShowBirthModal(false);
  };

  const handleBirthChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setBirthDate(selectedDate);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        handleChange('birth', `${yyyy}-${mm}-${dd}`);
      }
      setShowBirthModal(false);
    } else {
      if (selectedDate) setBirthDate(selectedDate);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" ref={scrollRef}>
        <View style={styles.cardBox}>
          <Text style={styles.title}>승선 정보 입력</Text>

          {[
            { label: '이름', key: 'name', placeholder: '홍길동' },
            { label: '생년월일', key: 'birth', placeholder: '생년월일 선택' },
            { label: '성별', key: 'gender', placeholder: '성별 선택' },
            { label: '연락처', key: 'phone', placeholder: '010-1234-5678' },
            { label: '비상 연락처', key: 'emergency', placeholder: '예: 보호자 연락처' },
            { label: '주소', key: 'address', placeholder: '주소를 입력해주세요.' },
          ].map(({ label, key, placeholder }) => (
            <View style={styles.field} key={key}>
              <Text style={styles.label}>{label}</Text>
              {key === 'birth' ? (
                <TouchableOpacity onPress={() => setShowBirthModal(true)} style={styles.input}>
                  <Text style={styles.text}>{form.birth || placeholder}</Text>
                </TouchableOpacity>
              ) : key === 'gender' ? (
                <TouchableOpacity onPress={() => setShowGenderModal(true)} style={styles.input}>
                  <Text style={styles.text}>{form.gender || placeholder}</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChangeText={(text) =>
                    key === 'phone' || key === 'emergency'
                      ? handlePhoneChange(key as keyof typeof form, text)
                      : handleChange(key as keyof typeof form, text)
                  }
                  keyboardType={key === 'phone' || key === 'emergency' ? 'phone-pad' : 'default'}
                />
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
            <Ionicons name={agreed ? 'checkbox-outline' : 'square-outline'} size={22} color={agreed ? '#1e88e5' : '#888'} />
            <View style={styles.checkboxLabelContainer}>
              <Text style={styles.checkboxLabel}> </Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(true)}>
                <Text style={[styles.checkboxLabel, styles.linkText]}>개인정보 수집 및 이용</Text>
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>에 동의합니다.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreedThirdParty(!agreedThirdParty)}>
            <Ionicons name={agreedThirdParty ? 'checkbox-outline' : 'square-outline'} size={22} color={agreedThirdParty ? '#1e88e5' : '#888'} />
            <View style={styles.checkboxLabelContainer}>
              <Text style={styles.checkboxLabel}> </Text>
              <TouchableOpacity onPress={() => setShowThirdPartyModal(true)}>
                <Text style={[styles.checkboxLabel, styles.linkText]}>제3자 개인정보 제공</Text>
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>에 동의합니다.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>저장</Text>
          </TouchableOpacity>
        </View>

        <Modal isVisible={showBirthModal} onBackdropPress={() => setShowBirthModal(false)} style={styles.modalWrap}>
          <View style={styles.modalBox}>
            <DateTimePicker
              value={birthDate}
              mode="date"
              display="spinner"
              onChange={handleBirthChange}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.submitButton} onPress={confirmBirthDate}>
                <Text style={styles.submitButtonText}>확인</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>

        <Modal isVisible={showGenderModal} onBackdropPress={() => setShowGenderModal(false)} style={styles.modalWrap}>
          <View style={styles.modalBox}>
            {['남', '여'].map((gender) => (
              <TouchableOpacity key={gender} onPress={() => {
                setShowGenderModal(false);
                handleChange('gender', gender);
              }}>
                <Text style={styles.genderOption}>{gender}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowGenderModal(false)}>
              <Text style={[styles.genderOption, { color: '#888' }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <Modal isVisible={showPrivacyModal} onBackdropPress={() => setShowPrivacyModal(false)} style={styles.modalWrap}>
          <View style={styles.webViewModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>개인정보 수집 및 이용 동의</Text>
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

        <Modal isVisible={showThirdPartyModal} onBackdropPress={() => setShowThirdPartyModal(false)} style={styles.modalWrap}>
          <View style={styles.webViewModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>제3자 개인정보 제공 동의</Text>
              <TouchableOpacity onPress={() => setShowThirdPartyModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <WebView 
              source={{ 
                html: thirdPartyHtml || '<html><body><h1>로딩 중...</h1></body></html>',
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  cardBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 60,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    color: '#1e88e5',
    fontFamily: 'GiantRegular',
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontFamily: 'GiantRegular',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    fontFamily: 'GiantRegular',
  },
  text: {
    fontFamily: 'GiantRegular',
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkboxLabelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'GiantRegular',
  },
  linkText: {
    color: '#1e88e5',
    textDecorationLine: 'underline',
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#1e88e5',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  modalWrap: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 10,
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
  genderOption: {
    fontSize: 18,
    paddingVertical: 12,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
  },
});
