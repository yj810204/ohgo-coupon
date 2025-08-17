import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';

export default function LogsScreen() {
  const { uuid, name } = useLocalSearchParams<{ uuid: string; name: string }>();
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const logRef = collection(db, `users/${uuid}/logs`);
    const q = query(logRef, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    const items = snap.docs.map(doc => {
      const { action, detail, timestamp } = doc.data();
      return {
        action,
        detail,
        timestamp: timestamp?.toDate?.() || new Date(),
      };
    });
    setLogs(items);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const clearLogs = async () => {
    Alert.alert(
      '로그 전체 삭제',
      '정말로 이 회원의 모든 로그를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const logRef = collection(db, `users/${uuid}/logs`);
              const snap = await getDocs(logRef);
              const batchDeletes = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
              await Promise.all(batchDeletes);
              setLogs([]); // 리스트 비우기
            } catch (e) {
              Alert.alert('삭제 실패', '삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{name}님의 활동 로그</Text>
        {logs.length > 0 && (
          <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
            <Ionicons name="alert-circle-outline" size={16} color="#e53935" />
            <Text style={styles.clearButtonText}>삭제</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={logs}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }: { item: any }) => {
            const parts = item.detail.split(/(사용)/); // '사용' 기준으로 분리
          
            return (
              <View style={styles.item}>
                <Text style={styles.itemTitle}>{item.action}</Text>
                <Text style={styles.itemBody}>
                  {parts.map((part: string, index: number) =>
                    part === '사용' ? (
                      <Text key={index} style={styles.highlight}>
                        {part}
                      </Text>
                    ) : (
                      <Text key={index}>{part}</Text>
                    )
                  )}
                </Text>
                <Text style={styles.itemTime}>{format(item.timestamp, 'yyyy-MM-dd HH:mm:ss')}</Text>
              </View>
            );
          }}
        ListEmptyComponent={<Text style={styles.empty}>📝 기록된 활동이 없습니다.</Text>}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f9fc',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
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
  item: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  itemBody: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginTop: 2,
  },
  itemTime: {
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: '#888',
    marginTop: 4,
  },
  empty: {
    marginTop: 30,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
    color: '#777',
  },
  highlight: {
    backgroundColor: '#ffff00',
    borderRadius: 4,
    color: '#e53935'
  },
});