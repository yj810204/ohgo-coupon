import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Modal, Alert, RefreshControl, Image, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
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
};

export default function RosterListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { date, dateDisplay } = params;

  // Extract year, month, and day from dateDisplay
  const dateYear = dateDisplay.toString().split('년')[0];
  const dateMonth = dateDisplay.toString().split('년')[1].split('월')[0].trim();
  const dateDay = dateDisplay.toString().split('월')[1].split('일')[0].trim();

  const viewShotRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterItems, setRosterItems] = useState<RosterItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoster, setSelectedRoster] = useState<RosterItem | null>(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    loadRosterData();
  }, [date]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRosterData();
    } catch (error) {
      console.error('Error refreshing roster data:', error);
      Alert.alert('오류', '명부 정보를 새로고침하는 중 오류가 발생했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRosterData = async () => {
    if (!date) return;

    setLoading(true);
    try {
      // Get the attendance document for the specified date
      const attendanceRef = doc(db, 'attendance', String(date));
      const attendanceSnap = await getDoc(attendanceRef);

      const rosterData: RosterItem[] = [];

      // Check if the attendance document exists and has members
      if (attendanceSnap.exists() && attendanceSnap.data().members) {
        const memberIds = attendanceSnap.data().members;

        // For each member ID in the attendance list
        for (const memberId of memberIds) {
          // First get user's basic info
          const userRef = doc(db, 'users', memberId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();

            // Then check if user has boarding info
            const boardingInfoRef = doc(db, 'users', memberId, 'boarding', 'info');
            const boardingInfoSnap = await getDoc(boardingInfoRef);

            const hasRoster = boardingInfoSnap.exists();
            // Format date from YYYYMMDD to YYYY-MM-DD
            const formatDate = (dateStr: string): string => {
              if (!dateStr || dateStr.length !== 8) return dateStr;
              return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            };

            let rosterInfo = {
              id: memberId,
              name: userData.name || '',
              birth: formatDate(userData.dob),
              gender: '',
              phone: '',
              emergency: '',
              address: '',
              hasRoster: hasRoster
            };

            if (hasRoster) {
              const data = boardingInfoSnap.data();
              rosterInfo = {
                ...rosterInfo,
                name: data.name || userData.displayName || '',
                birth: formatDate(data.birth) || '',
                gender: data.gender || '',
                phone: data.phone || '',
                emergency: data.emergency || '',
                address: data.address || '',
              };
            }

            rosterData.push(rosterInfo);
          }
        }
      }

      // Sort by name
      rosterData.sort((a, b) => a.name.localeCompare(b.name));

      setRosterItems(rosterData);
    } catch (error) {
      console.error('Error loading roster data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRosterItemPress = (item: RosterItem) => {
    if (item.hasRoster) {
      // If the member has a roster, show it in the modal
      setSelectedRoster(item);
      setModalVisible(true);
    } else {
      // If the member doesn't have a roster, show an alert or navigate to member details
      Alert.alert('알림', `${item.name}님의 명부 정보가 없습니다.`);

      // Optionally, still navigate to member details
      // router.push({
      //   pathname: '/member-detail',
      //   params: {
      //     uuid: item.id,
      //     name: item.name,
      //     dob: item.birth
      //   }
      // });
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

  const renderRosterItem = ({ item }: { item: RosterItem }) => (
      <TouchableOpacity
          style={styles.rosterItem}
          onPress={() => handleRosterItemPress(item)}
      >
        <View style={styles.rosterItemContent}>
          <View style={styles.nameContainer}>
            <Text style={styles.rosterName}>{item.name}</Text>
            {!item.hasRoster && (
                <Text style={styles.noRosterTag}>명부 없음</Text>
            )}
          </View>
          <View style={styles.rosterDetails}>
            <View style={styles.rosterDetailRow}>
              <Text style={styles.rosterDetail}>{item.birth} (</Text>
              {item.gender ? (
                  <Text style={styles.rosterDetail}>{item.gender}</Text>
              ) : (
                  <Text style={styles.missingValueBadge}>미입력</Text>
              )}
              <Text style={styles.rosterDetail}>)</Text>
            </View>
            <View style={styles.rosterDetailRow}>
              {item.phone ? (
                  <Text style={styles.rosterDetail}>{item.phone}</Text>
              ) : (
                  <Text style={styles.missingValueBadge}>미입력</Text>
              )}
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
  );

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        {/* Roster Detail Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedRoster?.name}님의 명부 정보</Text>

              {selectedRoster && (
                  <View style={styles.rosterInfo}>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>이름:</Text>
                      <Text style={styles.rosterValue}>{selectedRoster.name}</Text>
                    </View>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>생년월일:</Text>
                      <Text style={styles.rosterValue}>{selectedRoster.birth}</Text>
                    </View>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>성별:</Text>
                      {selectedRoster.gender ? (
                          <Text style={styles.rosterValue}>{selectedRoster.gender}</Text>
                      ) : (
                          <Text style={styles.missingValueBadge}>미입력</Text>
                      )}
                    </View>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>연락처:</Text>
                      {selectedRoster.phone ? (
                          <Text style={styles.rosterValue}>{selectedRoster.phone}</Text>
                      ) : (
                          <Text style={styles.missingValueBadge}>미입력</Text>
                      )}
                    </View>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>비상 연락처:</Text>
                      <Text style={styles.rosterValue}>{selectedRoster.emergency}</Text>
                    </View>
                    <View style={styles.rosterRow}>
                      <Text style={styles.rosterLabel}>주소:</Text>
                      <Text style={styles.rosterValue}>{selectedRoster.address}</Text>
                    </View>
                  </View>
              )}

              <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
              <View style={styles.boardingListContent}>
                <View style={styles.boardingListDateContainer}>
                  <Text style={styles.boardingListDateYear}>{dateYear}</Text>
                  <Text style={styles.boardingListDateMonth}>{dateMonth}</Text>
                  <Text style={styles.boardingListDateDay}>{dateDay}</Text>
                </View>
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
                      </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ViewShot>
        </View>

        <View style={styles.dateContainer}>
          <View style={styles.dateTextContainer}>
            <Text style={styles.dateTextYear}>{dateDisplay}</Text>
          </View>
        </View>

        {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1e88e5" />
              <Text style={styles.loadingText}>명부 정보를 불러오는 중...</Text>
            </View>
        ) : rosterItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="information-circle-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>해당 날짜의 명부 정보가 없습니다.</Text>
            </View>
        ) : (
            <>
              <FlatList
                  data={rosterItems}
                  renderItem={renderRosterItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#1e88e5']}
                        tintColor={'#1e88e5'}
                    />
                  }
              />
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                      // Navigate to a form or modal to add a member manually
                      router.push({
                        pathname: '/(app)/add-member' as any,
                        params: {
                          date,
                          dateDisplay,
                          dateYear,
                          dateMonth,
                          dateDay
                        }
                      });
                    }}
                >
                  <Text style={styles.buttonText}>신규 추가</Text>
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
            </>
        )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  dateContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  dateTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTextYear: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#1e88e5',
  },
  dateTextMonth: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#4caf50',
    marginLeft: 5,
  },
  dateTextDay: {
    fontSize: 18,
    fontFamily: "GiantRegular",
    color: '#f44336',
    marginLeft: 5,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: "GiantRegular"
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Add extra padding at the bottom for the buttons
  },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rosterItemContent: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rosterName: {
    fontSize: 16,
    fontFamily: "GiantRegular",
    color: '#333',
    marginRight: 8,
  },
  noRosterTag: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "GiantRegular"
  },
  rosterDetails: {
    flexDirection: 'column',
  },
  rosterDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  rosterDetail: {
    fontSize: 14,
    color: '#666',
    fontFamily: "GiantRegular"
  },
  missingValueBadge: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#cccccc',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontFamily: "GiantRegular"
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  addButton: {
    backgroundColor: '#1e88e5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  nextButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
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
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
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
    marginBottom: 16,
    textAlign: 'center',
  },
  rosterInfo: {
    marginBottom: 20,
  },
  rosterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  rosterLabel: {
    width: 100,
    fontSize: 14,
    color: '#333',
    fontFamily: "GiantRegular"
  },
  rosterValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    fontFamily: "GiantRegular"
  },
  closeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: "GiantRegular"
  },
  // Image Preview Modal styles
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
  boardingListContent: {
    position: 'absolute',
    top: 227,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 40,
  },
  boardingListDateContainer: {
    flexDirection: 'row',
    marginLeft: 197,
    marginBottom: 109,
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
  boardingListScroll: {
    flex: 1,
  },
  boardingListItem: {
    flexDirection: 'row',
    // marginBottom: 0,
    paddingHorizontal: 20,
    marginLeft: 20,
    height: 50.5
  },
  boardingListNumber: {
    width: 50,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
  },
  boardingListName: {
    width: 137,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
  },
  boardingListBirth: {
    width: 145,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
  },
  boardingListGender: {
    width: 55,
    fontSize: 18,
    color: '#000',
    paddingTop: 10,
  },
  boardingListPhone: {
    width: 140,
    fontSize: 16,
    color: '#000',
    paddingTop: 10
  },
  boardingListEmergency: {
    width: 140,
    fontSize: 16,
    color: '#000',
    paddingTop: 10
  },
  boardingListAddress: {
    width: 230,
    fontSize: 16,
    color: '#000'
  },
});