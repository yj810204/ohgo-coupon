import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, Modal, Alert, RefreshControl, Image, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, getDocs, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { findCaptains } from '../utils/find-captains';

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

export default function RosterListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { date, dateDisplay, tripNumber, showPreview } = params;

  // Extract year, month, and day from dateDisplay
  const dateYear = dateDisplay.toString().split('년')[0];
  const dateMonth = dateDisplay.toString().split('년')[1].split('월')[0].trim();
  const dateDay = dateDisplay.toString().split('월')[1].split('일')[0].trim();

  // Convert tripNumber to number (it comes as string from URL params)
  const tripNum = tripNumber ? parseInt(tripNumber.toString()) : 1;

  const viewShotRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterItems, setRosterItems] = useState<RosterItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoster, setSelectedRoster] = useState<RosterItem | null>(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);

  // Function to check if a trip has already been made
  const checkTripStatus = async () => {
    if (!date || !tripNumber) return;

    try {
      // Check if this trip has already been confirmed
      const tripsDocRef = doc(db, 'trips', String(date));
      const tripsDocSnap = await getDoc(tripsDocRef);

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
      // If showPreview is true, we want to show the image preview for a confirmed trip
      if (showPreview === 'true') {
        await loadRosterData();
        captureAndShowPreview();
      } else {
        const tripAlreadyMade = await checkTripStatus();
        if (!tripAlreadyMade) {
          loadRosterData();
        }
      }
    };

    init();
  }, [date]);

  // Function to capture and show the image preview for confirmed trips
  const captureAndShowPreview = async () => {
    try {
      setSavingImage(true);

      // Check if there's already an image URL for this trip
      if (date && tripNumber) {
        const tripsDocRef = doc(db, 'trips', String(date));
        const tripsDocSnap = await getDoc(tripsDocRef);

        if (tripsDocSnap.exists()) {
          const tripKey = `trip${tripNum}`;
          const tripData = tripsDocSnap.data()[tripKey];

          if (tripData && tripData.rosterImageUrl) {
            // If there's already an image URL, use it
            setCapturedImageUri(tripData.rosterImageUrl);
            setImagePreviewVisible(true);
            setSavingImage(false);
            return;
          }
        }
      }

      // If no existing image, capture a new one
      // Wait a moment for the roster data to be rendered
      setTimeout(async () => {
        // Capture the view as an image
        if (viewShotRef.current) {
          const uri = await viewShotRef.current.capture();
          setCapturedImageUri(uri);
          setImagePreviewVisible(true);

          try {
            // Upload the image to Firebase Storage
            const response = await fetch(uri);
            const blob = await response.blob();

            // Create a reference to the storage location
            const imagePath = `rosters/${date}/trip${tripNum}.jpg`;
            const storageRef = ref(storage, imagePath);

            // Upload the image
            await uploadBytes(storageRef, blob);

            // Get the download URL
            const downloadURL = await getDownloadURL(storageRef);

            // Save the image URL to the trip document
            const tripsDocRef = doc(db, 'trips', String(date));
            const tripsDocSnap = await getDoc(tripsDocRef);

            const tripKey = `trip${tripNum}`;

            if (tripsDocSnap.exists()) {
              const tripData = tripsDocSnap.data()[tripKey] || {};

              // Update the trip data with the image URL
              await updateDoc(tripsDocRef, {
                [tripKey]: {
                  ...tripData,
                  rosterImageUrl: downloadURL,
                  rosterImagePath: imagePath
                }
              });
            } else {
              // Create a new document if it doesn't exist
              await setDoc(tripsDocRef, {
                [tripKey]: {
                  rosterImageUrl: downloadURL,
                  rosterImagePath: imagePath
                }
              });
            }
          } catch (error) {
            console.error('Error saving preview image to Firebase:', error);
          }
        }
        setSavingImage(false);
      }, 1000);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
      setSavingImage(false);
    }
  };

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

  // Function to ensure captains are added to attendance
  const updateAttendanceWithCaptains = async (dateStr: string, captainIds: string[], existingMemberIds: string[] = []) => {
    try {
      const attendanceRef = doc(db, 'attendance', dateStr);
      const attendanceSnap = await getDoc(attendanceRef);

      // Create a set of unique member IDs (combining existing members and captains)
      const uniqueMemberIds = new Set([...existingMemberIds, ...captainIds]);
      const updatedMemberIds = Array.from(uniqueMemberIds);

      if (attendanceSnap.exists()) {
        // Update existing attendance document
        await updateDoc(attendanceRef, {
          members: updatedMemberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      } else {
        // Create new attendance document
        await setDoc(attendanceRef, {
          members: updatedMemberIds,
          tripNumber: parseInt(tripNumber as string) || 1
        });
      }

      return updatedMemberIds;
    } catch (error) {
      console.error('Error updating attendance with captains:', error);
      return existingMemberIds;
    }
  };

  const loadRosterData = async () => {
    if (!date) return;

    setLoading(true);
    try {
      // Get all captains and sailors first
      const crewMembers = await findCaptains();
      const crewIds = crewMembers.map(member => member.uuid);
      const captainIds = crewMembers.filter(member => member.role === 'captain').map(captain => captain.uuid);
      const sailorIds = crewMembers.filter(member => member.role === 'sailor').map(sailor => sailor.uuid);

      // Get the attendance document for the specified date
      const attendanceRef = doc(db, 'attendance', String(date));
      const attendanceSnap = await getDoc(attendanceRef);

      const rosterData: RosterItem[] = [];
      let memberIds: string[] = attendanceSnap.exists() && attendanceSnap.data().members
          ? attendanceSnap.data().members
          : [];

      // Ensure captains are added to attendance even if they're the only ones present
      if (captainIds.length > 0) {
        memberIds = await updateAttendanceWithCaptains(String(date), captainIds, memberIds);
      }

      // Format date from YYYYMMDD to YYYY-MM-DD
      const formatDate = (dateStr: string): string => {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      };

      // First, add all captains and sailors to the roster list (they should always appear)
      for (const crewMember of crewMembers) {
        const userRef = doc(db, 'users', crewMember.uuid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          // Check if crew member has boarding info
          const boardingInfoRef = doc(db, 'users', crewMember.uuid, 'boarding', 'info');
          const boardingInfoSnap = await getDoc(boardingInfoRef);

          const hasRoster = boardingInfoSnap.exists();
          const isCaptain = crewMember.role === 'captain';
          const isSailor = crewMember.role === 'sailor';

          let rosterInfo = {
            id: crewMember.uuid,
            name: userData.name || crewMember.name || '',
            birth: formatDate(userData.dob),
            gender: '',
            phone: '',
            emergency: '',
            address: '',
            hasRoster: hasRoster,
            isCaptain: isCaptain,
            isSailor: isSailor,
            role: crewMember.role
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

      // Then add regular members from the attendance list (excluding captains and sailors that were already added)
      if (memberIds.length > 0) {
        for (const memberId of memberIds) {
          // Skip if this member is a captain or sailor (already added)
          if (crewIds.includes(memberId)) continue;

          // Get user's basic info
          const userRef = doc(db, 'users', memberId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();

            // Check if user has boarding info
            const boardingInfoRef = doc(db, 'users', memberId, 'boarding', 'info');
            const boardingInfoSnap = await getDoc(boardingInfoRef);

            const hasRoster = boardingInfoSnap.exists();

            let rosterInfo = {
              id: memberId,
              name: userData.name || '',
              birth: formatDate(userData.dob),
              gender: '',
              phone: '',
              emergency: '',
              address: '',
              hasRoster: hasRoster,
              isCaptain: false,
              isSailor: false
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

      // Sort by role: captains first, then sailors, then regular members, then by name
      rosterData.sort((a, b) => {
        if (a.isCaptain && !b.isCaptain) return -1;
        if (!a.isCaptain && b.isCaptain) return 1;
        if (a.isSailor && !b.isSailor) return -1;
        if (!a.isSailor && b.isSailor) return 1;
        return a.name.localeCompare(b.name);
      });

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

      // Check if there's already an image URL for this trip
      if (date && tripNumber) {
        const tripsDocRef = doc(db, 'trips', String(date));
        const tripsDocSnap = await getDoc(tripsDocRef);

        if (tripsDocSnap.exists()) {
          const tripKey = `trip${tripNum}`;
          const tripData = tripsDocSnap.data()[tripKey];

          if (tripData && tripData.rosterImageUrl) {
            // If there's already an image URL, use it
            setCapturedImageUri(tripData.rosterImageUrl);
            setImagePreviewVisible(true);
            setSavingImage(false);
            return;
          }
        }
      }

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
      if (!capturedImageUri || !date || !tripNumber) return;

      setSavingImage(true);

      // Save the image to the gallery
      const asset = await MediaLibrary.createAssetAsync(capturedImageUri);
      await MediaLibrary.createAlbumAsync('OhGo', asset, false);

      // Upload the image to Firebase Storage
      const response = await fetch(capturedImageUri);
      const blob = await response.blob();

      // Create a reference to the storage location
      const imagePath = `rosters/${date}/trip${tripNum}.jpg`;
      const storageRef = ref(storage, imagePath);

      // Upload the image
      await uploadBytes(storageRef, blob);

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Save the image URL to the trip document
      const tripsDocRef = doc(db, 'trips', String(date));
      const tripsDocSnap = await getDoc(tripsDocRef);

      const tripKey = `trip${tripNum}`;

      if (tripsDocSnap.exists()) {
        const tripData = tripsDocSnap.data()[tripKey] || {};

        // Update the trip data with the image URL
        await updateDoc(tripsDocRef, {
          [tripKey]: {
            ...tripData,
            rosterImageUrl: downloadURL,
            rosterImagePath: imagePath
          }
        });
      } else {
        // Create a new document if it doesn't exist
        await setDoc(tripsDocRef, {
          [tripKey]: {
            rosterImageUrl: downloadURL,
            rosterImagePath: imagePath
          }
        });
      }

      Alert.alert('성공', '명부 이미지가 갤러리와 서버에 저장되었습니다.');
      setImagePreviewVisible(false);
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('오류', '이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingImage(false);
    }
  };

  const renderRosterItem = ({ item }: { item: RosterItem }) => (
      <TouchableOpacity
          style={[
            styles.rosterItem,
            item.isCaptain ? styles.captainRosterItem : null,
            item.isSailor ? styles.sailorRosterItem : null
          ]}
          onPress={() => handleRosterItemPress(item)}
      >
        <View style={styles.rosterItemContent}>
          <View style={styles.nameContainer}>
            <Text style={styles.rosterName}>{item.name}</Text>
            {item.isCaptain && (
                <Text style={styles.captainTag}>선장</Text>
            )}
            {item.isSailor && (
                <Text style={styles.sailorTag}>선원</Text>
            )}
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
                <View style={styles.boardingListScroll}>
                  {rosterItems.slice(0, 20).map((item, index) => (
                      <View
                          key={item.id}
                          style={[
                            styles.boardingListItem,
                            { top: index * 50.5 },
                            item.isCaptain ? styles.boardingListCaptainItem : null,
                            item.isSailor ? styles.boardingListSailorItem : null
                          ]}
                      >
                        <Text style={styles.boardingListNumber}>{index + 1}</Text>
                        <Text style={[
                          styles.boardingListName,
                          item.isCaptain ? styles.boardingListCaptainText : null,
                          item.isSailor ? styles.boardingListSailorText : null
                        ]}>
                          {item.name}
                          {item.isCaptain ? ' (캡틴)' : ''}
                          {item.isSailor ? ' (세일러)' : ''}
                        </Text>
                        <Text style={styles.boardingListBirth}>{item.birth}</Text>
                        <Text style={styles.boardingListGender}>{item.gender}</Text>
                        <Text style={styles.boardingListAddress}>{item.address}</Text>
                        <Text style={styles.boardingListPhone}>{item.phone}</Text>
                        <Text style={styles.boardingListEmergency}>{item.emergency}</Text>
                      </View>
                  ))}
                </View>
              </View>
            </View>
          </ViewShot>
        </View>

        <View style={styles.dateContainer}>
          <View style={styles.dateTextContainer}>
            <Text style={styles.dateTextYear}>{dateDisplay} {tripNum}항차</Text>
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
                    style={styles.previousButton}
                    onPress={() => router.back()}
                >
                  <Text style={styles.buttonText}>이전</Text>
                </TouchableOpacity>

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
                          dateDay,
                          tripNumber: tripNum
                        }
                      });
                    }}
                >
                  <Text style={styles.buttonText}>신규 추가</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={() => {
                      // Stringify the roster items to pass as a parameter
                      const rosterItemsJson = JSON.stringify(rosterItems);
                      router.push({
                        pathname: '/location-time-selection',
                        params: {
                          date,
                          dateDisplay,
                          dateYear,
                          dateMonth,
                          dateDay,
                          tripNumber: tripNum,
                          rosterItems: rosterItemsJson
                        }
                      });
                    }}
                >
                  <Text style={styles.buttonText}>다음</Text>
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
    alignItems: 'center'
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
  captainRosterItem: {
    backgroundColor: '#e3f2fd', // Light blue background for captains
    borderLeftWidth: 4,
    borderLeftColor: '#1e88e5',
  },
  sailorRosterItem: {
    backgroundColor: '#e8f5e9', // Light green background for sailors
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
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
  captainTag: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#1e88e5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    fontFamily: "GiantRegular"
  },
  sailorTag: {
    fontSize: 12,
    color: 'white',
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    fontFamily: "GiantRegular"
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
  buttonContainerNoBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    paddingTop: 0, // Remove padding at the top to reduce spacing
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#1e88e5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  previousButton: {
    flex: 1,
    backgroundColor: '#f44336',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
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
    // height: 500,
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
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center'
  },
  boardingListDateYear: {
    position: 'absolute',
    left: 197,
    top: 15,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListDateMonth: {
    position: 'absolute',
    left: 237,
    top: 15,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListDateDay: {
    position: 'absolute',
    left: 277,
    top: 15,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListScroll: {
    position: 'absolute',
    top: 109,
    left: 0,
    right: 0,
    bottom: 0,
  },
  boardingListItem: {
    position: 'absolute',
    left: 0,
    height: 50.5,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#ccc'
  },
  boardingListCaptainItem: {
    backgroundColor: '#e3f2fd', // Light blue background for captains
  },
  boardingListSailorItem: {
    backgroundColor: '#e8f5e9', // Light green background for sailors
  },
  boardingListNumber: {
    position: 'absolute',
    left: 20,
    top: 10,
    width: 50,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListName: {
    position: 'absolute',
    left: 70,
    top: 10,
    width: 137,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListCaptainText: {
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  boardingListSailorText: {
    fontWeight: 'bold',
    color: '#4caf50',
  },
  boardingListBirth: {
    position: 'absolute',
    left: 207,
    top: 10,
    width: 145,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListGender: {
    position: 'absolute',
    left: 352,
    top: 10,
    width: 55,
    fontSize: 18,
    color: '#000',
    lineHeight: 24,
  },
  boardingListPhone: {
    position: 'absolute',
    left: 637,
    top: 10,
    width: 140,
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  boardingListEmergency: {
    position: 'absolute',
    left: 777,
    top: 10,
    width: 140,
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  boardingListAddress: {
    position: 'absolute',
    left: 407,
    top: 10,
    width: 230,
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
});