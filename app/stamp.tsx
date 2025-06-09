import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { deleteStamp, getCouponCount, getStamps, issue50PercentCoupon } from '../utils/stamp-service';

export default function StampScreen() {
  const { name, dob, uuid, fromAdmin } = useLocalSearchParams<{
    name: string;
    dob: string;
    uuid: string;
    fromAdmin?: string;
  }>();
  const [stamps, setStamps] = useState<string[]>([]);
  const [couponCount, setCouponCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStampInfo, setSelectedStampInfo] = useState<{ date: string; method?: string; index?: number; } | null>(null);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStamps();
    setRefreshing(false);
  };

  const fetchStamps = async () => {
    if (typeof uuid !== 'string') return;
  
    const data = await getStamps(uuid);
  
    // ✅ 날짜 + 시간 기준으로 최신순 정렬
    const sorted = [...data].sort((a, b) => {
      const [dateA, , timeA] = a.split('|');
      const [dateB, , timeB] = b.split('|');
      return new Date(`${dateB}T${timeB}`).getTime() - new Date(`${dateA}T${timeA}`).getTime();
    });
  
    setStamps(sorted);
  
    const coupons = await getCouponCount(uuid);
    setCouponCount(coupons);
  };
  

  const groupStamps = (arr: string[]) => {
    const grouped: string[][] = [];
    for (let i = 0; i < arr.length; i += 3) {
      grouped.push(arr.slice(i, i + 3));
    }
    return grouped;
  };

  useFocusEffect(
    useCallback(() => {
      fetchStamps();
    }, [uuid])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const renderStampItem = (raw: string, index: number) => {
    if (!raw) return null;
    const [date, method, time] = raw.split('|');
    const methodLabel = method === 'ADMIN' ? '선장님' : method === 'QR' ? 'QR 스캔' : '알 수 없음';
  
    const fifthStampRaw = stamps[stamps.length - 5];
    const isFifth = raw === fifthStampRaw && stamps.length >= 5;
  
    return (
      <TouchableOpacity
        key={index}
        onPress={() => {
          if (isFifth && fromAdmin !== 'true') {
            Alert.alert(
              '50% 쿠폰 발급',
              '50% 할인 쿠폰을 발급하시겠습니까?',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '발급',
                  onPress: async () => {
                    await issue50PercentCoupon(uuid as string);
                    Alert.alert('🎉 쿠폰 발급 완료', '50% 쿠폰이 발급되었습니다!');
                    await fetchStamps();
                  },
                },
              ]
            );
          } else {
            setSelectedStampInfo({
              date: `${date} ${time}`,
              method: methodLabel,
              index,
            });
            setModalVisible(true);
          }
        }}
      >
        <View
          style={[
            styles.stampItem,
            isFifth && {
              backgroundColor: '#FFF8DC',
              borderLeftWidth: 4,
              borderLeftColor: 'gold'
            },
          ]}
        >
          <Ionicons
            name="ticket-outline"
            size={24}
            color={isFifth ? 'gold' : '#4caf50'}
            style={{ marginRight: 12 }}
          />
          <View>
            <Text style={[styles.stampDate, isFifth && { color: '#DAA520' }]}>
              {date.replace(/-/g, '-')}, {time?.slice(0, 5)}
            </Text>
            <Text style={[styles.stampMethod, isFifth && { color: '#DAA520' }]}>
              {isFifth ? '⭐ 50% 쿠폰 발급 가능 ⭐' : `적립 방법: ${methodLabel}`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };  
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f7f9fc' }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.userInfo}>
        <Text style={styles.title}>
          스탬프 현황 {fromAdmin === 'true' && <Text style={styles.adminMode}>(관리자모드)</Text>}
        </Text>
        <Text style={styles.info}>회원정보 : {name} / {dob?.length === 8 ? `${dob.slice(2, 4)}-${dob.slice(4, 6)}-${dob.slice(6, 8)}` : dob}</Text>
      </View>

      {stamps.length === 0 ? (
        <Text style={styles.empty}>스탬프가 아직 없어요!</Text>
      ) : (
        <View style={styles.cardBox}>
          {stamps.map((stamp, index) => renderStampItem(stamp, index))}
        </View>
      )}

      <View style={styles.buttonWrapper}>
        {/* <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.push({ pathname: '/qr-scan', params: { uuid, name, dob } })
          }
        >
          <Text style={styles.buttonText}>QR 스캔하기</Text>
        </TouchableOpacity> */}

        {fromAdmin !== 'true' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.push({ pathname: '/coupons', params: { uuid, name, dob } })
            }
          >
            <Text style={styles.buttonText}>보유 쿠폰: {couponCount}개</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stamp Modal */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 제목 + 닫기 버튼 라인 */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>스탬프 정보</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>적립일: {selectedStampInfo?.date}</Text>
            <Text style={styles.modalText}>적립 방법: {selectedStampInfo?.method || '알 수 없음'}</Text>

            {fromAdmin === 'true' && selectedStampInfo?.index !== undefined && (
              <TouchableOpacity
                onPress={async () => {
                  const index = selectedStampInfo.index!;
                  const fullValue = stamps[index]; // ← 실제 삭제할 스탬프 문자열
                  await deleteStamp(uuid as string, fullValue, name as string, dob as string); // ✅ Firestore 삭제 함수 호출
                  await fetchStamps(); // ✅ 새로고침
                  setModalVisible(false); // ✅ 모달 닫기
                }}
                style={[styles.primaryButton, { marginTop: 12, backgroundColor: '#f44336' }]}
              >
                <Text style={styles.buttonText}>스탬프 회수</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>


      </ScrollView>

      {fromAdmin !== 'true' && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() =>
            router.push({ pathname: '/qr-scan', params: { uuid, name, dob } })
          }
        >
          <Ionicons name="qr-code-outline" size={50} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    backgroundColor: '#f7f9fc',
    alignItems: 'center',
    minHeight: '100%',
  },
  userInfo: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  info: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'GiantRegular',
  },
  dateText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'GiantRegular',
  },
  title: {
    fontSize: 22,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 0,
    rowGap: 12,
  },
  stampRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10, // 스탬프 사이 여백
  },
  stampBox: {
    width: 65,
    height: 65,
    margin: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  glowing: {
    fontSize: 28,
    color: '#FFD700', // gold
    textShadowColor: 'rgba(255, 215, 0, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  stampChecked: {
    fontSize: 28,
    fontFamily: 'GiantRegular',
    color: '#4caf50',
  },
  stampEmpty: {
    fontSize: 28,
    color: '#ccc',
  },
  buttonWrapper: {
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'GiantRegular',
  },
  cardBox: {
    backgroundColor: '#fff',
    padding: 12,
    width: '100%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emptyStampBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyStampText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 4,
  },
  emptyStampSub: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#888',
  },
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 35 : 70,
    right: 25,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fb2f86',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
  },
  modalText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginBottom: 4,
  },
  adminMode: {
    fontSize: 16,
    color: '#f44336',
    fontFamily: 'GiantRegular',
  },
  stampItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 8
  },
  stampDate: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  stampMethod: {
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: '#888',
    marginTop: 2,
  },
  empty: {
    fontSize: 16,
    color: '#999',
    marginTop: 30,
    marginBottom: 40,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
  },  
});
