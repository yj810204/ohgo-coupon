import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RosterItem = {
  id: string;
  name: string;
  birth: string;
  gender: string;
  phone: string;
  emergency: string;
  address: string;
  hasRoster: boolean;
  isCaptain?: boolean;
  isSailor?: boolean;
  role?: string;
};

// Key for storing font size preference in AsyncStorage
const FONT_SIZE_STORAGE_KEY = 'roster_font_size_preference';

// A4 용지 비율에 맞는 크기 설정
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

export default function LocationTimeSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { date, dateDisplay, dateYear, dateMonth, dateDay, rosterItems: rosterItemsJson } = params;

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('12');
  const [savingImage, setSavingImage] = useState(false);
  const [rosterItems, setRosterItems] = useState<RosterItem[]>([]);
  const [shipName, setShipName] = useState<string>('');
  const [shipTon, setShipTon] = useState<string>('');
  const [desc01, setDesc01] = useState<string>('');
  const [desc02, setDesc02] = useState<string>('');
  const [onBoard, setOnBoard] = useState<boolean>(false);
  const [selectedFontSize, setSelectedFontSize] = useState<string>('medium');

  // Function to save font size preference to AsyncStorage
  const saveFontSizePreference = async (fontSize: string) => {
    try {
      await AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
      console.log('Font size preference saved:', fontSize);
    } catch (error) {
      console.error('Error saving font size preference:', error);
    }
  };

  // Function to load font size preference from AsyncStorage
  const loadFontSizePreference = async () => {
    try {
      const savedFontSize = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedFontSize !== null) {
        console.log('Loaded font size preference:', savedFontSize);
        setSelectedFontSize(savedFontSize);
      }
    } catch (error) {
      console.error('Error loading font size preference:', error);
    }
  };

  const viewShotRef = useRef<ViewShot>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  // 서버에서 불러오는 정보 관련 로직 (수정 없음)
  const checkTripStatus = async () => {
    if (!date || !params.tripNumber) return false;
    try {
      const tripsDocRef = doc(db, 'trips', String(date));
      const tripsDocSnap = await getDoc(tripsDocRef);
      const tripNum = parseInt(params.tripNumber as string) || 1;
      if (tripsDocSnap.exists()) {
        const tripKey = `trip${tripNum}`;
        const tripData = tripsDocSnap.data()[tripKey];
        if (tripData && tripData.confirmed) {
          Alert.alert(
              '알림',
              `${dateDisplay} ${tripNum}항차는 이미 출항 확정되었습니다.`,
              [{ text: '확인', onPress: () => router.back() }]
          );
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking trip status:', error);
      return false;
    }
  };

  useEffect(() => {
    const init = async () => {
      const tripAlreadyMade = await checkTripStatus();
      if (!tripAlreadyMade) {
        loadLocations();
        // Load saved font size preference
        await loadFontSizePreference();
        if (rosterItemsJson) {
          try {
            const parsedRosterItems = JSON.parse(rosterItemsJson as string) as RosterItem[];
            setRosterItems(parsedRosterItems);
          } catch (error) {
            console.error('Error parsing roster items:', error);
          }
        }
      }
    };
    init();
  }, []);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const configDocRef = doc(db, 'config', 'roster');
      const configDocSnap = await getDoc(configDocRef);
      if (configDocSnap.exists()) {
        const data = configDocSnap.data();
        const fallbackLocations = ['내만'];
        const areas = data.areas && data.areas.length > 0 ? data.areas : fallbackLocations;
        setLocations(areas);
        setSelectedLocations([areas[0]]);
        setShipName(data.ship_name || '');
        setShipTon(data.ton || '');
        setDesc01(data.desc01 || '');
        setDesc02(data.desc02 || '');
        setOnBoard(data.on_board !== undefined ? data.on_board : false);
      } else {
        const fallbackLocations = ['내만'];
        setLocations(fallbackLocations);
        setSelectedLocations([fallbackLocations[0]]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
      const fallbackLocations = ['내만'];
      setLocations(fallbackLocations);
      setSelectedLocations([fallbackLocations[0]]);
    } finally {
      setLoading(false);
    }
  };

  const requestMediaLibraryPermissions = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리에 저장하기 위해 미디어 라이브러리 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  // ✅ members 데이터 삭제 버그가 해결된 함수
  const updateAttendanceWithLocationAndTime = async () => {
    try {
      if (!date) {
        console.error('No date provided for attendance update');
        return false;
      }
      const attendanceRef = doc(db, 'attendance', String(date));
      const attendanceSnap = await getDoc(attendanceRef);
      const tripNum = parseInt(params.tripNumber as string) || 1;

      if (attendanceSnap.exists()) {
        // 문서가 존재하면 'members'를 제외한 필드만 업데이트
        await updateDoc(attendanceRef, {
          location: selectedLocations,
          arrivalTime: selectedTime,
          tripNumber: tripNum,
        });
      } else {
        // 문서가 없으면 'members: []'를 포함하여 새로 생성
        await setDoc(attendanceRef, {
          location: selectedLocations,
          arrivalTime: selectedTime,
          tripNumber: tripNum,
          members: [],
        });
      }
      return true;
    } catch (error) {
      console.error('Error updating attendance:', error);
      return false;
    }
  };

  const captureAndSaveImage = async () => {
    try {
      const success = await updateAttendanceWithLocationAndTime();
      if (!success) return; // 업데이트 실패 시 중단

      const hasPermission = await requestMediaLibraryPermissions();
      if (!hasPermission) return;
      setSavingImage(true);

      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        const fileName = `roster-image-${Date.now()}.jpg`;
        const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: cacheUri });

        router.push({
          pathname: '/roster-preview',
          params: { 
            imageUri: cacheUri, 
            date: date, 
            tripNumber: params.tripNumber,
            fontSize: selectedFontSize 
          },
        });
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };

  // Font size mapping for roster list text
  const getFontSize = (size: string) => {
    switch(size) {
      case 'small': return 8;
      case 'medium': return 10; // Default size
      case 'large': return 12;
      case 'xlarge': return 14;
      default: return 10;
    }
  };

  // Get cell font size based on selected font size
  const cellFontSize = getFontSize(selectedFontSize);
  
  // ✅ A4 양식 렌더링을 위한 JSX (출력 부분만 수정)
  const renderA4Roster = () => (
      <View style={a4Styles.page}>
        <Text style={a4Styles.topDescription}>■ 낚시 관리 및 육성법 시행규칙 [별지 제16호서식]</Text>
        <View style={a4Styles.titleContainer}>
          <Text style={a4Styles.title}>승 선 자 명 부</Text>
          <Text style={a4Styles.shipName}>{shipName ? `(${shipName})` : ''}</Text>
        </View>
        <Text style={a4Styles.subDescription}>{desc01}</Text>
        <View style={a4Styles.metaInfoContainer}>
          <Text style={a4Styles.dateText}>(승선일 : {dateYear} 년 {dateMonth} 월 {dateDay} 일)</Text>
          <Text style={a4Styles.tonText}>{shipTon}</Text>
        </View>
        <View style={a4Styles.table}>
          <View style={a4Styles.tableHeader}>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '4%'}]}> </Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '10%'}]}>성명</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '14%'}]}>생년월일</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '6%'}]}>성별</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '32%'}]}>주소</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '14%'}]}>전화번호</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '14%'}]}>비상연락처</Text>
            <Text style={[a4Styles.cell, a4Styles.headerCell, {width: '6%', borderRightWidth: 0}]}>비고</Text>
          </View>
          {rosterItems.map((item, index) => (
              <View key={item.id} style={a4Styles.tableRow}>
                <Text style={[a4Styles.cell, {width: '4%', fontSize: cellFontSize}]}>{index + 1}</Text>
                <Text style={[a4Styles.cell, {width: '10%', fontSize: cellFontSize}]}>{item.name}</Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}>{item.birth}</Text>
                <Text style={[a4Styles.cell, {width: '6%', fontSize: cellFontSize}]}>{item.gender}</Text>
                <Text style={[a4Styles.cell, a4Styles.addressCell, {width: '32%', fontSize: cellFontSize}]}>{item.address}</Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}>{item.phone}</Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}>{item.emergency}</Text>
                <Text style={[a4Styles.cell, {width: '6%', borderRightWidth: 0, fontSize: cellFontSize}]}>
                  {item.role === 'captain' ? '선장' : item.role === 'sailor' ? '선원' : ''}
                </Text>
              </View>
          ))}
          {Array.from({ length: Math.max(0, 15 - rosterItems.length) }).map((_, index) => (
              <View key={`empty-${index}`} style={a4Styles.tableRow}>
                <Text style={[a4Styles.cell, {width: '4%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '10%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '6%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '32%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '14%', fontSize: cellFontSize}]}></Text>
                <Text style={[a4Styles.cell, {width: '6%', borderRightWidth: 0, fontSize: cellFontSize}]}></Text>
              </View>
          ))}
        </View>
        <View style={a4Styles.footer}>
          {onBoard && <Text style={a4Styles.onBoardText}>선 상</Text>}
          <View style={a4Styles.infoRow}><Text style={a4Styles.infoLabel}>위       치 :</Text><Text style={a4Styles.infoValue}>{selectedLocations.join(', ')}</Text></View>
          <View style={a4Styles.infoRow}><Text style={a4Styles.infoLabel}>입항시간 :</Text><Text style={a4Styles.infoValue}>{selectedTime} 시</Text></View>
          <Text style={a4Styles.footerDescription}>{desc02}</Text>
        </View>
      </View>
  );

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={{ position: 'absolute', top: -9999, left: -9999, width: A4_WIDTH, height: A4_HEIGHT }}>
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
            {renderA4Roster()}
          </ViewShot>
        </View>
        <View style={styles.headerContainer}><Text style={styles.headerTitle}>위치 및 입항시간 선택</Text></View>
        {loading ? (
            <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1e88e5" /><Text style={styles.loadingText}>정보를 불러오는 중...</Text></View>
        ) : (
            <ScrollView style={styles.contentContainer}>
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>위치 선택 <Text style={styles.requiredAsterisk}>*</Text></Text>
                <View style={styles.multiSelectContainer}>
                  {locations.map((location, index) => (
                      <TouchableOpacity key={index} style={[styles.locationItem, selectedLocations.includes(location) && styles.locationItemSelected]} onPress={() => {
                        const newLocations = selectedLocations.includes(location) ? selectedLocations.filter(loc => loc !== location) : [...selectedLocations, location];
                        if (newLocations.length > 0) { setSelectedLocations(newLocations); }
                      }}>
                        <Text style={[styles.locationItemText, selectedLocations.includes(location) && styles.locationItemTextSelected]}>{location}</Text>
                      </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>입항시간 선택 <Text style={styles.requiredAsterisk}>*</Text></Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={selectedTime} onValueChange={(itemValue) => setSelectedTime(itemValue)} style={styles.picker}>
                    {hours.map((hour) => <Picker.Item key={hour} label={`${hour}시`} value={hour} />)}
                  </Picker>
                </View>
              </View>
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>글자크기</Text>
                <View style={styles.fontSizeContainer}>
                  <TouchableOpacity 
                    style={[styles.fontSizeButton, selectedFontSize === 'small' && styles.fontSizeButtonSelected]} 
                    onPress={() => {
                      setSelectedFontSize('small');
                      saveFontSizePreference('small');
                    }}>
                    <Text style={[styles.fontSizeButtonText, selectedFontSize === 'small' && styles.fontSizeButtonTextSelected]}>작게</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.fontSizeButton, selectedFontSize === 'medium' && styles.fontSizeButtonSelected]} 
                    onPress={() => {
                      setSelectedFontSize('medium');
                      saveFontSizePreference('medium');
                    }}>
                    <Text style={[styles.fontSizeButtonText, selectedFontSize === 'medium' && styles.fontSizeButtonTextSelected]}>보통</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.fontSizeButton, selectedFontSize === 'large' && styles.fontSizeButtonSelected]} 
                    onPress={() => {
                      setSelectedFontSize('large');
                      saveFontSizePreference('large');
                    }}>
                    <Text style={[styles.fontSizeButtonText, selectedFontSize === 'large' && styles.fontSizeButtonTextSelected]}>크게</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.fontSizeButton, selectedFontSize === 'xlarge' && styles.fontSizeButtonSelected]} 
                    onPress={() => {
                      setSelectedFontSize('xlarge');
                      saveFontSizePreference('xlarge');
                    }}>
                    <Text style={[styles.fontSizeButtonText, selectedFontSize === 'xlarge' && styles.fontSizeButtonTextSelected]}>아주크게</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
        )}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.buttonText}>이전</Text></TouchableOpacity>
          <TouchableOpacity style={styles.nextButton} onPress={captureAndSaveImage} disabled={savingImage}>
            {savingImage ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>다음</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
  );
}

