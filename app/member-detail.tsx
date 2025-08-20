import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { getTodayCouponsStatus } from '../utils/coupon-utils';
import { sendPushToUser } from '../utils/send-push';
import {
  addStamp,
  addStampBatch,
  deleteUser,
  getCouponCount,
  getStamps,
  useOneCoupon
} from '../utils/stamp-service';
import * as SecureStore from 'expo-secure-store';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export default function MemberDetail() {
  const { name, uuid, dob } = useLocalSearchParams<{ name: string; uuid: string; dob: string }>();
  const [targetUserIsAdmin, setTargetUserIsAdmin] = useState<boolean>(false);

  const [stampCount, setStampCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOne, setIsLoadingOne] = useState(false);
  const [isLoadingFive, setIsLoadingFive] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPoints, setIsResettingPoints] = useState(false);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [createdAt, setCreatedAt] = useState('');
  const [lastStampDate, setLastStampDate] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [rosterData, setRosterData] = useState<{
    name: string;
    birth: string;
    gender: string;
    phone: string;
    emergency: string;
    address: string;
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const onRefresh = async () => {
  setRefreshing(true);
  await loadCounts();
  await loadTargetUserInfo();
  setRefreshing(false);
};

  const loadCounts = async () => {
    const stamps = await getStamps(uuid);
    const coupons = await getCouponCount(uuid);
    setStampCount(stamps.length);
    setCouponCount(coupons);
  };

  const loadTargetUserInfo = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uuid));
      if (snap.exists()) {
        const data = snap.data();
        setTargetUserIsAdmin(!!data.isAdmin);
        if (data.createdAt) {
          const ts = typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt.toDate();
          setCreatedAt(format(ts, 'yy-MM-dd'));
        }
        // Get user points, default to 0 if not set
        setPoints(data.totalPoint || 0);
      }
  
      // 마지막 스탬프 날짜 계산
      const stamps = await getStamps(uuid);
      if (stamps.length > 0) {
        const last = stamps[stamps.length - 1];
        const [date, , time] = last.split('|');
        setLastStampDate(`${date} ${time || ''}`);
      }
    } catch (err) {
      console.warn('회원 정보 로딩 실패:', err);
    }
  };
  
  const loadRosterData = async () => {
    try {
      const rosterSnap = await getDoc(doc(db, 'users', uuid, 'boarding', 'info'));
      if (rosterSnap.exists()) {
        const data = rosterSnap.data();
        setRosterData(data as typeof rosterData);
        return true;
      } else {
        setRosterData(null);
        return false;
      }
    } catch (err) {
      console.warn('명부 정보 로딩 실패:', err);
      setRosterData(null);
      return false;
    }
  };

  useEffect(() => {
    loadCounts();
    loadTargetUserInfo();
    // Pre-load roster data
    loadRosterData();
  }, [uuid]);

  const handleAddStamp = async () => {
    Alert.alert(
      '스탬프 1회 적립',
      `${name}님에게 스탬프 1개를\n적립하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            setIsLoadingOne(true);
            try {
              await addStamp(uuid, 'ADMIN');
              await loadCounts();
  
              if (stampCount + 1 >= 10) {
                Alert.alert('쿠폰 발급', `${name}님에게 쿠폰이 1개 발급되었습니다.`);
              }
  
              await sendPushToUser({
                uuid,
                title: '스탬프가 적립되었어요~!',
                body: `${name}님, 스탬프가 1개 적립되었습니다~! ✨`,
                data: { screen: 'stamp', uuid, name, dob },
              });
            } catch (err: any) {
              Alert.alert('스탬프 적립 실패', err.message);
            } finally {
              setIsLoadingOne(false);
            }
          },
        },
      ]
    );
  };
  
  const handleAddStampFive = async () => {
    Alert.alert(
      '스탬프 5회 적립',
      `${name}님에게 스탬프 5개를\n적립하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            setIsLoadingFive(true);
            try {
              await addStampBatch(uuid, 5);
              await loadCounts();
  
              await sendPushToUser({
                uuid,
                title: '스탬프 5개가 적립되었어요~!',
                body: `${name}님, 스탬프가 5개 적립되었습니다~! 🎉`,
                data: { screen: 'stamp', uuid, name, dob },
              });
  
              Alert.alert('완료', '스탬프 5개가 적립되었습니다.');
            } catch (err: any) {
              Alert.alert('실패', err.message);
            } finally {
              setIsLoadingFive(false);
            }
          },
        },
      ]
    );
  };

  const proceedUseCoupon = async () => {
    try {
      await useOneCoupon(uuid);
      await loadCounts();
  
      await sendPushToUser({
        uuid,
        title: '쿠폰 사용 알림',
        body: `${name}님, 쿠폰 1개가 사용 처리되었습니다.`,
        data: {
          screen: 'coupons',
          uuid,
          name,
          dob,
        },
      });
  
      Alert.alert('쿠폰 사용 완료', `${name}님의 쿠폰 1개를 사용 처리했습니다.`);
    } catch (err: any) {
      Alert.alert('쿠폰 사용 실패', err.message);
    }
  };

  const resetPoints = async () => {
    setIsResettingPoints(true);
    try {
      const userRef = doc(db, 'users', uuid);
      await updateDoc(userRef, { totalPoint: 0 });
      setPoints(0);
      Alert.alert('포인트 초기화 완료', `${name}님의 포인트가 0으로 초기화되었습니다.`);
    } catch (err: any) {
      console.error('포인트 초기화 실패:', err);
      Alert.alert('포인트 초기화 실패', err.message);
    } finally {
      setIsResettingPoints(false);
    }
  };

  const handleDeleteUser = async () => {
    if (targetUserIsAdmin) {
      Alert.alert('삭제 불가', '관리자는 삭제할 수 없습니다.');
      return;
    }
  
    Alert.alert(
      '회원 삭제',
      `${name}님의 모든 데이터가 삭제됩니다.\n진행할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteUser(uuid);
              Alert.alert('삭제 완료', `${name}님의 정보가 삭제되었습니다.`);
              router.back();
            } catch (err: any) {
              Alert.alert('삭제 실패', err.message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleNamePress = async () => {
    const hasRoster = await loadRosterData();
    if (hasRoster) {
      setModalVisible(true);
    } else {
      Alert.alert('알림', `${name}님의 명부 정보가 없습니다.`);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{name}님의 명부 정보</Text>
            
            {rosterData && (
              <View style={styles.rosterInfo}>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>이름:</Text>
                  <Text style={styles.rosterValue}>{rosterData.name}</Text>
                </View>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>생년월일:</Text>
                  <Text style={styles.rosterValue}>{rosterData.birth}</Text>
                </View>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>성별:</Text>
                  <Text style={styles.rosterValue}>{rosterData.gender}</Text>
                </View>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>연락처:</Text>
                  <Text style={styles.rosterValue}>{rosterData.phone}</Text>
                </View>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>비상 연락처:</Text>
                  <Text style={styles.rosterValue}>{rosterData.emergency}</Text>
                </View>
                <View style={styles.rosterRow}>
                  <Text style={styles.rosterLabel}>주소:</Text>
                  <Text style={styles.rosterValue}>{rosterData.address}</Text>
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
    <View style={{ marginBottom: 12 }}>
      <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>이름:</Text>
          <TouchableOpacity onPress={handleNamePress}>
            <Text style={[styles.infoValue, { textDecorationLine: 'underline', color: '#1e88e5' }]}>{name}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>생년월일:</Text>
          <Text style={styles.infoValue}>
            {dob?.length === 8
              ? `${dob.slice(2, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}`
              : dob}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>가입일:</Text>
          <Text style={styles.infoValue}>{createdAt}</Text>
        </View>
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => Alert.alert(
            '포인트 초기화',
            `${name}님의 포인트를 0으로 초기화 하시겠습니까?`,
            [
              { text: '취소', style: 'cancel' },
              { text: '확인', onPress: () => resetPoints() }
            ]
          )}
        >
          <Text style={styles.infoLabel}>포인트:</Text>
          <Text style={[styles.infoValue, { textDecorationLine: 'underline', color: '#1e88e5' }]}>
            {points.toLocaleString()}P
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => Alert.alert('UUID', uuid)}
        >
          <Text style={styles.infoLabel}>UUID:</Text>
          <Text style={[styles.infoValue, { textDecorationLine: 'underline', color: '#1e88e5' }]}>
            눌러서 확인
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/stamp',
            params: { uuid, name, dob, fromAdmin: 'true' },
          })
        }
      >
        <Text style={styles.cardLabel}>스탬프</Text>
        <Text style={styles.cardValue}>{stampCount}</Text>
      </TouchableOpacity>
  
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/coupons',
            params: { uuid, name, dob, fromAdmin: 'true' },
          })
        }
      >
        <Text style={styles.cardLabel}>쿠폰</Text>
        <Text style={styles.cardValue}>{couponCount}</Text>
      </TouchableOpacity>
  
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, isLoading && { opacity: 0.6 }]}
          onPress={handleAddStamp}
          activeOpacity={0.8}
          disabled={isLoadingOne || isLoadingFive}
        >
          <View style={styles.buttonContent}>
            {isLoadingOne ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>스탬프 적립 중...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>스탬프 +1</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, isLoading && { opacity: 0.6 }]}
          onPress={handleAddStampFive}
          activeOpacity={0.8}
          disabled={isLoadingOne || isLoadingFive}
        >
          <View style={styles.buttonContent}>
            {isLoadingFive ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>스탬프 적립 중...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>스탬프 +5</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#8E44AD' }]}
          onPress={() =>
            router.push({
              pathname: '/memo',
              params: { uuid, name },
            })
          }
        >
          <Text style={styles.buttonText}>관리자 메모</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#607D8B' }]}
          onPress={() => {
            router.push({
              pathname: '/logs',
              params: { uuid, name },
            });
          }}
        >
          <Text style={styles.buttonText}>로그 보기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#009688' }]}
          onPress={() => {
            router.push({
              pathname: '/stamp-history',
              params: { uuid, name },
            });
          }}
        >
          <Text style={styles.buttonText}>스탬프 이력</Text>
        </TouchableOpacity>
  
        <TouchableOpacity
          style={[styles.button, styles.deleteButton, isDeleting && { opacity: 0.6 }]}
          onPress={handleDeleteUser}
          activeOpacity={0.8}
          disabled={isDeleting}
        >
          <View style={styles.buttonContent}>
            {isDeleting ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                <Text style={[styles.buttonText, styles.deleteButtonText]}>회원 삭제중...</Text>
              </View>
            ) : (
              <Text style={[styles.buttonText, styles.deleteButtonText]}>회원 삭제</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );  
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f6f6f6',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'GiantRegular',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'GiantRegular',
  },
  cardValue: {
    fontSize: 28,
    marginTop: 8,
    fontFamily: 'GiantRegular',
  },
  buttonGroup: {
    marginTop: 32,
    gap: 12,
  },
  buttonWrapper: {
    marginBottom: 12,
  },
  
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'GiantRegular', // 커스텀 폰트 반영
  },
  
  deleteButton: {
    backgroundColor: '#f44336',
  },
  
  deleteButtonText: {
    color: '#fff',
  },

  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 100, // 라벨 고정 너비
    fontSize: 14,
    color: '#333',
    fontFamily: 'GiantRegular',
    textAlign: 'right', // 👉 오른쪽 정렬 추가
    marginRight: 8,     // 👉 라벨과 값 사이 여백
  },
  infoValue: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'GiantRegular',
    flexShrink: 1, // 길어지면 줄이기
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
    fontFamily: 'GiantBold',
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
    fontFamily: 'GiantRegular',
  },
  rosterValue: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'GiantRegular',
    flex: 1,
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
    fontFamily: 'GiantRegular',
  },
});
