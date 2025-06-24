import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import {
  addMemo,
  getMemos,
  softDeleteMemo,
  updateMemo,
} from '@/utils/memo-service';

export default function MemoScreen() {
  const { uuid, name } = useLocalSearchParams();
  const [memoList, setMemoList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newMemo, setNewMemo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const loadMemos = async () => {
    const memos = await getMemos(String(uuid));
    setMemoList(memos);
  };

  useEffect(() => {
    loadMemos();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemos();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (!newMemo.trim()) return;
    await addMemo(String(uuid), newMemo.trim());
    setNewMemo('');
    Keyboard.dismiss();
    await loadMemos();
  };

  const handleUpdate = async () => {
    if (!editingText.trim()) return;
    await updateMemo(String(uuid), String(editingId), editingText.trim());
    setEditingId(null);
    setEditingText('');
    setModalVisible(false);
    await loadMemos();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('메모 삭제', '해당 메모를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await softDeleteMemo(String(uuid), id);
          await loadMemos();
        },
      },
    ]);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 80, flexGrow: 1 }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{name}님의 관리자 메모</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="새 메모 입력..."
          value={newMemo}
          onChangeText={setNewMemo}
          multiline
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addText}>메모 추가</Text>
        </TouchableOpacity>

        {memoList.map(item => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemBody}>{item.content}</Text>
            <Text style={styles.itemTime}>{format(item.createdAt?.toDate?.() || new Date(), 'yyyy-MM-dd HH:mm:ss')}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => {
                  setEditingId(item.id);
                  setEditingText(item.content);
                  setModalVisible(true);
                }}
              >
                <Text style={styles.actionText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={[styles.actionText, { color: '#e53935' }]}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {memoList.length === 0 && (
          <Text style={styles.empty}>📝 등록된 메모가 없습니다.</Text>
        )}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>메모 수정</Text>
              <TextInput
                style={styles.editInput}
                multiline
                value={editingText}
                onChangeText={setEditingText}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdate} style={styles.saveBtn}>
                  <Text style={styles.saveText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </TouchableWithoutFeedback>
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
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    fontFamily: 'GiantRegular',
  },
  addBtn: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addText: {
    color: '#fff',
    fontSize: 16,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  actionText: {
    fontFamily: 'GiantRegular',
    color: '#007AFF',
  },
  empty: {
    marginTop: 30,
    textAlign: 'center',
    fontFamily: 'GiantRegular',
    color: '#777',
  },
  editInput: {
    borderColor: '#ddd',
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontFamily: 'GiantRegular',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveText: {
    color: '#fff',
    fontFamily: 'GiantRegular',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 10,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  cancelText: {
    fontFamily: 'GiantRegular',
    fontSize: 15,
  },
});