import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

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
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
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

  useEffect(() => {
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

  const captureAndSaveImage = async () => {
    try {
      // Request permissions first
      const hasPermission = await requestMediaLibraryPermissions();
      if (!hasPermission) return;

      setSavingImage(true);

      // Capture the view as an image
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        setCapturedImageUri(uri);
        setImagePreviewVisible(true);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };

  const saveToGallery = async () => {
    try {
      if (!capturedImageUri) return;

      setSavingImage(true);

      // Save the image to the gallery
      const asset = await MediaLibrary.createAssetAsync(capturedImageUri);
      await MediaLibrary.createAlbumAsync('OhGo', asset, false);

      Alert.alert('성공', '명부 이미지가 갤러리에 저장되었습니다.');
      setImagePreviewVisible(false);
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('오류', '갤러리에 저장하는 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Image Preview Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={imagePreviewVisible}
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.imagePreviewContent}>
            <Text style={styles.modalTitle}>명부 이미지 미리보기</Text>

            {capturedImageUri && (
              <Image
                source={{ uri: capturedImageUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}

            <View style={styles.previewButtonsContainer}>
              <TouchableOpacity
                style={[styles.previewButton, styles.cancelButton]}
                onPress={() => setImagePreviewVisible(false)}
                disabled={savingImage}
              >
                <Text style={styles.buttonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewButton, styles.saveButton]}
                onPress={saveToGallery}
                disabled={savingImage}
              >
                {savingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>갤러리에 저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden ViewShot component for capturing */}
      <View style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
          <View style={styles.boardingListContainer}>
            <Image
              source={require('../assets/images/boarding_list.png')}
              style={styles.boardingListImage}
            />
            <View style={styles.a4Outline} />
            <View style={styles.boardingListContent}>
              <View style={styles.boardingListTitleContainer}>
                <Text style={styles.boardingListTitle}>승 선 자 명 부</Text>
                <Text style={styles.boardingListShipName}>{shipName ? `(${shipName})` : ''}</Text>
              </View>
              <Text style={styles.boardingListDesc01}>{desc01}</Text>
              <View style={styles.boardingListDateContainer}>
                <Text style={styles.boardingListDateYear}>{dateYear}</Text>
                <Text style={styles.boardingListDateMonth}>{dateMonth}</Text>
                <Text style={styles.boardingListDateDay}>{dateDay}</Text>
              </View>
              <Text style={styles.boardingListTon}>{shipTon}</Text>
              <ScrollView style={styles.boardingListScroll}>
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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "GiantRegular"
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imagePreviewContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#333',
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 500,
    marginVertical: 16,
    borderRadius: 8,
  },
  previewButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#4caf50',
    marginLeft: 8,
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
  a4Outline: {
    width: 1239,
    height: 1752,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'solid',
    zIndex: 1,
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
  },
  boardingListShipName: {
    fontSize: 32,
    color: '#000',
    marginLeft: 20,
    fontWeight: 'bold',
  },
  boardingListDesc01: {
    fontSize: 14,
    color: '#000',
    width: '100%',
    textAlign: 'center',
  },
  boardingListDesc02: {
    fontSize: 14,
    color: '#000',
    width: '100%',
    textAlign: 'center',
    marginTop: 10
  },
  boardingListOnBoard: {
    fontSize: 32,
    color: '#000',
    width: '100%',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 30
  },
  boardingListDateContainer: {
    flexDirection: 'row',
    marginLeft: 197,
    alignItems: 'center'
  },
  boardingListDateYear: {
    fontSize: 18,
    color: '#000',
  },
  boardingListDateMonth: {
    fontSize: 18,
    color: '#000',
    marginLeft: 40
  },
  boardingListDateDay: {
    fontSize: 18,
    color: '#000',
    marginLeft: 40
  },
  boardingListTon: {
    fontSize: 18,
    color: '#000',
    width: '100%',
    textAlign: 'right',
    marginTop: -28,
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
  },
  infoColon: {
    fontSize: 18,
    color: '#000',
    width: 20,
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 18,
    color: '#000',
    width: 250,
    textAlign: 'left',
  },
  boardingListScroll: {
    flex: 1,
  },
  boardingListItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginLeft: 20,
    height: 50.5
  },
  boardingListNumber: {
    width: 40,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
  },
  boardingListName: {
    width: 144,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center',
  },
  boardingListBirth: {
    width: 125,
    fontSize: 16,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center',
  },
  boardingListGender: {
    width: 70,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
    textAlign: 'center'
  },
  boardingListPhone: {
    width: 145,
    fontSize: 14,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center',
  },
  boardingListEmergency: {
    width: 145,
    fontSize: 14,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center',
  },
  boardingListSailor: {
    width: 137,
    fontSize: 16,
    color: '#000',
    paddingTop: 12,
    textAlign: 'center'
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