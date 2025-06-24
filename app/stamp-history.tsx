import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal'; // expo install react-native-modal
import { getStampHistory } from '../utils/stamp-service';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

type StampHistoryItem = {
  id: string;
  action: 'add' | 'recall' | 'remove';
  method: string;
  timestamp: any; // Firestore Timestamp
  message: string;
  [key: string]: any;
};

async function clearStampHistory(uuid: string) {
    const historyRef = collection(db, `users/${uuid}/stampHistory`);
    const snap = await getDocs(historyRef);
    const batchDeletes = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(batchDeletes);
}

function setDateToLocalMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
}

function setDateToLocalEndOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

const showHistoryDetail = (item: StampHistoryItem) => {
    let resultLabel = '';
    if (item.action === 'add') resultLabel = '적립';
    else if (item.action === 'remove') resultLabel = '삭제';
    else if (item.action === 'recall') resultLabel = '회수';

    Alert.alert(
        '스탬프 이력 상세',
        `사유: ${item.message}\n최초 적립일: ${item.date}\n이력 발생일: ${
        item.timestamp?.toDate
            ? format(item.timestamp.toDate(), 'yyyy-MM-dd, HH:mm')
            : '-'
        }
        `,
        [{ text: '확인', style: 'default' }]
    );
};

export default function StampHistoryScreen() {
  const { uuid, name } = useLocalSearchParams<{ uuid: string; name: string }>();
  const [history, setHistory] = useState<StampHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // 하단 모달 DatePicker
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateTarget, setDateTarget] = useState<'start' | 'end' | null>(null);
  const [tmpDate, setTmpDate] = useState<Date>(new Date());

  const { showActionSheetWithOptions } = useActionSheet();
  const [action, setAction] = useState<'all' | 'add' | 'recall' | 'remove'>('all');

  // 삭제 핸들러
  async function handleClearHistory() {
    Alert.alert(
      '이력 전체 삭제',
      '정말로 이 회원의 모든 스탬프 이력을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await clearStampHistory(uuid);
            setHistory([]);
          }
        }
      ]
    );
  }

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, startDate, endDate, action]);

  async function fetchHistory() {
    setRefreshing(true);
    try {
      let result = await getStampHistory({
        uuid,
        startDate,
        endDate,
      }) as StampHistoryItem[];
      if (action !== 'all') result = result.filter(x => x.action === action);
      setHistory(result);
    } finally {
      setRefreshing(false);
    }
  }

  // 액션시트 + 날짜(하단 모달)
  function openFilterSheet() {
    const options = [
      `시작일: ${startDate ? format(startDate, 'yyyy-MM-dd') : '-'}`,
      `종료일: ${endDate ? format(endDate, 'yyyy-MM-dd') : '-'}`,
      '전체',
      '적립만',
      '회수만',
      '삭제만',
      '필터 초기화',
      '취소',
    ];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 6,
        title: '필터 선택',
      },
      (selectedIndex) => {
        if (selectedIndex === 0) {
            setTmpDate(startDate || new Date());
            setDateTarget('start');
            setShowDateModal(true);
          }
          if (selectedIndex === 1) {
            setTmpDate(endDate || new Date());
            setDateTarget('end');
            setShowDateModal(true);
          }
        if (selectedIndex === 2) setAction('all');
        if (selectedIndex === 3) setAction('add');
        if (selectedIndex === 4) setAction('recall');
        if (selectedIndex === 5) setAction('remove');
        if (selectedIndex === 6) {
          setAction('all');
          setStartDate(undefined);
          setEndDate(undefined);
        }
      }
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{name}님의 스탬프 이력</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
            <Ionicons name="alert-circle-outline" size={16} color="#e53935" />
            <Text style={styles.clearButtonText}>삭제</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 필터 버튼 한 개 */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterButton} onPress={openFilterSheet}>
          <Ionicons name="filter" size={15} color="#1e88e5" />
          <Text style={styles.filterText}>
            {(startDate || endDate) && (
              `${startDate ? format(startDate, 'yy-MM-dd') : ''} ~ ${endDate ? format(endDate, 'yy-MM-dd') : ''} / `
            )}
            {action === 'all'
              ? '전체'
              : action === 'add'
              ? '적립만'
              : action === 'remove'
              ? '삭제만'
              : '회수만'}
          </Text>
          <Ionicons name="chevron-down" size={15} color="#aaa" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* 날짜 선택 부분 */}
        {Platform.OS === 'ios' ? (
        <Modal
            isVisible={showDateModal}
            onBackdropPress={() => setShowDateModal(false)}
            style={{ justifyContent: 'flex-end', margin: 0 }}
        >
            <View style={{ backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <DateTimePicker
                value={tmpDate}
                mode="date"
                display="spinner"
                onChange={(_, date) => date && setTmpDate(date)}
            />
            <TouchableOpacity
                style={{ marginTop: 10, backgroundColor: '#2196F3', padding: 12, borderRadius: 8 }}
                onPress={() => {
                    setShowDateModal(false);
                    let localDate;
                    if (dateTarget === 'start') {
                        localDate = setDateToLocalMidnight(tmpDate);
                        setStartDate(localDate);
                    } else if (dateTarget === 'end') {
                        localDate = setDateToLocalEndOfDay(tmpDate);
                        setEndDate(localDate);
                    }
                    setDateTarget(null);
                }}
            >
                <Text style={{ color: '#fff', textAlign: 'center' }}>확인</Text>
            </TouchableOpacity>
            </View>
        </Modal>
        ) : (
        showDateModal && (
            <DateTimePicker
            value={tmpDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
                if (event.type === 'set' && date) {
                setShowDateModal(false);
                const localDate = setDateToLocalMidnight(date);
                if (dateTarget === 'start') setStartDate(localDate);
                else if (dateTarget === 'end') setEndDate(localDate);
                setDateTarget(null);
                }
                if (event.type === 'dismissed') {
                setShowDateModal(false);
                setDateTarget(null);
                }
            }}
            />
        )
        )}



      <FlatList
        data={history}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }: { item: StampHistoryItem }) => (
            <TouchableOpacity onPress={() => showHistoryDetail(item)}>
                <View style={styles.item}>
                    <Text style={styles.itemTitle}>
                        {item.action === 'add' && <Text>적립</Text>}
                        {item.action === 'recall' && <Text style={{ color: '#666666' }}>회수</Text>}
                        {item.action === 'remove' && <Text style={{ color: '#e53935' }}>삭제</Text>}
                        <Text style={{ color: '#aaa', fontSize: 13 }}> ({item.method})</Text>
                    </Text>
                    <Text style={styles.itemBody}>{item.message}</Text>
                    <Text style={styles.itemTime}>
                    {item.timestamp?.toDate
                        ? format(item.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss')
                        : '-'}
                    </Text>
                </View>
            </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>📝 기록된 이력이 없습니다.</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchHistory} />
        }
        contentContainerStyle={{ paddingBottom: 50 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f7f9fc' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontFamily: 'GiantRegular', color: '#1e88e5', marginBottom: 3 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e3f2fd', borderRadius: 8 },
  filterText: { marginLeft: 4, fontSize: 14, color: '#1e88e5', fontFamily: 'GiantRegular' },
  item: { padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
  itemTitle: { fontSize: 15, fontFamily: 'GiantRegular', color: '#1e88e5' },
  itemBody: { fontSize: 14, fontFamily: 'GiantRegular', color: '#333', marginTop: 2 },
  itemTime: { fontSize: 12, fontFamily: 'GiantRegular', color: '#888', marginTop: 4 },
  empty: { marginTop: 30, textAlign: 'center', fontFamily: 'GiantRegular', color: '#777' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fce4ec',
    borderRadius: 8,
  },
  clearButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#e53935',
    fontFamily: 'GiantRegular',
  },
});
