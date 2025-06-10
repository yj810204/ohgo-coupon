import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const sectionListRef = useRef<SectionList>(null);
  const [todaySectionIndex, setTodaySectionIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [])
  );

  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [todayMembers, setTodayMembers] = useState<any[]>([]);
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
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      uuid: doc.data().uuid,
      createdAt: doc.data().createdAt,
      lastStampTime: doc.data().lastStampTime,
      ...doc.data(),
    }));

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const couponsRef = collection(db, `users/${user.uuid}/coupons`);
        const couponSnap = await getDocs(couponsRef);
        const activeCoupons = couponSnap.docs.filter(doc => !doc.data().used);

        const stampsRef = collection(db, `users/${user.uuid}/stamps`);
        const stampSnap = await getDocs(stampsRef);
        const validStamps = stampSnap.docs;

        return {
          ...user,
          couponCount: activeCoupons.length,
          stampCount: validStamps.length,
        };
      })
    );

    const today = new Date().toISOString().split('T')[0];

    const joinedToday = usersWithStats.filter(user =>
      user.createdAt?.startsWith(today)
    );

    const todayKST = new Date();
    todayKST.setHours(todayKST.getHours() + 9); // UTC → KST 변환
    const todayDateStr = todayKST.toISOString().split('T')[0];

    const stampedToday = usersWithStats.filter(user => {
      if (!user.lastStampTime?.seconds) return false;

      const kst = new Date(user.lastStampTime.seconds * 1000);
      kst.setHours(kst.getHours() + 9); // UTC → KST 보정

      const stampDate = kst.toISOString().split('T')[0];
      return stampDate === todayDateStr;
    });

    const grouped = groupByInitial(
      usersWithStats.filter(
        user => !joinedToday.includes(user) && !stampedToday.includes(user)
      )
    );

    const todaySections = [];
    if (joinedToday.length > 0) {
      todaySections.push({
        title: '오늘 가입한 회원',
        data: joinedToday,
      });
    }
    if (stampedToday.length > 0) {
      todaySections.push({
        title: '오늘 스탬프 적립',
        data: stampedToday,
      });
    }

    const fullSections = [...todaySections, ...grouped];
    setSections(fullSections);
    setAllMembers(usersWithStats);
    setTodayMembers(joinedToday);
    if (todaySections.length > 0) setTodaySectionIndex(0);
    else setTodaySectionIndex(null);
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
        <Text style={styles.title}>
          회원 검색{' '}
          <Text style={{ fontSize: 16, color: '#555', fontFamily: 'System' }}>
            ({sections.reduce((acc, sec) => acc + sec.data.length, 0)})
          </Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="이름으로 검색"
          value={keyword}
          onChangeText={handleSearch}
        />
      </View>

      <SectionList
        ref={sectionListRef}
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
            style={[
              styles.sectionHeader,
              section.title === '오늘 가입한 회원' && styles.todaySectionHeader,
              section.title === '오늘 스탬프 적립' && styles.stampTodaySectionHeader,
            ]}
            activeOpacity={0.7}
            onPress={() => toggleSection(section.title)}
          >
            <Ionicons
              name={section.collapsed ? 'chevron-down' : 'chevron-up'}
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.sectionTitle,
              section.title === '오늘 가입한 회원' && styles.todaySectionTitle,
              section.title === '오늘 스탬프 적립' && styles.stampTodaySectionTitle,
            ]}>
              {section.title}
            </Text>
            <Text style={[
              styles.sectionCount,
              section.title === '오늘 가입한 회원' && styles.todaySectionCount,
              section.title === '오늘 스탬프 적립' && styles.stampTodaySectionCount,
            ]}>
              ({section.data.length})
            </Text>
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
              <View>
                <Text style={styles.memberName}>{item.name}</Text>
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  {item.stampCount > 0 && (
                    <View style={styles.stampBadge}>
                      <Text style={styles.stampBadgeText}>스탬프: {item.stampCount}</Text>
                    </View>
                  )}
                  {item.couponCount > 0 && (
                    <View style={styles.couponBadge}>
                      <Text style={styles.couponBadgeText}>쿠폰: {item.couponCount}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ marginTop: 4, alignItems: 'flex-end' }}>
                <Text style={styles.memberDob}>
                  {item.dob?.length === 8 ? `${item.dob.slice(2, 4)}-${item.dob.slice(4, 6)}-${item.dob.slice(6, 8)}` : item.dob}
                </Text>
                <Text style={styles.memberCreatedAt}>가입: {item.createdAt?.split('T')[0].slice(2)}</Text>
              </View>
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
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
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
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
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  memberDob: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  memberCreatedAt: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#999',
    marginTop: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    fontFamily: 'GiantRegular',
    marginTop: 30,
  },
  couponBadge: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  couponBadgeText: {
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: '#b07000',
  },
  stampBadge: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  stampBadgeText: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'GiantRegular',
  },
  todaySectionHeader: {
    backgroundColor: '#f44336', // 진한 붉은색
  },
  todaySectionTitle: {
    color: '#fff',
  },
  todaySectionCount: {
    color: '#fff',
  },
  stampTodaySectionHeader: {
    backgroundColor: '#4CAF50', // 녹색 계열 (원하시면 다른 색으로 바꿔도 됩니다)
  },
  stampTodaySectionTitle: {
    color: '#fff',
  },
  stampTodaySectionCount: {
    color: '#fff',
  },
});