// A4 양식 스타일 (출력 부분)
const a4Styles = StyleSheet.create({
  page:{width:A4_WIDTH,height:A4_HEIGHT,backgroundColor:'white',padding:40,fontFamily:Platform.OS==='ios'?'AppleSDGothicNeo-Regular':'sans-serif'},
  topDescription:{fontSize:12,textAlign:'left',marginBottom:20},
  titleContainer:{flexDirection:'row',justifyContent:'center',alignItems:'center',marginBottom:5},
  title:{fontSize:34,fontWeight:'bold'},
  shipName:{fontSize:28,fontWeight:'bold',marginLeft:15},
  subDescription:{fontSize:14,textAlign:'center'},
  metaInfoContainer:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',marginBottom:5,paddingVertical:5},
  dateText:{fontSize:16},
  tonText:{fontSize:16},
  table:{borderLeftWidth:1,borderRightWidth:1,borderColor:'#000',width:'100%'},
  tableHeader:{flexDirection:'row',backgroundColor:'#f0f0f0',borderBottomWidth:2,borderColor:'#000',borderTopWidth:1,},
  tableRow:{flexDirection:'row',borderBottomWidth:1,borderColor:'#000',height:40,maxHeight:40},
  cell:{fontSize:10,padding:3,textAlign:'center',borderRightWidth:1,borderColor:'#000',alignItems:'center',justifyContent:'center',display:'flex'},
  headerCell:{fontWeight:'bold',fontSize:12},
  addressCell:{textAlign:'left',fontSize:10},
  footer:{marginTop:20,alignItems:'center'},
  onBoardText:{fontSize:28,fontWeight:'bold',marginBottom:20},
  infoRow:{flexDirection:'row',justifyContent:'center',marginBottom:5},
  infoLabel:{fontSize:16,fontWeight:'bold',width:100,textAlign:'right'},
  infoValue:{fontSize:16,width:200,textAlign:'left',marginLeft:5},
  footerDescription:{marginTop:20,fontSize:14,textAlign:'center'}
});

