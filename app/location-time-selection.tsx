import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import { collection, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

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

export default function LocationTimeSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { date, dateDisplay, dateYear, dateMonth, dateDay, rosterItems: rosterItemsJson } = params;

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('12');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const [rosterItems, setRosterItems] = useState<RosterItem[]>([]);
  const [shipName, setShipName] = useState<string>('');
  const [shipTon, setShipTon] = useState<string>('');
  const [desc01, setDesc01] = useState<string>('');
  const [desc02, setDesc02] = useState<string>('');
  const [onBoard, setOnBoard] = useState<boolean>(false);
  
  const viewShotRef = React.useRef<any>(null);

  // Generate hours for the picker
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  // Function to check if a trip has already been made
  const checkTripStatus = async () => {
    if (!date || !params.tripNumber) return false;
    
    try {
      // Check if this trip has already been confirmed
      const tripsDocRef = doc(db, 'trips', String(date));
      const tripsDocSnap = await getDoc(tripsDocRef);
      
      const tripNum = parseInt(params.tripNumber as string) || 1;
      
      if (tripsDocSnap.exists()) {
        const tripKey = `trip${tripNum}`;
        const tripData = tripsDocSnap.data()[tripKey];
        
        if (tripData && tripData.confirmed) {
          // This trip has already been confirmed
          Alert.alert(
            '알림',
            `${dateDisplay} ${tripNum}항차는 이미 출항 확정되었습니다.`,
            [
              {
                text: '확인',
                onPress: () => router.back()
              }
            ]
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
        
        // Parse roster items from JSON string
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
      // Get locations from Firebase config collection
      const configDocRef = doc(db, 'config', 'roster');
      const configDocSnap = await getDoc(configDocRef);
      
      if (configDocSnap.exists()) {
        // Get locations
        if (configDocSnap.data().areas) {
          setLocations(configDocSnap.data().areas);
          if (configDocSnap.data().areas.length > 0) {
            setSelectedLocations([configDocSnap.data().areas[0]]);
          }
        } else {
          // Fallback locations if not found in Firebase
          const fallbackLocations = ['내만'];
          setLocations(fallbackLocations);
          setSelectedLocations([fallbackLocations[0]]);
        }
        
        // Get ship_name and ton values
        if (configDocSnap.data().ship_name) {
          setShipName(configDocSnap.data().ship_name);
        }
        
        if (configDocSnap.data().ton) {
          setShipTon(configDocSnap.data().ton);
        }
        
        // Get desc01 and desc02 values
        if (configDocSnap.data().desc01) {
          setDesc01(configDocSnap.data().desc01);
        }
        
        if (configDocSnap.data().desc02) {
          setDesc02(configDocSnap.data().desc02);
        }
        
        // Check if on_board is true
        if (configDocSnap.data().on_board !== undefined) {
          setOnBoard(configDocSnap.data().on_board);
        }
      } else {
        // Fallback locations if not found in Firebase
        const fallbackLocations = ['내만'];
        setLocations(fallbackLocations);
        setSelectedLocations([fallbackLocations[0]]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
      
      // Set fallback locations
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

  // Function to update attendance with location and time
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
        // Update existing attendance document
        await updateDoc(attendanceRef, {
          location: selectedLocations,
          arrivalTime: selectedTime,
          tripNumber: tripNum
        });
      } else {
        // Create new attendance document
        await setDoc(attendanceRef, {
          location: selectedLocations,
          arrivalTime: selectedTime,
          tripNumber: tripNum,
          members: []
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error updating attendance with location and time:', error);
      return false;
    }
  };

  const captureAndSaveImage = async () => {
    try {
      // First update attendance with location and time
      await updateAttendanceWithLocationAndTime();
      
      // Request permissions first
      const hasPermission = await requestMediaLibraryPermissions();
      if (!hasPermission) return;

      setSavingImage(true);

      // Capture the view as an image
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        setCapturedImageUri(uri);
        
        // Ensure the captured image is saved to a consistent location in the cache directory
        const fileName = `roster-image-${Date.now()}.jpg`;
        const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        try {
          // Copy the captured image to the cache directory
          await FileSystem.copyAsync({
            from: uri,
            to: cacheUri
          });
          
          console.log('Image saved to cache:', cacheUri);
          
          // Navigate to the roster preview page with the cached image URI
          router.push({
            pathname: '/roster-preview',
            params: { 
              imageUri: cacheUri,
              date: date,
              tripNumber: params.tripNumber
            }
          });
        } catch (error) {
          console.error('Error saving image to cache:', error);
          // Fall back to the original URI if copying fails
          router.push({
            pathname: '/roster-preview',
            params: { 
              imageUri: uri,
              date: date,
              tripNumber: params.tripNumber
            }
          });
        }
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />


      {/* Hidden ViewShot component for capturing */}
      <View style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
          <View style={styles.boardingListContainer}>
            <Image
              source={require('../assets/images/boarding_list.png')}
              style={styles.boardingListImage}
            />
            <View style={styles.boardingListContent}>
              <View style={styles.boardingListTitleContainer}>
                <Text style={styles.boardingListTitle}>승 선 자 명 부</Text>
                <Text style={styles.boardingListShipName}>{shipName ? `(${shipName})` : ''}</Text>
              </View>
              <Text style={styles.boardingListDesc01}>{desc01}</Text>
              <View style={styles.boardingListDateContainer}>
                <Text style={styles.boardingListDate}>승선일 : {dateYear} 년 {dateMonth} 월 {dateDay} 일</Text>
              </View>
              <Text style={styles.boardingListTon}>{shipTon}</Text>
              <ScrollView style={styles.boardingListScroll}>
                {/* Table Header */}
                <View style={styles.boardingListTableHeader}>
                  <Text style={styles.boardingListHeaderNumber}>번호</Text>
                  <Text style={styles.boardingListHeaderName}>성명</Text>
                  <Text style={styles.boardingListHeaderBirth}>생년월일</Text>
                  <Text style={styles.boardingListHeaderGender}>성별</Text>
                  <Text style={styles.boardingListHeaderAddress}>주소</Text>
                  <Text style={styles.boardingListHeaderPhone}>전화번호</Text>
                  <Text style={styles.boardingListHeaderEmergency}>비상연락처</Text>
                  <Text style={styles.boardingListHeaderSailor}>비고</Text>
                </View>
                
                {/* Table Rows */}
                {rosterItems.map((item, index) => (
                  <View key={item.id} style={styles.boardingListItem}>
                    <Text style={styles.boardingListNumber}>{index + 1}</Text>
                    <Text style={styles.boardingListName}>{item.name}</Text>
                    <Text style={styles.boardingListBirth}>{item.birth}</Text>
                    <Text style={styles.boardingListGender}>{item.gender}</Text>
                    <Text style={styles.boardingListAddress}>{item.address}</Text>
                    <Text style={styles.boardingListPhone}>{item.phone}</Text>
                    <Text style={styles.boardingListEmergency}>{item.emergency}</Text>
                    <Text style={styles.boardingListSailor}>
                      {item.role === 'captain' && ' 선장'}
                      {item.role === 'sailor' && ' 선원'}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.boardingListInfoContainer}>
                {onBoard && (
                  <Text style={styles.boardingListOnBoard}>선  상</Text>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>위       치</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValue}>{selectedLocations.join(', ')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>입항시간</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValue}>{selectedTime}시</Text>
                </View>
                <Text style={styles.boardingListDesc02}>{desc02}</Text>
              </View>
            </View>
          </View>
        </ViewShot>
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>위치 및 입항시간 선택</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e88e5" />
          <Text style={styles.loadingText}>정보를 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView style={styles.contentContainer}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>위치 선택 <Text style={styles.requiredAsterisk}>*</Text></Text>
            <View style={styles.multiSelectContainer}>
              {locations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.locationItem,
                    selectedLocations.includes(location) && styles.locationItemSelected
                  ]}
                  onPress={() => {
                    if (selectedLocations.includes(location)) {
                      // Remove location if already selected, but ensure at least one location remains selected
                      const newLocations = selectedLocations.filter(loc => loc !== location);
                      if (newLocations.length > 0) {
                        setSelectedLocations(newLocations);
                      }
                    } else {
                      // Add location if not selected
                      setSelectedLocations([...selectedLocations, location]);
                    }
                  }}
                >
                  <Text style={[
                    styles.locationItemText,
                    selectedLocations.includes(location) && styles.locationItemTextSelected
                  ]}>
                    {location}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>입항시간 선택 <Text style={styles.requiredAsterisk}>*</Text></Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedTime}
                onValueChange={(itemValue) => setSelectedTime(itemValue)}
                style={styles.picker}
              >
                {hours.map((hour) => (
                  <Picker.Item key={hour} label={`${hour}시`} value={hour} />
                ))}
              </Picker>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>이전</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={captureAndSaveImage}
          disabled={savingImage}
        >
          {savingImage ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>다음</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: "GiantRegular",
    color: '#666',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "GiantRegular",
    color: '#333',
    marginBottom: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  multiSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  locationItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationItemSelected: {
    backgroundColor: '#1e88e5',
    borderColor: '#1565c0',
  },
  locationItemText: {
    fontSize: 14,
    fontFamily: "GiantRegular",
    color: '#333',
  },
  locationItemTextSelected: {
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f44336',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "GiantRegular"
  },
  // Boarding List Image styles
  boardingListContainer: {
    width: 1239,
    height: 1752,
    position: 'relative',
  },
  boardingListImage: {
    width: 1239,
    height: 1752,
    position: 'absolute',
  },
  boardingListContent: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 40,
  },
  boardingListTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  boardingListTitle: {
    fontSize: 34,
    color: '#000',
    fontWeight: 'bold',
    marginLeft: 400,
    lineHeight: 40,
  },
  boardingListShipName: {
    fontSize: 32,
    color: '#000',
    marginLeft: 20,
    fontWeight: 'bold',
    lineHeight: 38,
  },
  boardingListDesc01: {
    fontSize: 14,
    color: '#000',
    width: '100%',
    textAlign: 'center',
    lineHeight: 20,
  },
  boardingListDesc02: {
    fontSize: 14,
    color: '#000',
    width: '100%',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  boardingListOnBoard: {
    fontSize: 32,
    color: '#000',
    width: '100%',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 30,
    lineHeight: 38,
  },
  boardingListDateContainer: {
    flexDirection: 'row',
    marginLeft: 100,
    alignItems: 'center'
  },
  boardingListDate: {
    fontSize: 22,
    color: '#000',
    width: '100%',
    textAlign: 'right'
  },
  boardingListTon: {
    fontSize: 22,
    color: '#000',
    width: '100%',
    textAlign: 'right',
    marginTop: -33,
    paddingRight: 85,
    marginBottom: 105,
  },
  boardingListInfoContainer: {
    width: '100%',
    marginBottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardingListInfoText: {
    fontSize: 18,
    color: '#000',
    marginBottom: 10,
    width: '100%',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 18,
    color: '#000',
    width: 80,
    textAlign: 'right',
    fontWeight: 'bold',
    lineHeight: 24,
  },
  infoColon: {
    fontSize: 18,
    color: '#000',
    width: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoValue: {
    fontSize: 18,
    color: '#000',
    width: 250,
    textAlign: 'left',
    lineHeight: 24,
  },
  boardingListScroll: {
    flex: 1,
  },
  boardingListTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginLeft: 20,
    height: 40,
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 5,
  },
  boardingListHeaderNumber: {
    width: 40,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    lineHeight: 22,
  },
  boardingListHeaderName: {
    width: 144,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderBirth: {
    width: 125,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderGender: {
    width: 70,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderAddress: {
    width: 234,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderPhone: {
    width: 145,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderEmergency: {
    width: 145,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListHeaderSailor: {
    width: 137,
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginLeft: 20,
    height: 50.5,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  boardingListNumber: {
    width: 40,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
    lineHeight: 24,
  },
  boardingListName: {
    width: 144,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  boardingListBirth: {
    width: 125,
    fontSize: 16,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListGender: {
    width: 70,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  boardingListPhone: {
    width: 145,
    fontSize: 14,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  boardingListEmergency: {
    width: 145,
    fontSize: 14,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  boardingListSailor: {
    width: 137,
    fontSize: 16,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  boardingListAddress: {
    width: 234,
    fontSize: 16,
    color: '#000',
    paddingTop: 3,
    paddingLeft: 10,
    lineHeight: 18
  },
  requiredAsterisk: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold'
  }
});