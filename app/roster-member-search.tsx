import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  TextInput, 
  FlatList, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Asset } from 'expo-asset';
import Modal from 'react-native-modal';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { v5 as uuidv5 } from 'uuid';

// Define interface for user data
interface UserData {
  id: string;
  uuid: any;
  name: string;
  dob?: string;
  phone?: string;
  hasBoarding?: boolean;
  [key: string]: any; // For other potential properties
}

export default function RosterMemberSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { date, dateDisplay, tripNumber } = params;

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserData | null>(null);
  const [showNewMemberForm, setShowNewMemberForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberDob, setNewMemberDob] = useState('');
  const [newMemberGender, setNewMemberGender] = useState('');
  const [newMemberEmergency, setNewMemberEmergency] = useState('');
  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Additional state variables from boarding-form
  const scrollRef = useRef<ScrollView>(null);
  const [agreed, setAgreed] = useState(false);
  const [agreedThirdParty, setAgreedThirdParty] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showThirdPartyModal, setShowThirdPartyModal] = useState(false);
  const [privacyHtml, setPrivacyHtml] = useState('');
  const [thirdPartyHtml, setThirdPartyHtml] = useState('');

  // Load HTML file function from boarding-form
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

  // Load HTML content on component mount
  useEffect(() => {
    (async () => {
      try {
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

  // Search for members by name
  const searchMembers = async () => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Get all users from Firestore
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      // Filter users by name (case-insensitive)
      const searchTextLower = searchText.toLowerCase();
      const filteredUsers: UserData[] = snapshot.docs
        .map(doc => ({
          id: doc.id,
          uuid: doc.data().uuid,
          ...doc.data()
        } as UserData))
        .filter(user => 
          user.name && user.name.toLowerCase().includes(searchTextLower)
        );
      
      // Get additional info for each user (boarding status)
      const usersWithDetails = await Promise.all(
        filteredUsers.map(async (user) => {
          // Check if user has boarding info
          const boardingInfoRef = doc(db, 'users', user.uuid, 'boarding', 'info');
          const boardingInfoSnap = await getDoc(boardingInfoRef);
          const hasBoarding = boardingInfoSnap.exists();
          
          return {
            ...user,
            hasBoarding
          };
        })
      );
      
      setSearchResults(usersWithDetails);
    } catch (error) {
      console.error('Error searching members:', error);
      Alert.alert('오류', '회원 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add selected member to the roster
  const addMemberToRoster = async (member: UserData) => {
    if (!date || !tripNumber) {
      Alert.alert('오류', '날짜 또는 항차 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // Get the attendance document for the specified date
      const attendanceRef = doc(db, 'attendance', String(date));
      const attendanceSnap = await getDoc(attendanceRef);

      // Get existing members or initialize empty array
      let memberIds: string[] = attendanceSnap.exists() && attendanceSnap.data().members
        ? attendanceSnap.data().members
        : [];

      // Check if member is already in the roster
      if (memberIds.includes(member.uuid)) {
        Alert.alert('알림', `${member.name}님은 이미 명부에 추가되어 있습니다.`);
        setIsLoading(false);
        return;
      }

      // Add member to the roster
      memberIds.push(member.uuid);

      // Update or create the attendance document
      if (attendanceSnap.exists()) {
        await updateDoc(attendanceRef, {
          members: memberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      } else {
        await setDoc(attendanceRef, {
          members: memberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      }

      Alert.alert(
        '성공', 
        `${member.name}님이 명부에 추가되었습니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              // Navigate back to roster list
              router.push({
                pathname: '/roster-list',
                params: { 
                  date: date,
                  dateDisplay: dateDisplay,
                  tripNumber: tripNumber
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error adding member to roster:', error);
      Alert.alert('오류', '명부에 회원을 추가하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new member and add to roster
  const createNewMemberAndAddToRoster = async () => {
    // Validate form
    if (!newMemberName.trim()) {
      Alert.alert('알림', '이름을 입력해주세요.');
      return;
    }
    
    if (!newMemberPhone.trim()) {
      Alert.alert('알림', '전화번호를 입력해주세요.');
      return;
    }
    
    if (!newMemberDob.trim() || newMemberDob.length !== 8) {
      Alert.alert('알림', '생년월일을 8자리로 입력해주세요. (예: 19900101)');
      return;
    }
    
    if (!newMemberGender) {
      Alert.alert('알림', '성별을 선택해주세요.');
      return;
    }
    
    if (!newMemberEmergency.trim()) {
      Alert.alert('알림', '비상 연락처를 입력해주세요.');
      return;
    }
    
    if (!newMemberAddress.trim()) {
      Alert.alert('알림', '주소를 입력해주세요.');
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

    setIsSubmitting(true);
    try {
      // Generate UUID for new member
      const uuid = generateUUID();
      
      // Create new user document
      const userRef = doc(db, 'users', uuid);
      await setDoc(userRef, {
        name: newMemberName,
        dob: newMemberDob,
        phone: newMemberPhone,
        uuid: uuid,
        createdAt: new Date().toISOString()
      });
      
      // Create boarding info document
      const boardingInfoRef = doc(db, 'users', uuid, 'boarding', 'info');
      await setDoc(boardingInfoRef, {
        name: newMemberName,
        birth: newMemberDob,
        gender: newMemberGender,
        phone: newMemberPhone,
        emergency: newMemberEmergency,
        address: newMemberAddress,
        agreed: agreed,
        agreedThirdParty: agreedThirdParty
      });
      
      // Add new member to roster
      const attendanceRef = doc(db, 'attendance', String(date));
      const attendanceSnap = await getDoc(attendanceRef);
      
      let memberIds: string[] = attendanceSnap.exists() && attendanceSnap.data().members
        ? attendanceSnap.data().members
        : [];
      
      memberIds.push(uuid);
      
      if (attendanceSnap.exists()) {
        await updateDoc(attendanceRef, {
          members: memberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      } else {
        await setDoc(attendanceRef, {
          members: memberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      }
      
      Alert.alert(
        '성공', 
        `${newMemberName}님이 가입되어 명부에 추가되었습니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              // Navigate back to roster list
              router.push({
                pathname: '/roster-list',
                params: { 
                  date: date,
                  dateDisplay: dateDisplay,
                  tripNumber: tripNumber
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating new member:', error);
      Alert.alert('오류', '새 회원을 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };


// Generate UUID for new member using the same deterministic approach as in firebase-auth.ts
  const generateUUID = () => {
    // 🔐 Use the same UUID namespace as in firebase-auth.ts
    const UUID_NAMESPACE = '7b6a5c20-7aef-11ee-b962-0242ac120002';
    
    // Normalize DOB to ensure consistent format
    const normalizedDob = normalizeDob(newMemberDob);
    if (!normalizedDob) {
      console.error('Invalid DOB format');
      // Fallback to random UUID if DOB format is invalid
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    // Generate deterministic UUID using the same approach as in firebase-auth.ts
    return uuidv5(`${newMemberName}-${normalizedDob}`, UUID_NAMESPACE);
  };
  
  // Normalize DOB function (same as in firebase-auth.ts)
  function normalizeDob(input: string): string | null {
    if (/^\d{6}$/.test(input)) {
      const year = parseInt(input.slice(0, 2), 10);
      const fullYear = year >= 50 ? 1900 + year : 2000 + year;
      return `${fullYear}${input.slice(2)}`;
    } else if (/^\d{8}$/.test(input)) {
      return input;
    } else {
      return null;
    }
  }

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
    
    setNewMemberPhone(formatted);
  };

  // Format DOB as user types
  const formatDOB = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 8 digits
    const limited = cleaned.slice(0, 8);
    
    setNewMemberDob(limited);
  };



  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        
        {!showNewMemberForm ? (
          // Member search view
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="이름 검색"
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={searchMembers}
                returnKeyType="search"
              />
              <TouchableOpacity 
                onPress={searchMembers}
                style={styles.searchButton}
                disabled={isLoading}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowNewMemberForm(true)}
                style={styles.newMemberButton}
              >
                <Text style={styles.newMemberButtonText}>신규 등록</Text>
              </TouchableOpacity>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1e88e5" />
                <Text style={styles.loadingText}>검색 중...</Text>
              </View>
            ) : (
              <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.uuid}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.memberItem}
                      onPress={() => setSelectedMember(item)}
                    >
                      <View>
                        <Text style={styles.memberName}>{item.name}</Text>
                        <Text style={styles.memberInfo}>
                          {item.dob?.length === 8 ? 
                            `${item.dob.slice(2, 4)}-${item.dob.slice(4, 6)}-${item.dob.slice(6, 8)}` : 
                            item.dob}
                        </Text>
                      </View>
                      {item.hasBoarding && (
                        <View style={styles.boardingBadge}>
                          <Text style={styles.boardingBadgeText}>명부 정보 있음</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    searchText.trim() ? (
                      <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                    ) : null
                  }
                  ListFooterComponent={<View style={{ height: 50 }} />}
                />
            )}
            
            {/* Member selection modal */}
            {selectedMember && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>회원 추가</Text>
                  <Text style={styles.modalText}>
                    {selectedMember.name}님을 명부에 추가하시겠습니까?
                  </Text>
                  
                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={() => setSelectedMember(null)}
                    >
                      <Text style={styles.modalButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.modalConfirmButton]}
                      onPress={() => {
                        addMemberToRoster(selectedMember);
                        setSelectedMember(null);
                      }}
                    >
                      <Text style={[styles.modalButtonText, styles.modalConfirmButtonText]}>
                        추가
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : (
          // New member registration form
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled" ref={scrollRef}>
            <View style={styles.topActionsContainer}>
              <View style={{flex: 1}}></View>
            </View>
            <View style={styles.cardBox}>
              <View style={styles.field}>
                <Text style={styles.label}>이름 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="홍길동"
                  value={newMemberName}
                  onChangeText={setNewMemberName}
                />
              </View>
              
              <View style={styles.field}>
                <Text style={styles.label}>생년월일 * (YYYYMMDD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 19900101"
                  value={newMemberDob}
                  onChangeText={formatDOB}
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </View>
              
              <View style={styles.field}>
                <Text style={styles.label}>성별</Text>
                <View style={styles.genderContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.genderButton, 
                      newMemberGender === '남' && styles.selectedGenderButton
                    ]}
                    onPress={() => setNewMemberGender('남')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      newMemberGender === '남' && styles.selectedGenderButtonText
                    ]}>남</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.genderButton, 
                      newMemberGender === '여' && styles.selectedGenderButton
                    ]}
                    onPress={() => setNewMemberGender('여')}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      newMemberGender === '여' && styles.selectedGenderButtonText
                    ]}>여</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.field}>
                <Text style={styles.label}>연락처 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="010-1234-5678"
                  value={newMemberPhone}
                  onChangeText={formatPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.field}>
                <Text style={styles.label}>비상 연락처</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 보호자 연락처"
                  value={newMemberEmergency}
                  onChangeText={setNewMemberEmergency}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.field}>
                <Text style={styles.label}>주소</Text>
                <TextInput
                  style={styles.input}
                  placeholder="주소를 입력해주세요."
                  value={newMemberAddress}
                  onChangeText={setNewMemberAddress}
                />
              </View>
              
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
              
              <View style={styles.formButtons}>
                <TouchableOpacity 
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={() => setShowNewMemberForm(false)}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.formButton, styles.submitButton]}
                  onPress={createNewMemberAndAddToRoster}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>등록</Text>
                  )}
                </TouchableOpacity>
              </View>
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
            
            <View style={{ height: 50 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  topActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  iconButton: {
    padding: 8,
  },
  newMemberButton: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginLeft: 8,
    height: 40,
  },
  newMemberButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'GiantRegular',
  },
  searchContainer: {
    flex: 1,
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  searchButton: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginLeft: 8,
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  memberItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 4,
  },
  memberInfo: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  boardingBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  boardingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'GiantRegular',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  modalConfirmButton: {
    backgroundColor: '#1e88e5',
    marginLeft: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  modalConfirmButtonText: {
    color: '#fff',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
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
  formButtons: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 24
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#1e88e5',
    marginLeft: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#fff',
  },
  // Additional styles from boarding-form
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