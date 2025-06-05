import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export default function MemberDetail() {
  const { name, uuid, dob } = useLocalSearchParams<{ name: string; uuid: string; dob: string }>();
  const [targetUserIsAdmin, setTargetUserIsAdmin] = useState<boolean>(false);

  const [stampCount, setStampCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOne, setIsLoadingOne] = useState(false);
  const [isLoadingFive, setIsLoadingFive] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [createdAt, setCreatedAt] = useState('');
  const [lastStampDate, setLastStampDate] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [logsVisible, setLogsVisible] = useState(false)

  const onRefresh = async () => {
  setRefreshing(true);
  await loadCounts();
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

  useEffect(() => {
    loadCounts();
    loadTargetUserInfo();
  }, [uuid]);

  const handleAddStamp = async () => {
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
  };

  const handleAddStampFive = async () => {
    Alert.alert(
      '스탬프 5회 적립',
      `${name}님에게 스탬프 5개를 적립하시겠습니까?`,
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

  const handleDeleteUser = async () => {
    if (targetUserIsAdmin) {
      Alert.alert('삭제 불가', '관리자는 삭제할 수 없습니다.');
      return;
    }
  
    Alert.alert(
      '회원 삭제',
      `${name}님의 모든 데이터가 삭제됩니다. 진행할까요?`,
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
    <View style={{ marginBottom: 12 }}>
      <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>이름:</Text>
          <Text style={styles.infoValue}>{name}</Text>
        </View>
        <View style={[styles.infoRow, { marginBottom: 12 }]}>
          <Text style={styles.infoLabel}>생년월일:</Text>
          <Text style={styles.infoValue}>{dob}</Text>
        </View>
        {createdAt !== '' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>가입일:</Text>
            <Text style={styles.infoValue}>{createdAt}</Text>
          </View>
        )}
        {lastStampDate !== '' && (
          <View style={[styles.infoRow, { marginBottom: 12 }]}>
            <Text style={styles.infoLabel}>최근 스탬프:</Text>
            <Text style={styles.infoValue}>{lastStampDate}</Text>
          </View>
        )}
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
});
