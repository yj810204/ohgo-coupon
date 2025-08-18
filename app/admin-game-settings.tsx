import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';

export default function AdminGameSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingBaitLimit, setSavingBaitLimit] = useState(false);
  const [dailyBaitLimit, setDailyBaitLimit] = useState('');
  const [baitPerCoupon, setBaitPerCoupon] = useState('5'); // 기본값 5
  const [savingBaitPerCoupon, setSavingBaitPerCoupon] = useState(false);
  const [commonDistance, setCommonDistance] = useState('50'); // 기본값 50
  const [commonPoint, setCommonPoint] = useState('1000'); // 기본값 1000
  const [savingGameSettings, setSavingGameSettings] = useState(false);

  // 특별 버튼 표시 설정
  const [showBaitButton, setShowBaitButton] = useState(false);
  const [showCatchButton, setShowCatchButton] = useState(false);
  const [showDistanceButton, setShowDistanceButton] = useState(false);
  const [showBombButton, setShowBombButton] = useState(false);
  const [showPointButton, setShowPointButton] = useState(false);

  // Tournament data
  const [tournamentTitle, setTournamentTitle] = useState('');
  const [tournamentDescription, setTournamentDescription] = useState('');
  const [startDateString, setStartDateString] = useState('');
  const [endDateString, setEndDateString] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    fetchTournamentData();
    fetchDailyBaitLimit();
    fetchGameSettings();
  }, []);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      const tournamentDoc = await getDoc(doc(db, 'gameSettings', 'tournament'));
      
      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        setTournamentTitle(data.title || '');
        setTournamentDescription(data.description || '');
        
        if (data.startDate) {
          const startDateValue = data.startDate.toDate();
          setStartDate(startDateValue);
          setStartDateString(formatDateForInput(startDateValue));
        }
        
        if (data.endDate) {
          const endDateValue = data.endDate.toDate();
          setEndDate(endDateValue);
          setEndDateString(formatDateForInput(endDateValue));
        }
      }
    } catch (error) {
      console.error('Error fetching tournament data:', error);
      Alert.alert('오류', '대회 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDailyBaitLimit = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'config', 'bait'));
      
      if (configDoc.exists()) {
        const data = configDoc.data();
        setDailyBaitLimit(data.dailyLimit?.toString() || '');
        setBaitPerCoupon(data.baitPerCoupon?.toString() || '5');
      }
    } catch (error) {
      console.error('Error fetching daily bait limit:', error);
      Alert.alert('오류', '일일 미끼 수량 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };
  
  const fetchGameSettings = async () => {
    try {
      const gameSettingsDoc = await getDoc(doc(db, 'gameSettings', 'fishing'));
      
      if (gameSettingsDoc.exists()) {
        const data = gameSettingsDoc.data();
        setCommonDistance(data.distance?.toString() || '50');
        setCommonPoint(data.point?.toString() || '1000');
        
        // 특별 버튼 표시 설정 불러오기
        setShowBaitButton(data.showBaitButton === true);
        setShowCatchButton(data.showCatchButton === true);
        setShowDistanceButton(data.showDistanceButton === true);
        setShowBombButton(data.showBombButton === true);
        setShowPointButton(data.showPointButton === true);
      } else {
        // 문서가 없으면 기본값 설정
        setCommonDistance('50');
        setCommonPoint('1000');
        setShowBaitButton(false);
        setShowCatchButton(false);
        setShowDistanceButton(false);
        setShowBombButton(false);
        setShowPointButton(false);
      }
    } catch (error) {
      console.error('Error fetching game settings:', error);
      Alert.alert('오류', '게임 설정 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateString: string) => {
    if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return null;
    }
    
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const saveTournamentData = async () => {
    if (!tournamentTitle.trim()) {
      Alert.alert('입력 오류', '대회 타이틀을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      
      await setDoc(doc(db, 'gameSettings', 'tournament'), {
        title: tournamentTitle,
        description: tournamentDescription,
        startDate: startDate,
        endDate: endDate,
        updatedAt: new Date()
      });
      
      Alert.alert('성공', '대회 정보가 저장되었습니다.');
    } catch (error) {
      console.error('Error saving tournament data:', error);
      Alert.alert('오류', '대회 정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveDailyBaitLimit = async () => {
    if (!dailyBaitLimit.trim()) {
      Alert.alert('입력 오류', '일일 미끼 수량을 입력해주세요.');
      return;
    }

    const baitLimitNumber = parseInt(dailyBaitLimit);
    if (isNaN(baitLimitNumber) || baitLimitNumber < 0) {
      Alert.alert('입력 오류', '유효한 숫자를 입력해주세요.');
      return;
    }

    try {
      setSavingBaitLimit(true);
      
      await updateDoc(doc(db, 'config', 'bait'), {
        dailyLimit: baitLimitNumber,
        updatedAt: new Date()
      });
      
      Alert.alert('성공', '일일 미끼 수량이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving daily bait limit:', error);
      Alert.alert('오류', '일일 미끼 수량 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBaitLimit(false);
    }
  };
  
  const saveBaitPerCoupon = async () => {
    if (!baitPerCoupon.trim()) {
      Alert.alert('입력 오류', '교환권 당 미끼 수량을 입력해주세요.');
      return;
    }

    const baitPerCouponNumber = parseInt(baitPerCoupon);
    if (isNaN(baitPerCouponNumber) || baitPerCouponNumber <= 0) {
      Alert.alert('입력 오류', '교환권 당 미끼 수량은 1 이상의 숫자여야 합니다.');
      return;
    }

    try {
      setSavingBaitPerCoupon(true);
      
      await updateDoc(doc(db, 'config', 'bait'), {
        baitPerCoupon: baitPerCouponNumber,
        updatedAt: new Date()
      });
      
      Alert.alert('성공', '교환권 당 미끼 수량이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving bait per coupon:', error);
      Alert.alert('오류', '교환권 당 미끼 수량 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBaitPerCoupon(false);
    }
  };
  
  const saveGameSettings = async () => {
    if (!commonDistance.trim() || !commonPoint.trim()) {
      Alert.alert('입력 오류', '거리와 포인트 값을 모두 입력해주세요.');
      return;
    }

    const distanceNumber = parseInt(commonDistance);
    const pointNumber = parseInt(commonPoint);
    
    if (isNaN(distanceNumber) || distanceNumber <= 0) {
      Alert.alert('입력 오류', '거리는 양수여야 합니다.');
      return;
    }
    
    if (isNaN(pointNumber) || pointNumber <= 0) {
      Alert.alert('입력 오류', '포인트는 양수여야 합니다.');
      return;
    }

    try {
      setSavingGameSettings(true);
      
      await setDoc(doc(db, 'gameSettings', 'fishing'), {
        distance: distanceNumber,
        point: pointNumber,
        // 특별 버튼 표시 설정 저장
        showBaitButton: showBaitButton,
        showCatchButton: showCatchButton,
        showDistanceButton: showDistanceButton,
        showBombButton: showBombButton,
        showPointButton: showPointButton,
        updatedAt: new Date()
      }, { merge: true });
      
      Alert.alert('성공', '게임 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving game settings:', error);
      Alert.alert('오류', '게임 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingGameSettings(false);
    }
  };

  const resetAllPoints = async () => {
    Alert.alert(
      '포인트 초기화',
      '모든 사용자의 포인트를 0으로 초기화하고 잡은 물고기 내역도 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '초기화', 
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              
              // Get all users
              const usersSnapshot = await getDocs(collection(db, 'users'));
              
              // Reset points and clear fish history for each user
              const batch: Promise<void>[] = [];
              
              for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                
                // Reset total points
                batch.push(
                  updateDoc(doc(db, 'users', userId), {
                    totalPoint: 0
                  })
                );
                
                // Delete all fish catch history (points subcollection)
                try {
                  const pointsSnapshot = await getDocs(collection(db, `users/${userId}/points`));
                  pointsSnapshot.forEach((pointDoc) => {
                    batch.push(deleteDoc(pointDoc.ref));
                  });
                } catch (err) {
                  console.error(`Error getting points for user ${userId}:`, err);
                  // Continue with other users even if one fails
                }
              }
              
              await Promise.all(batch);
              
              Alert.alert('성공', '모든 사용자의 포인트와 잡은 물고기 내역이 초기화되었습니다.');
            } catch (error) {
              console.error('Error resetting points and fish history:', error);
              Alert.alert('오류', '포인트 및 물고기 내역 초기화 중 오류가 발생했습니다.');
            } finally {
              setResetting(false);
            }
          }
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = parseDate(dateString);
    if (!date) return dateString;
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };
  
  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setStartDate(selectedDate);
        setStartDateString(formatDateForInput(selectedDate));
      }
      setShowStartDatePicker(false);
    } else {
      if (selectedDate) setStartDate(selectedDate);
    }
  };
  
  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setEndDate(selectedDate);
        setEndDateString(formatDateForInput(selectedDate));
      }
      setShowEndDatePicker(false);
    } else {
      if (selectedDate) setEndDate(selectedDate);
    }
  };
  
  const confirmStartDate = () => {
    setStartDateString(formatDateForInput(startDate));
    setShowStartDatePicker(false);
  };
  
  const confirmEndDate = () => {
    setEndDateString(formatDateForInput(endDate));
    setShowEndDatePicker(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>대회 설정</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>대회 타이틀</Text>
            <TextInput
              style={styles.input}
              value={tournamentTitle}
              onChangeText={setTournamentTitle}
              placeholder="대회 타이틀을 입력하세요"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>대회 간단설명</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={tournamentDescription}
              onChangeText={(text) => {
                setTournamentDescription(text);
              }}
              placeholder="대회에 대한 간단한 설명을 입력하세요"
              multiline={true}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>시작일</Text>
            <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.input}>
              <Text style={styles.dateText}>{startDateString || "날짜를 선택하세요"}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>종료일</Text>
            <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={styles.input}>
              <Text style={styles.dateText}>{endDateString || "날짜를 선택하세요"}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.disabledButton]} 
            onPress={saveTournamentData}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>일일 미끼 수량 관리</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>일일 미끼 수량 제한</Text>
            <TextInput
              style={styles.input}
              value={dailyBaitLimit}
              onChangeText={setDailyBaitLimit}
              placeholder="일일 미끼 수량을 입력하세요"
              keyboardType="numeric"
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.saveButton, savingBaitLimit && styles.disabledButton]} 
            onPress={saveDailyBaitLimit}
            disabled={savingBaitLimit}
          >
            {savingBaitLimit ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
          
          <View style={[styles.inputGroup, { marginTop: 20 }]}>
            <Text style={styles.label}>교환권 당 미끼 수량</Text>
            <TextInput
              style={styles.input}
              value={baitPerCoupon}
              onChangeText={setBaitPerCoupon}
              placeholder="교환권 당 미끼 수량을 입력하세요"
              keyboardType="numeric"
            />
            <Text style={styles.helpText}>
              미끼 교환권 1개 사용 시 지급되는 미끼 수량입니다.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.saveButton, savingBaitPerCoupon && styles.disabledButton]} 
            onPress={saveBaitPerCoupon}
            disabled={savingBaitPerCoupon}
          >
            {savingBaitPerCoupon ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>낚시 게임 설정</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>공통 거리 (기본값: 50)</Text>
            <TextInput
              style={styles.input}
              value={commonDistance}
              onChangeText={setCommonDistance}
              placeholder="공통 거리 값을 입력하세요"
              keyboardType="numeric"
            />
            <Text style={styles.helpText}>
              모든 물고기에 적용되는 기본 거리 값입니다. 난이도에 따라 자동으로 조정됩니다.
            </Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>공통 포인트 (기본값: 1000)</Text>
            <TextInput
              style={styles.input}
              value={commonPoint}
              onChangeText={setCommonPoint}
              placeholder="공통 포인트 값을 입력하세요"
              keyboardType="numeric"
            />
            <Text style={styles.helpText}>
              모든 물고기에 적용되는 기본 포인트 값입니다. 난이도에 따라 자동으로 조정됩니다.
            </Text>
          </View>
          
          <Text style={[styles.label, { marginTop: 20, marginBottom: 10 }]}>특별 버튼 표시 설정</Text>
          <Text style={styles.helpText}>
            각 특별 버튼의 표시 여부를 설정합니다. 활성화된 버튼만 게임에서 나타납니다.
          </Text>
          
          <View style={styles.toggleContainer}>
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>미끼 버튼</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, showBaitButton ? styles.toggleActive : styles.toggleInactive]} 
                onPress={() => setShowBaitButton(!showBaitButton)}
              >
                <Text style={styles.toggleText}>{showBaitButton ? '켜짐' : '꺼짐'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>필살기 버튼</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, showCatchButton ? styles.toggleActive : styles.toggleInactive]} 
                onPress={() => setShowCatchButton(!showCatchButton)}
              >
                <Text style={styles.toggleText}>{showCatchButton ? '켜짐' : '꺼짐'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>거리 감소 버튼</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, showDistanceButton ? styles.toggleActive : styles.toggleInactive]} 
                onPress={() => setShowDistanceButton(!showDistanceButton)}
              >
                <Text style={styles.toggleText}>{showDistanceButton ? '켜짐' : '꺼짐'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>꽝 버튼</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, showBombButton ? styles.toggleActive : styles.toggleInactive]} 
                onPress={() => setShowBombButton(!showBombButton)}
              >
                <Text style={styles.toggleText}>{showBombButton ? '켜짐' : '꺼짐'}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>포인트 추가 버튼</Text>
              <TouchableOpacity 
                style={[styles.toggleButton, showPointButton ? styles.toggleActive : styles.toggleInactive]} 
                onPress={() => setShowPointButton(!showPointButton)}
              >
                <Text style={styles.toggleText}>{showPointButton ? '켜짐' : '꺼짐'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.saveButton, savingGameSettings && styles.disabledButton]} 
            onPress={saveGameSettings}
            disabled={savingGameSettings}
          >
            {savingGameSettings ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>게임 관리</Text>
          <Text style={styles.warningText}>
            주의: 게임 초기화는 모든 사용자의 포인트를 0으로 초기화하고 잡은 물고기 내역도 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </Text>
          
          <TouchableOpacity 
            style={[styles.resetButton, resetting && styles.disabledButton]} 
            onPress={resetAllPoints}
            disabled={resetting}
          >
            {resetting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.resetButtonText}>게임 초기화</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Start Date Picker Modal */}
      <Modal isVisible={showStartDatePicker} onBackdropPress={() => setShowStartDatePicker(false)} style={styles.modalWrap}>
        <View style={styles.modalBox}>
          <DateTimePicker
            value={startDate}
            mode="date"
            display="spinner"
            onChange={handleStartDateChange}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.saveButton} onPress={confirmStartDate}>
              <Text style={styles.saveButtonText}>확인</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
      
      {/* End Date Picker Modal */}
      <Modal isVisible={showEndDatePicker} onBackdropPress={() => setShowEndDatePicker(false)} style={styles.modalWrap}>
        <View style={styles.modalBox}>
          <DateTimePicker
            value={endDate}
            mode="date"
            display="spinner"
            onChange={handleEndDateChange}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.saveButton} onPress={confirmEndDate}>
              <Text style={styles.saveButtonText}>확인</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'GiantRegular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'GiantBold',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'GiantBold',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 8,
    height: 80,
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantBold',
  },
  warningText: {
    color: '#FF3B30',
    fontSize: 14,
    fontFamily: 'GiantRegular',
    marginBottom: 15,
  },
  helpText: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
    fontFamily: 'GiantRegular',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'GiantBold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  modalWrap: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 10,
  },
  // 토글 버튼 스타일
  toggleContainer: {
    marginBottom: 15,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  toggleButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleInactive: {
    backgroundColor: '#9E9E9E',
  },
  toggleText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'GiantBold',
  },
});