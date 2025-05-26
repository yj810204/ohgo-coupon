import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../firebase';

const STORAGE_KEY = 'collapsedSections';

export default function AdminScreen() {
  useFocusEffect(
    useCallback(() => {
      fetchMembers(); // ✅ 리스트 새로고침
    }, [])
  );
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMembers();
    restoreCollapsedState();
  }, []);

  const fetchMembers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setAllMembers(list);
    const grouped = groupByInitial(list);
    setSections(grouped);
  };

  const groupByInitial = (users: any[]) => {
    const grouped: { [key: string]: any[] } = {};

    users.forEach((user) => {
      const initial = user.name?.charAt(0) || '#';
      if (!grouped[initial]) grouped[initial] = [];
      grouped[initial].push(user);
    });

    return Object.keys(grouped)
      .sort()
      .map((initial) => ({
        title: initial,
        data: grouped[initial].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  };

  const handleSearch = (text: string) => {
    setKeyword(text);
    const filtered = allMembers.filter((m) =>
      m.name.toLowerCase().includes(text.toLowerCase())
    );
    setSections(groupByInitial(filtered));
  };

  const toggleSection = async (title: string) => {
    const updated = {
      ...collapsedSections,
      [title]: !collapsedSections[title],
    };
    setCollapsedSections(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const restoreCollapsedState = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        setCollapsedSections(JSON.parse(json));
      }
    } catch (err) {
      console.error('❗ 섹션 접힘 상태 복원 실패:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        <Text style={styles.title}>회원 검색</Text>
        <TextInput
          style={styles.input}
          placeholder="이름으로 검색"
          value={keyword}
          onChangeText={handleSearch}
        />
      </View>

      <SectionList
        sections={sections.map(section => ({
          ...section,
          collapsed: collapsedSections[section.title] ?? false,
        }))}
        keyExtractor={(item) => item.uuid}
        stickySectionHeadersEnabled={false}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={styles.sectionHeader}
            activeOpacity={0.7}
            onPress={() => toggleSection(section.title)}
          >
            <Ionicons
              name={section.collapsed ? 'chevron-down' : 'chevron-up'}
              size={16}
              color="#333"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>({section.data.length})</Text>
          </TouchableOpacity>
        )}
        renderItem={({ item, section }) => {
          if (section.collapsed) return null;

          return (
            <TouchableOpacity
              style={styles.memberRow}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/member-detail',
                  params: {
                    uuid: item.uuid,
                    name: item.name,
                    dob: item.dob,
                  },
                })
              }
            >
              <Text style={styles.memberName}>{item.name}</Text>
              <Text style={styles.memberDob}>{item.dob}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>일치하는 회원이 없습니다.</Text>
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
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: 'GiantRegular',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#1565c0',
  },
  sectionCount: {
    fontSize: 14,
    marginLeft: 6,
    color: '#555',
  },
  memberRow: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginLeft: 1,
    marginRight: 1,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  memberName: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  memberDob: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#888',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    fontFamily: 'GiantRegular',
    marginTop: 30,
  },
});
