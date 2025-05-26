import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { deleteStamp, getCouponCount, getStamps } from '../utils/stamp-service';

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStamps();
    setRefreshing(false);
  };

  const fetchStamps = async () => {
    if (typeof uuid !== 'string') return;
    const data = await getStamps(uuid);
    setStamps(data);

    const coupons = await getCouponCount(uuid);
    setCouponCount(coupons);
  };

  useFocusEffect(
    useCallback(() => {
      fetchStamps();
    }, [uuid])
  );

  const renderStamp = (index: number) => {
    const raw = stamps[index];
    const filled = !!raw;
  
    const [date, method, time] = raw ? raw.split('|') : [null, null, null];

    const methodLabel = method === 'ADMIN'
    ? '선장님'
    : method === 'QR'
    ? 'QR 스캔'
    : '알 수 없음';
  
    return (
      <TouchableOpacity
        key={index}
        style={styles.stampBox}
        disabled={!filled}
        onPress={() => {
          setSelectedStampInfo({
            date: date && time ? `${date} ${time}` : '',
            method: methodLabel || undefined,
            index,
          });
          setModalVisible(true);
        }}
      >
        <Text style={filled ? styles.stampChecked : styles.stampEmpty}>
          {filled ? (
            <Ionicons name="ribbon-outline" size={32} color="#4caf50" />
          ) : (
            <Ionicons name="ellipse-outline" size={32} color="#ccc" />
          )}
        </Text>
        <Text style={styles.dateText} numberOfLines={1} ellipsizeMode='clip'>{date || '-'}</Text>
      </TouchableOpacity>
    );
  };
  

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.userInfo}>
        <Text style={styles.title}>
          스탬프 적립 현황 {fromAdmin === 'true' && <Text style={styles.adminMode}>(관리자모드)</Text>}
        </Text>
        <Text style={styles.info}>회원정보 : {name} / {dob}</Text>
      </View>

      <View style={styles.cardBox}>
        <View style={styles.grid}>
          {Array.from({ length: 10 }).map((_, i) => renderStamp(i))}
        </View>
      </View>

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
            <Text style={styles.buttonText}>보유 쿠폰 / {couponCount}개</Text>
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
    padding: 24,
    backgroundColor: '#f7f9fc',
    alignItems: 'center',
    minHeight: '100%',
  },
  userInfo: {
    backgroundColor: '#fff',
    padding: 16,
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
    fontSize: 12,
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
  stampBox: {
    width: 70,
    height: 70,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
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
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  floatingButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 35 : 70,
    right: 25,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
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
});