// 기존 UI 스타일 (수정 없음)
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f7f9fc'},
  headerContainer:{padding:16,borderBottomWidth:1,borderBottomColor:'#e0e0e0',backgroundColor:'white'},
  headerTitle:{fontSize:18,fontFamily:"GiantRegular",color:'#333',textAlign:'center'},
  loadingContainer:{flex:1,justifyContent:'center',alignItems:'center',padding:20},
  loadingText:{marginTop:12,fontSize:16,fontFamily:"GiantRegular",color:'#666'},
  contentContainer:{flex:1,padding:16,paddingBottom:24},
  sectionContainer:{marginBottom:24,backgroundColor:'white',borderRadius:8,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:2,elevation:2},
  sectionTitle:{fontSize:16,fontFamily:"GiantRegular",color:'#333',marginBottom:12},
  pickerContainer:{borderWidth:1,borderColor:'#e0e0e0',borderRadius:8,overflow:'hidden'},
  picker:{width:'100%'},
  multiSelectContainer:{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-start'},
  locationItem:{backgroundColor:'#f0f0f0',borderRadius:8,paddingVertical:8,paddingHorizontal:12,margin:4,borderWidth:1,borderColor:'#e0e0e0'},
  locationItemSelected:{backgroundColor:'#1e88e5',borderColor:'#1565c0'},
  locationItemText:{fontSize:14,fontFamily:"GiantRegular",color:'#333'},
  locationItemTextSelected:{color:'white'},
  fontSizeContainer:{flexDirection:'row',justifyContent:'space-between',marginTop:8},
  fontSizeButton:{flex:1,backgroundColor:'#f0f0f0',borderRadius:8,paddingVertical:10,paddingHorizontal:8,margin:4,borderWidth:1,borderColor:'#e0e0e0',alignItems:'center'},
  fontSizeButtonSelected:{backgroundColor:'#1e88e5',borderColor:'#1565c0'},
  fontSizeButtonText:{fontSize:14,fontFamily:"GiantRegular",color:'#333',textAlign:'center'},
  fontSizeButtonTextSelected:{color:'white'},
  buttonContainer:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'white',padding:16,borderTopWidth:1,borderTopColor:'#e0e0e0',shadowColor:'#000',shadowOffset:{width:0,height:-2},shadowOpacity:0.1,shadowRadius:4,elevation:5},
  backButton:{flex:1,backgroundColor:'#9e9e9e',paddingVertical:12,borderRadius:8,alignItems:'center',marginRight:8},
  nextButton:{flex:1,backgroundColor:'#1e88e5',paddingVertical:12,borderRadius:8,alignItems:'center',marginLeft:8},
  buttonText:{color:'white',fontSize:16,fontFamily:"GiantRegular"},
  requiredAsterisk:{color:'#f44336',fontSize:16,fontWeight:'bold'}
});