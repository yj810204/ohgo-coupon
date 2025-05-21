import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';
import { findCaptains } from '../utils/find-captains';
import { sendPushToUser } from '../utils/send-push';

export default function CouponsScreen() {
  const { uuid, name, dob } = useLocalSearchParams();
  const router = useRouter();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoupons = async () => {
    const ref = collection(db, `users/${uuid}/coupons`);
    const snapshot = await getDocs(ref);
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setCoupons(list);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCoupons();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        <Text style={styles.title}>내 쿠폰 목록</Text>
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
                if (item.used) {
                  Alert.alert(
                    '사용된 쿠폰 삭제',
                    '이 쿠폰을 삭제하시겠습니까?',
                    [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteDoc(doc(db, `users/${uuid}/coupons`, item.id));
                            await fetchCoupons(); // ✅ 삭제 후 목록 새로고침
                          } catch (err) {
                            Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
                          }
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert('쿠폰 사용 요청', '선장님께 사용 요청하시겠습니까?', [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '요청',
                      onPress: async () => {
                        try {
                          const couponRef = doc(db, `users/${uuid}/coupons`, item.id);
                          const couponSnap = await getDoc(couponRef);
                    
                          if (!couponSnap.exists()) {
                            Alert.alert('오류', '쿠폰 정보를 찾을 수 없습니다.');
                            return;
                          }
                    
                          const data = couponSnap.data();
                          if (data.used) {
                            Alert.alert('사용 불가', '이미 사용된 쿠폰입니다.');
                            await fetchCoupons(); // 상태 갱신
                            return;
                          }
                    
                          await handleRequestToCaptains(name, uuid, dob);
                        } catch (e) {
                          console.error('쿠폰 상태 확인 실패:', e);
                          Alert.alert('오류', '쿠폰 상태 확인 중 오류가 발생했습니다.');
                        }
                      }
                    }
                  ]);
                }
              }}
            >
              <View
                style={[
                  styles.couponBox,
                  item.used && {
                    borderLeftColor: '#ccc',
                    backgroundColor: '#f2f2f2',
                  },
                ]}
              >
                <View style={styles.couponRow}>
                  <Ionicons
                    name="trash-outline" // 아이콘도 변경 가능
                    size={24}
                    color={item.used ? '#999' : '#4CAF50'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.couponText}>발급일: {item.issuedAt}</Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    marginTop: 4,
                    color: item.used ? '#999' : '#4CAF50',
                    fontWeight: '600',
                  }}
                >
                  상태: {item.used ? '✅ 사용됨 (삭제 가능)' : '🟢 사용 가능'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const isJustIssued = (issuedAt: string): boolean => {
  try {
    const issuedTime = new Date(issuedAt);
    const now = new Date();
    const diff = now.getTime() - issuedTime.getTime();
    return diff < 10000; // 10초 이내 발급된 쿠폰
  } catch {
    return false;
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
        data: {
          screen: 'member-detail',
          uuid,
          name,
          dob,
        },
      });
    });
  
    await Promise.all(requests);
    Alert.alert('요청 완료', '선장님께 쿠폰 사용 요청을 보냈습니다.');
  };

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
  });
  