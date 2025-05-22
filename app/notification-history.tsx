import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationHistory() {
    type NotificationLog = {
        title: string;
        body: string;
        time: string;
    };

  const [history, setHistory] = useState<NotificationLog[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const json = await SecureStore.getItemAsync('notificationHistory');
    if (json) {
      setHistory(JSON.parse(json));
    }
  };

  const clearHistory = async () => {
    Alert.alert('기록 삭제', '모든 알림 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('notificationHistory');
          setHistory([]);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>알림 내역</Text>
        {history.length > 0 && (
            <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={16} color="#e53935" />
            <Text style={styles.clearButtonText}>기록 초기화</Text>
            </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={history}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
            <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.body}</Text>
            <Text style={styles.itemTime}>
                {new Date(item.time).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                })}
            </Text>
            </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>저장된 알림이 없습니다.</Text>}
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
  item: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
  },
  empty: {
    marginTop: 30,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
    color: '#777',
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
  
});
