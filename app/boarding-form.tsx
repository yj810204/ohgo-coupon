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
  ActivityIndicator,
} from 'react-native';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUser } from '../utils/secure-store';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import Modal from 'react-native-modal';

export default function BoardingForm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { uuid, name: paramName, dob, returnTo, date, dateDisplay, tripNumber } = params;
  const scrollRef = useRef<ScrollView>(null);

  // Individual state variables instead of form object
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [emergency, setEmergency] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState('');

  // Privacy agreement states
  const [agreed, setAgreed] = useState(false);
  const [agreedThirdParty, setAgreedThirdParty] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showThirdPartyModal, setShowThirdPartyModal] = useState(false);
  const [privacyHtml, setPrivacyHtml] = useState('');
  const [thirdPartyHtml, setThirdPartyHtml] = useState('');

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
        // Set initial values from params if available
        if (paramName) setName(paramName.toString());
        if (dob) setBirth(dob.toString());
        
        let userUuid = '';
        
        // Check if logged-in user is admin
        const loggedInUser = await getUser();
        if (loggedInUser?.uuid) {
          const loggedInUserDoc = await getDoc(doc(db, 'users', loggedInUser.uuid));
          if (loggedInUserDoc.exists()) {
            const loggedInUserData = loggedInUserDoc.data();
            setIsAdmin(!!loggedInUserData.isAdmin);
          }
        }
        
        // Load user data if UUID is provided
        if (uuid) {
          userUuid = uuid.toString();
          const snap = await getDoc(doc(db, 'users', userUuid, 'boarding', 'info'));
          if (snap.exists()) {
            const data = snap.data();
            setName(data.name || paramName || '');
            setBirth(data.birth || dob || '');
            setGender(data.gender || '');
            setPhone(data.phone || '');
            setEmergency(data.emergency || '');
            setAddress(data.address || '');
            setAgreed(!!data.agreed);
            setAgreedThirdParty(!!data.agreedThirdParty);
            setRole(data.role || '');
          }
        } else {
          // If no UUID provided, load logged-in user's data
          const user = await getUser();
          if (user?.uuid) {
            userUuid = user.uuid;
            const snap = await getDoc(doc(db, 'users', userUuid, 'boarding', 'info'));
            if (snap.exists()) {
              const data = snap.data();
              setName(data.name || '');
              setBirth(data.birth || '');
              setGender(data.gender || '');
              setPhone(data.phone || '');
              setEmergency(data.emergency || '');
              setAddress(data.address || '');
              setAgreed(!!data.agreed);
              setAgreedThirdParty(!!data.agreedThirdParty);
              setRole(data.role || '');
            }
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

  // Format phone number as user types
  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as XXX-XXXX-XXXX
    let formatted = '';
    if (cleaned.length <= 3) {
      formatted = cleaned;
    } else if (cleaned.length <= 7) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    }
    
    return formatted;
  };

  // Format DOB as user types
  const formatDOB = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as YYYY-MM-DD
    let formatted = '';
    if (cleaned.length <= 4) {
      formatted = cleaned;
    } else if (cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    } else {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
    
    return formatted;
  };

  const handleSubmit = async () => {
    if (!name || !birth || !gender || !phone || !emergency || !address) {
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
    
    // Validate birth format
    const birthClean = birth.replace(/-/g, '');
    if (!/^[0-9]{6}$|^[0-9]{8}$/.test(birthClean)) {
      Alert.alert('생년월일 확인', '생년월일은 6자리 또는 8자리여야 합니다.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Use the UUID from params if available, otherwise use the logged-in user's UUID
      let userUuid;
      if (uuid) {
        userUuid = uuid.toString();
      } else {
        const user = await getUser();
        if (!user?.uuid) throw new Error('UUID가 없습니다.');
        userUuid = user.uuid;
      }
      
      // Prepare boarding info data
      const boardingData: {
        name: string;
        birth: string;
        gender: string;
        phone: string;
        emergency: string;
        address: string;
        agreed: boolean;
        agreedThirdParty: boolean;
        role?: string;
      } = {
        name,
        birth,
        gender,
        phone,
        emergency,
        address,
        agreed,
        agreedThirdParty,
      };
      
      // Add role field only if it's not 'none'
      if (isAdmin && role && role !== 'none') {
        boardingData.role = role;
      }
      
      await setDoc(doc(db, 'users', userUuid, 'boarding', 'info'), boardingData);
      
      // If user is admin and role is selected (and not 'none'), update the main user document with the role
      if (isAdmin && role && role !== 'none') {
        await setDoc(doc(db, 'users', userUuid), { role }, { merge: true });
      } else if (isAdmin && role === 'none') {
        // If 'none' is selected, remove the role field from the main user document
        await setDoc(doc(db, 'users', userUuid), { role: null }, { merge: true });
      }
      
      Alert.alert('저장 완료', '승선 정보가 저장되었습니다.');
      
      // Navigate back to the appropriate screen
      if (returnTo === 'roster-list' && date && dateDisplay && tripNumber) {
        router.push({
          pathname: '/roster-list',
          params: { 
            date, 
            dateDisplay, 
            tripNumber 
          }
        });
      } else {
        router.back();
      }
    } catch (e) {
      console.error('저장 오류:', e);
      Alert.alert('오류', '정보 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" ref={scrollRef}>
        <View style={styles.cardBox}>
          <Text style={styles.title}>승선 정보 입력</Text>

          <View style={styles.field}>
            <Text style={styles.label}>이름 *</Text>
            <TextInput
              style={styles.input}
              placeholder="홍길동"
              value={name}
              onChangeText={setName}
            />
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>생년월일 *</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 19900101"
              value={birth}
              onChangeText={(text) => setBirth(formatDOB(text))}
              keyboardType="number-pad"
            />
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>성별 *</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity 
                style={[
                  styles.genderButton, 
                  gender === '남' && styles.selectedGenderButton
                ]}
                onPress={() => setGender('남')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === '남' && styles.selectedGenderButtonText
                ]}>남</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.genderButton, 
                  gender === '여' && styles.selectedGenderButton
                ]}
                onPress={() => setGender('여')}
              >
                <Text style={[
                  styles.genderButtonText,
                  gender === '여' && styles.selectedGenderButtonText
                ]}>여</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>연락처 *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(text) => setPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>비상 연락처 *</Text>
            <TextInput
              style={styles.input}
              value={emergency}
              onChangeText={(text) => setEmergency(formatPhoneNumber(text))}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>주소 *</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {isAdmin && (
            <View style={styles.field}>
              <Text style={styles.label}>역할</Text>
              <View style={styles.genderContainer}>
                <TouchableOpacity 
                  style={[
                    styles.genderButton, 
                    role === 'captain' && styles.selectedGenderButton
                  ]}
                  onPress={() => setRole('captain')}
                >
                  <Text style={[
                    styles.genderButtonText,
                    role === 'captain' && styles.selectedGenderButtonText
                  ]}>선장</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.genderButton, 
                    role === 'sailor' && styles.selectedGenderButton
                  ]}
                  onPress={() => setRole('sailor')}
                >
                  <Text style={[
                    styles.genderButtonText,
                    role === 'sailor' && styles.selectedGenderButtonText
                  ]}>선원</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.genderButton, 
                    role === 'none' && styles.selectedGenderButton
                  ]}
                  onPress={() => setRole('none')}
                >
                  <Text style={[
                    styles.genderButtonText,
                    role === 'none' && styles.selectedGenderButtonText
                  ]}>없음</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

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
  // New styles from roster-member-search
  genderContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginRight: 8,
  },
  selectedGenderButton: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1e88e5',
    borderWidth: 1,
  },
  genderButtonText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  selectedGenderButtonText: {
    color: '#1e88e5',
  },
});