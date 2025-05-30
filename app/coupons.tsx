// coupons.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { findCaptains } from '../utils/find-captains';
import { sendPushToUser } from '../utils/send-push';
import { useOneCoupon } from '../utils/stamp-service';

export default function CouponsScreen() {
  const { uuid, name, dob, fromAdmin } = useLocalSearchParams<{
    name: string;
    dob: string;
    uuid: string;
    fromAdmin?: string;
  }>();
  const router = useRouter();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);

  const fetchCoupons = async () => {
    const ref = collection(db, `users/${uuid}/coupons`);
    const snapshot = await getDocs(ref);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setCoupons(list);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCoupons();
    setRefreshing(false);
  };

  const handleRevoke = async () => {
    try {
      await deleteDoc(doc(db, `users/${uuid}/coupons`, selectedCoupon.id));
      await fetchCoupons();
      await sendPushToUser({
        uuid,
        title: '쿠폰 회수 알림',
        body: '선택한 쿠폰이 관리자에 의해 회수되었습니다.',
        data: {
          screen: 'coupons',
          uuid,
        },
      });
    } catch {
      Alert.alert('오류', '회수 중 문제가 발생했습니다.');
    } finally {
      setModalVisible(false);
    }
  };

  const handleUse = async () => {
    try {
      await useOneCoupon(uuid);
      await fetchCoupons();
      await sendPushToUser({
        uuid,
        title: '쿠폰 사용 처리',
        body: '쿠폰이 정상적으로 사용 처리되었습니다.',
        data: {
          screen: 'coupons',
          uuid,
        },
      });
    } catch {
      Alert.alert('오류', '쿠폰 사용 처리 중 문제가 발생했습니다.');
    } finally {
      setModalVisible(false);
    }
  };

  const handleRequestToCaptains = async (name: string | string[], uuid: string | string[], dob: string | string[]) => {
    const captains = await findCaptains();
    if (captains.length === 0) {
      Alert.alert('에러', '등록된 선장이 없습니다.');
      return;
    }
    const requests = captains.map((captain) => {
      if (!captain.expoPushToken) return null;
      return sendPushToUser({
        uuid: captain.uuid,
        title: '쿠폰 사용 요청',
        body: `${name} 님이 쿠폰 사용을 요청했습니다.`,
        data: { screen: 'member-detail', uuid, name, dob },
      });
    });
    await Promise.all(requests);
    Alert.alert('요청 완료', '선장님께 쿠폰 사용 요청을 보냈습니다.');
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        <Text style={styles.title}>내 쿠폰 목록 {fromAdmin === 'true' && <Text style={styles.adminMode}>(관리자모드)</Text>}</Text>
        <Text style={styles.subtitle}>회원정보: {name} / {dob}</Text>
      </View>

      {coupons.length === 0 ? (
        <Text style={styles.empty}>보유 중인 쿠폰이 없습니다.</Text>
      ) : (
        <FlatList
          data={coupons}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (fromAdmin === 'true') {
                  if (item.used) return;
                  setSelectedCoupon(item);
                  setModalVisible(true);
                } else {
                  if (item.used) {
                    Alert.alert('사용된 쿠폰 삭제', '이 쿠폰을 삭제하시겠습니까?', [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제', style: 'destructive', onPress: async () => {
                          await deleteDoc(doc(db, `users/${uuid}/coupons`, item.id));
                          await fetchCoupons();
                        }
                      }
                    ]);
                  } else {
                    Alert.alert('쿠폰 사용 요청', '선장님께 사용 요청하시겠습니까?', [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '요청', onPress: async () => {
                          const couponRef = doc(db, `users/${uuid}/coupons`, item.id);
                          const couponSnap = await getDoc(couponRef);
                          if (!couponSnap.exists() || couponSnap.data().used) {
                            Alert.alert('사용 불가', '이미 사용된 쿠폰입니다.');
                            await fetchCoupons();
                            return;
                          }
                          await handleRequestToCaptains(name, uuid, dob);
                        }
                      }
                    ]);
                  }
                }
              }}
            >
              <View style={[styles.couponBox, item.used && { borderLeftColor: '#ccc', backgroundColor: '#f2f2f2' }]}>
                {/* 🎯 50% 뱃지 */}
                {item.isHalf === 'Y' && (
                  <View style={styles.halfBadge}>
                    <Text style={styles.halfBadgeText}>50%</Text>
                  </View>
                )}

                <View style={styles.couponRow}>
                  <Ionicons name="boat-outline" size={24} color={item.used ? '#999' : '#4CAF50'} style={{ marginRight: 8 }} />
                  <Text style={styles.couponText}>발급일: {item.issuedAt}</Text>
                </View>
                <Text style={{ fontSize: 14, marginTop: 4, color: item.used ? '#999' : '#4CAF50', fontFamily: 'GiantRegular' }}>
                  상태: {item.used ? '✅ 사용됨 (삭제 가능)' : '🟢 사용 가능'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>쿠폰 처리</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>발급일: {selectedCoupon?.issuedAt}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 16 }]}
              onPress={() => {
                Alert.alert(
                  '쿠폰 사용',
                  '선택한 쿠폰을 사용 처리하시겠습니까?',
                  [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '사용',
                      style: 'default',
                      onPress: handleUse,
                    },
                  ]
                );
              }}
            >
              <Text style={styles.buttonText}>쿠폰 사용</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 10, backgroundColor: '#f44336' }]}
              onPress={() => {
                Alert.alert(
                  '쿠폰 회수',
                  '선택한 쿠폰을 회수하시겠습니까?',
                  [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '회수',
                      style: 'destructive',
                      onPress: handleRevoke,
                    },
                  ]
                );
              }}
            >
              <Text style={styles.buttonText}>쿠폰 회수</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f9fc',
  },
  cardBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  empty: {
    fontSize: 16,
    color: '#999',
    marginTop: 30,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
  },
  couponBox: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
    marginHorizontal: 1,
    marginVertical: 1
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  adminMode: {
    fontSize: 16,
    color: '#f44336',
    fontFamily: 'GiantRegular',
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
  halfBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'gold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    elevation: 3,
    opacity: 0.9,
  },
  
  halfBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'GiantRegular',
  },
});
