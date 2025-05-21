import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getTodayCouponsStatus } from '../utils/coupon-utils';
import { sendPushToUser } from '../utils/send-push';
import {
  addStamp,
  deleteUser,
  getCouponCount,
  getStamps,
  useOneCoupon
} from '../utils/stamp-service';

export default function MemberDetail() {
  const { name, uuid, dob } = useLocalSearchParams<{ name: string; uuid: string; dob: string }>();

  const [stampCount, setStampCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    loadCounts();
  }, [uuid]);

  const handleAddStamp = async () => {
    setIsLoading(true);
    try {
      await addStamp(uuid, 'ADMIN');
      await loadCounts();
  
      // ✅ 쿠폰 조건 메시지 처리
      if (stampCount + 1 >= 10) {
        Alert.alert('쿠폰 발급', `${name}님에게 쿠폰이 1개 발급되었습니다.`);
      }

      // ✅ 스탬프 적립 푸시 알림 전송
      await sendPushToUser({
        uuid,
        title: '스탬프가 적립되었어요~!',
        body: `${name}님, 스탬프가 1개 추가되었습니다~! ✨`,
        data: {
          screen: 'stamp',
          uuid,
          name,
          dob,
        }
      });
    } catch (err: any) {
      Alert.alert('스탬프 적립 실패', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCoupon = async () => {
    if (couponCount <= 0) {
      Alert.alert('쿠폰 없음', `${name}님은 현재 사용 가능한 쿠폰이 없습니다.`);
      return;
    }
  
    const today = format(new Date(), 'yyyy-MM-dd');
  
    try {
      const { usedToday, onlyTodayIssued } = await getTodayCouponsStatus(uuid, today);
  
      if (usedToday) {
        Alert.alert(
          '확인',
          `${name}님은 오늘 이미 쿠폰을 사용하셨습니다. 그래도 계속하시겠습니까?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '계속', style: 'destructive', onPress: () => proceedUseCoupon() },
          ]
        );
      } else if (onlyTodayIssued) {
        Alert.alert(
          '주의',
          `${name}님이 보유한 쿠폰은 모두 오늘 발급된 쿠폰입니다. 바로 사용하시겠습니까?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '사용', style: 'default', onPress: () => proceedUseCoupon() },
          ]
        );
      } else {
        Alert.alert(
          '쿠폰 사용',
          `${name}님의 쿠폰을 사용 처리할까요?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '사용', style: 'default', onPress: () => proceedUseCoupon() },
          ]
        );
      }
    } catch (err) {
      Alert.alert('확인 실패', '쿠폰 정보 확인 중 오류가 발생했습니다.');
    }
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
              // router.replace('/admin'); // ✅ 삭제 후 이동
              router.back(); // ✅ 삭제 후 뒤로가기
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
      <Text style={styles.subtitle}>회원정보 : {name} / {dob}</Text>
      <Text style={styles.text}>UUID: {uuid}</Text>
  
      <View style={styles.card}>
        <Text style={styles.cardLabel}>스탬프 수</Text>
        <Text style={styles.cardValue}>{stampCount}</Text>
      </View>
  
      <View style={styles.card}>
        <Text style={styles.cardLabel}>쿠폰 수</Text>
        <Text style={styles.cardValue}>{couponCount}</Text>
      </View>
  
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, isLoading && { opacity: 0.6 }]}
          onPress={handleAddStamp}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <View style={styles.buttonContent}>
            {isLoading ? (
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
          style={[styles.button, { backgroundColor: '#4CAF50' }]}
          onPress={handleUseCoupon}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>쿠폰 사용</Text>
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
    flex: 1,
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
});
