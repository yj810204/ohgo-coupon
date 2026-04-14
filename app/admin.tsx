import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, getDocs, getDoc, getCountFromServer, doc, query, where, limit } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
const MEMBERS_CACHE_KEY = 'cachedMembers';
const CACHE_EXPIRY_TIME = 1000 * 60 * 30; // 30 minutes

export default function AdminScreen() {
  const sectionListRef = useRef<SectionList>(null);
  const [todaySectionIndex, setTodaySectionIndex] = useState<number | null>(null);

  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [todayMembers, setTodayMembers] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'boarding' | 'coupon' | 'inactive'>('all');
  const [inactivePeriod, setInactivePeriod] = useState<3 | 6 | 12>(6); // 3개월, 6개월, 12개월
  const [filterSectionExpanded, setFilterSectionExpanded] = useState(false); // 필터 영역 펼침/접기
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsLoadingProgress, setStatsLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const statsLoadedRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);
  const lastLoadedAtRef = useRef<number>(0);
  const cacheUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (statsLoadingProgress) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingOpacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
          Animated.timing(loadingOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      loadingOpacity.setValue(1);
    }
  }, [statsLoadingProgress]);

  const saveMembersToCache = useCallback(
    async (
      membersToCache: any[],
      todayMembersToCache: any[],
      sectionsToCache: any[],
      options?: { silent?: boolean; timestampOverride?: number }
    ) => {
      try {
        const cacheData = {
          timestamp: options?.timestampOverride ?? Date.now(),
          members: membersToCache,
          todayMembers: todayMembersToCache,
          sections: sectionsToCache,
        };
        await AsyncStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(cacheData));
        if (!options?.silent) {
          console.log('✅ Member data cached');
        }
      } catch (error) {
        console.error('❌ Error caching member data:', error);
      }
    },
    []
  );

  // Helper function to get days from months
  const getDaysFromMonths = (months: number) => months * 30;

  // 검색 상태 복원 함수
  const restoreSearchState = useCallback(() => {
    if (allMembers.length === 0) return;
    
    const currentKeyword = keyword;
    const currentFilter = activeFilter;
    
    // 검색어가 있으면 검색 결과 복원
    if (currentKeyword.trim().length > 0) {
      let filtered = allMembers.filter((m) =>
        m.name.toLowerCase().includes(currentKeyword.toLowerCase())
      );
      
      // 필터 적용
      if (currentFilter === 'boarding') {
        filtered = filtered.filter(member => member.hasBoarding);
      } else if (currentFilter === 'coupon') {
        filtered = filtered.filter(member => member.couponCount > 0);
      } else if (currentFilter === 'inactive') {
        const today = new Date();
        const inactiveDays = getDaysFromMonths(inactivePeriod);
        filtered = filtered.filter(member => {
          if (!member.lastStampTime?.seconds) return true;
          const lastStampDate = new Date(member.lastStampTime.seconds * 1000);
          const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff >= inactiveDays;
        });
      }
      
      setSections(groupByInitial(filtered));
    } else if (currentFilter !== 'all') {
      // 필터만 적용된 경우 필터 결과 복원
      let filtered = allMembers.filter((m) => true);
      
      if (currentFilter === 'boarding') {
        filtered = filtered.filter(member => member.hasBoarding);
      } else if (currentFilter === 'coupon') {
        filtered = filtered.filter(member => member.couponCount > 0);
      } else if (currentFilter === 'inactive') {
        const today = new Date();
        const inactiveDays = getDaysFromMonths(inactivePeriod);
        filtered = filtered.filter(member => {
          if (!member.lastStampTime?.seconds) return true;
          const lastStampDate = new Date(member.lastStampTime.seconds * 1000);
          const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff >= inactiveDays;
        });
      }
      
      setSections(groupByInitial(filtered));
    }
  }, [allMembers, keyword, activeFilter, inactivePeriod]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) {
        if (Date.now() - lastLoadedAtRef.current > CACHE_EXPIRY_TIME) {
          fetchMembers(true).then(() => {
            restoreSearchState();
          });
        } else {
          restoreSearchState();
        }
      } else {
        fetchMembers().then(() => {
          if (keyword.trim().length > 0 || activeFilter !== 'all') {
            restoreSearchState();
          }
        });
      }
    }, [restoreSearchState])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // Force refresh from server by passing true
    await fetchMembers(true);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMembers();
    restoreCollapsedState();
  }, []);

  useEffect(() => {
    if (cacheUpdateTimeoutRef.current) {
      clearTimeout(cacheUpdateTimeoutRef.current);
      cacheUpdateTimeoutRef.current = null;
    }

    if (allMembers.length === 0) return;

    cacheUpdateTimeoutRef.current = setTimeout(() => {
      cacheUpdateTimeoutRef.current = null;
      saveMembersToCache(allMembers, todayMembers, sections, { silent: true });
      lastLoadedAtRef.current = Date.now();
    }, 300);

    return () => {
      if (cacheUpdateTimeoutRef.current) {
        clearTimeout(cacheUpdateTimeoutRef.current);
        cacheUpdateTimeoutRef.current = null;
      }
    };
  }, [allMembers, todayMembers, sections, saveMembersToCache]);

  // allMembers가 로드되고 검색 상태가 있으면 복원 (useFocusEffect에서 처리하지 못한 경우 대비)
  useEffect(() => {
    if (allMembers.length > 0 && (keyword.trim().length > 0 || activeFilter !== 'all')) {
      // 약간의 지연을 두어 useFocusEffect와의 충돌 방지
      const timer = setTimeout(() => {
        restoreSearchState();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [allMembers.length, restoreSearchState]);

  // allMembers가 변경될 때마다 sections 업데이트 (검색 중이 아닐 때만)
  useEffect(() => {
    if (allMembers.length === 0) return;
    // 검색 중이면 sections 업데이트하지 않음 (검색 결과 유지)
    if (keyword.trim().length > 0) return;

    const todayKST = new Date();
    todayKST.setHours(todayKST.getHours() + 9);
    const todayDateStr = todayKST.toISOString().split('T')[0];

    const joinedToday = allMembers.filter(user =>
      user.createdAt && toKSTDateStr(user.createdAt) === todayDateStr
    );

    const stampedToday = allMembers.filter(user => {
      if (!user.lastStampTime?.seconds) return false;
      const kst = new Date(user.lastStampTime.seconds * 1000);
      kst.setHours(kst.getHours() + 9);
      const stampDate = kst.toISOString().split('T')[0];
      return stampDate === todayDateStr;
    });

    const grouped = groupByInitial(
      allMembers.filter(
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
    setTodayMembers(joinedToday);
  }, [allMembers, keyword]);

  // UTC ISO string → KST YYYY-MM-DD 변환
  function toKSTDateStr(utcString: string): string {
    const date = new Date(utcString);
    date.setHours(date.getHours() + 9);
    return date.toISOString().split('T')[0];
  }

  const fetchMembers = async (forceRefresh = false) => {
    // Try to load from cache if not forcing refresh
    if (!forceRefresh) {
      try {
        const cachedData = await AsyncStorage.getItem(MEMBERS_CACHE_KEY);
        if (cachedData) {
          const { timestamp, members, todayMembers: cachedTodayMembers, sections: cachedSections } = JSON.parse(cachedData);
          
          // Check if cache is still valid (not expired)
          if (Date.now() - timestamp < CACHE_EXPIRY_TIME) {
            console.log('✅ Using cached member data');
            setAllMembers(members);
            setTodayMembers(cachedTodayMembers);
            setSections(cachedSections);
            hasLoadedRef.current = true;
            lastLoadedAtRef.current = timestamp ?? Date.now();
            setIsLoading(false);
            // Load stats in background if missing
            if (members.some((m: any) => m.couponCount === undefined)) {
              loadStatsInBackground(members.map((m: any) => m.uuid));
            }
            return;
          }
        }
      } catch (error) {
        console.error('❗ Error loading cached members:', error);
      }
    }
    
    setIsLoading(true);
    // Step 1: Fetch basic user info first (fast)
    console.log('📥 Loading basic member info...');
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        uuid: data.uuid,
        name: data.name,
        dob: data.dob,
        createdAt: data.createdAt,
        lastStampTime: data.lastStampTime,
        gender: undefined as string | undefined,
        tripCount: data.tripCount ?? 0,
        couponCount: undefined as number | undefined,
        halfCouponCount: undefined as number | undefined,
        fullCouponCount: undefined as number | undefined,
        stampCount: undefined as number | undefined,
        hasMemo: undefined as boolean | undefined,
        hasBoarding: undefined as boolean | undefined,
      };
    });

    // Immediately show basic info
    const todayKST = new Date();
    todayKST.setHours(todayKST.getHours() + 9);
    const todayDateStr = todayKST.toISOString().split('T')[0];

    const joinedToday = users.filter(user =>
      user.createdAt && toKSTDateStr(user.createdAt) === todayDateStr
    );

    const stampedToday = users.filter(user => {
      if (!user.lastStampTime?.seconds) return false;
      const kst = new Date(user.lastStampTime.seconds * 1000);
      kst.setHours(kst.getHours() + 9);
      const stampDate = kst.toISOString().split('T')[0];
      return stampDate === todayDateStr;
    });

    const grouped = groupByInitial(
      users.filter(
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
    // 먼저 allMembers를 설정하여 검색이 즉시 가능하도록 함
    setAllMembers(users);
    setTodayMembers(joinedToday);
    setSections(fullSections);
    if (todaySections.length > 0) setTodaySectionIndex(0);
    else setTodaySectionIndex(null);
    
    // 로딩 상태를 false로 설정하여 검색 UI 활성화
    setIsLoading(false);
    hasLoadedRef.current = true;
    lastLoadedAtRef.current = Date.now();
    console.log('✅ Basic member info loaded, starting stats loading...');

    // Step 2: Load stats in background (batch processing for better performance)
    loadStatsInBackground(users.map(u => u.uuid));
  };

  const loadStatsInBackground = async (uuids: string[]) => {
    statsLoadedRef.current.clear();

    const uniqueUuids = [...new Set(uuids.filter(uuid => uuid && typeof uuid === 'string'))];
    const totalCount = uniqueUuids.length;

    if (totalCount === 0) {
      setStatsLoadingProgress(null);
      return;
    }

    setStatsLoadingProgress({ loaded: 0, total: totalCount });

    const BATCH_SIZE = 25;
    const BATCH_DELAY = 50;

    let loadedCount = 0;

    for (let i = 0; i < uniqueUuids.length; i += BATCH_SIZE) {
      const batch = uniqueUuids.slice(i, i + BATCH_SIZE);
      const batchResults: { uuid: string; stats: any }[] = [];

      const batchPromises = batch.map((uuid) => {
        if (statsLoadedRef.current.has(uuid)) {
          loadedCount++;
          return Promise.resolve();
        }

        return (async () => {
          try {
            const couponsRef = collection(db, `users/${uuid}/coupons`);
            const activeCouponsQuery = query(couponsRef, where('used', '==', false));

            const [activeCouponsSnap, stampCountSnap, memoSnap, boardingInfoDoc] = await Promise.all([
              getDocs(activeCouponsQuery),
              getCountFromServer(collection(db, `users/${uuid}/stamps`)),
              getDocs(query(collection(db, `users/${uuid}/memo`), limit(10))),
              getDoc(doc(db, `users/${uuid}/boarding/info`)),
            ]);

            const halfCouponCount = activeCouponsSnap.docs.filter((d: any) => d.data().isHalf === 'Y').length;
            const fullCouponCount = activeCouponsSnap.docs.length - halfCouponCount;
            const hasMemo = memoSnap.docs.some((d: any) => !d.data().deleted);
            const hasBoarding = boardingInfoDoc.exists();
            const gender = boardingInfoDoc.exists() ? (boardingInfoDoc.data()?.gender || null) : null;

            statsLoadedRef.current.add(uuid);
            loadedCount++;

            batchResults.push({
              uuid,
              stats: {
                couponCount: activeCouponsSnap.docs.length,
                halfCouponCount,
                fullCouponCount,
                stampCount: stampCountSnap.data().count,
                hasMemo,
                hasBoarding,
                gender,
              },
            });
          } catch (error) {
            console.error(`❗ Error loading stats for ${uuid}:`, error);
            loadedCount++;
          }
        })();
      });

      await Promise.all(batchPromises);

      if (batchResults.length > 0) {
        const statsMap = new Map(batchResults.map(r => [r.uuid, r.stats]));
        setAllMembers(prev =>
          prev.map(member => {
            const stats = statsMap.get(member.uuid);
            return stats ? { ...member, ...stats } : member;
          })
        );
      }

      setStatsLoadingProgress({ loaded: loadedCount, total: totalCount });

      if (i + BATCH_SIZE < uniqueUuids.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    setStatsLoadingProgress(null);
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
    // allMembers가 비어있어도 검색이 가능하도록 처리
    if (allMembers.length === 0) {
      setSections([]);
      return;
    }
    
    // 검색어가 비어있으면 useEffect에서 전체 리스트로 복원되도록 함
    if (text.trim().length === 0) {
      // useEffect가 실행되도록 keyword만 업데이트하고 sections는 useEffect에서 처리
      return;
    }
    
    let filtered = allMembers.filter((m) =>
      m.name.toLowerCase().includes(text.toLowerCase())
    );
    
    // Apply additional filters based on activeFilter
    if (activeFilter === 'boarding') {
      filtered = filtered.filter(member => member.hasBoarding);
    } else if (activeFilter === 'coupon') {
      filtered = filtered.filter(member => member.couponCount > 0);
    } else if (activeFilter === 'inactive') {
      const today = new Date();
      const inactiveDays = getDaysFromMonths(inactivePeriod);
      filtered = filtered.filter(member => {
        if (!member.lastStampTime?.seconds) return true; // 스탬프 기록이 없으면 포함
        const lastStampDate = new Date(member.lastStampTime.seconds * 1000);
        const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= inactiveDays;
      });
    }
    
    setSections(groupByInitial(filtered));
  };
  
  const applyFilter = (filterType: 'all' | 'boarding' | 'coupon' | 'inactive') => {
    setActiveFilter(filterType);
    
    let filtered = allMembers.filter((m) =>
      m.name.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (filterType === 'boarding') {
      filtered = filtered.filter(member => member.hasBoarding);
    } else if (filterType === 'coupon') {
      filtered = filtered.filter(member => member.couponCount > 0);
          } else if (filterType === 'inactive') {
        const today = new Date();
        const inactiveDays = getDaysFromMonths(inactivePeriod);
        filtered = filtered.filter(member => {
          if (!member.lastStampTime?.seconds) return true; // 스탬프 기록이 없으면 포함
          const lastStampDate = new Date(member.lastStampTime.seconds * 1000);
          const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff >= inactiveDays;
        });
      }
    
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

  // Memoize filter counts to avoid recalculating on every render
  const filterCounts = useMemo(() => {
    const today = new Date();
    const inactiveDays = getDaysFromMonths(inactivePeriod);
    return {
      boarding: allMembers.filter(member => member.hasBoarding).length,
      coupon: allMembers.filter(member => member.couponCount > 0).length,
      inactive: allMembers.filter(member => {
        if (!member.lastStampTime?.seconds) return true;
        const lastStampDate = new Date(member.lastStampTime.seconds * 1000);
        const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= inactiveDays;
      }).length,
    };
  }, [allMembers, inactivePeriod]);

  return (
    <View style={styles.container}>
      <View style={styles.cardBox}>
        <TouchableOpacity
          onPress={() => setFilterSectionExpanded(!filterSectionExpanded)}
          style={styles.titleContainer}
          activeOpacity={0.7}
        >
          <Text style={styles.title}>
            회원 검색{' '}
            <Text style={{ fontSize: 16, color: '#555', fontFamily: 'System' }}>
              ({sections.reduce((acc, sec) => acc + sec.data.length, 0)})
            </Text>
          </Text>
          <Ionicons
            name={filterSectionExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#1e88e5"
          />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="이름으로 검색"
          value={keyword}
          onChangeText={handleSearch}
        />
        {filterSectionExpanded && (
          <>
            <View style={styles.statsContainer}>
              <TouchableOpacity 
                onPress={() => applyFilter(activeFilter === 'boarding' ? 'all' : 'boarding')}
                style={[
                  styles.statsButton,
                  activeFilter === 'boarding' && styles.activeStatsButton
                ]}
              >
                <Text style={[
                  styles.statsText,
                  activeFilter === 'boarding' && styles.activeStatsText
                ]}>
                  명부: {filterCounts.boarding}명
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => applyFilter(activeFilter === 'coupon' ? 'all' : 'coupon')}
                style={[
                  styles.statsButton,
                  activeFilter === 'coupon' && styles.activeStatsButton
                ]}
              >
                <Text style={[
                  styles.statsText,
                  activeFilter === 'coupon' && styles.activeStatsText
                ]}>
                  쿠폰: {filterCounts.coupon}명
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => applyFilter(activeFilter === 'inactive' ? 'all' : 'inactive')}
                style={[
                  styles.statsButton,
                  activeFilter === 'inactive' && styles.activeStatsButton
                ]}
              >
                <Text style={[
                  styles.statsText,
                  activeFilter === 'inactive' && styles.activeStatsText
                ]}>
                  {inactivePeriod}개월+ 미활동: {filterCounts.inactive}명
                </Text>
              </TouchableOpacity>
            </View>
            {activeFilter === 'inactive' && (
              <View style={styles.periodSelectorContainer}>
                <Text style={styles.periodSelectorLabel}>미활동 기간 선택:</Text>
                <View style={styles.periodSelectorButtons}>
                  <TouchableOpacity
                    onPress={() => setInactivePeriod(3)}
                    style={[
                      styles.periodButton,
                      inactivePeriod === 3 && styles.activePeriodButton
                    ]}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      inactivePeriod === 3 && styles.activePeriodButtonText
                    ]}>
                      3개월
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setInactivePeriod(6)}
                    style={[
                      styles.periodButton,
                      inactivePeriod === 6 && styles.activePeriodButton
                    ]}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      inactivePeriod === 6 && styles.activePeriodButtonText
                    ]}>
                      6개월
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setInactivePeriod(12)}
                    style={[
                      styles.periodButton,
                      inactivePeriod === 12 && styles.activePeriodButton
                    ]}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      inactivePeriod === 12 && styles.activePeriodButtonText
                    ]}>
                      12개월
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <SectionList
        ref={sectionListRef}
        sections={sections.map(section => ({
          ...section,
          collapsed: collapsedSections[section.title] ?? false,
        }))}
        keyExtractor={(item) => item.uuid}
        stickySectionHeadersEnabled={false}
        windowSize={5}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        initialNumToRender={20}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          isLoading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1e88e5" />
              <Text style={styles.loadingText}>회원 목록 불러오는 중...</Text>
            </View>
          ) : null
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

          const statsLoaded = item.stampCount !== undefined;

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
              <View style={styles.memberLeft}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {item.hasMemo && (
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={14}
                      color="#1e88e5"
                      style={styles.memoIcon}
                    />
                  )}
                  {!statsLoaded && (
                    <Animated.Text style={[styles.loadingHint, { opacity: loadingOpacity }]}>
                      로딩중...
                    </Animated.Text>
                  )}
                </View>
                <View style={styles.badgeRow}>
                  {item.tripCount > 0 && (
                    <View style={styles.badgeItem}>
                      <Text style={styles.badgeLabel}>승선</Text>
                      <View style={styles.tripBadge}>
                        <Text style={styles.tripBadgeText}>{item.tripCount}</Text>
                      </View>
                    </View>
                  )}
                  {statsLoaded && item.stampCount > 0 && (
                    <View style={styles.badgeItem}>
                      <Text style={styles.badgeLabel}>스탬프</Text>
                      <View style={styles.stampBadge}>
                        <Text style={styles.stampBadgeText}>{item.stampCount}</Text>
                      </View>
                    </View>
                  )}
                  {statsLoaded && (item.halfCouponCount ?? 0) > 0 && (
                    <View style={styles.badgeItem}>
                      <Text style={styles.badgeLabel}>쿠폰(50%)</Text>
                      <View style={styles.couponBadge}>
                        <Text style={styles.couponBadgeText}>{item.halfCouponCount}</Text>
                      </View>
                    </View>
                  )}
                  {statsLoaded && (item.fullCouponCount ?? 0) > 0 && (
                    <View style={styles.badgeItem}>
                      <Text style={styles.badgeLabel}>쿠폰</Text>
                      <View style={styles.couponBadge}>
                        <Text style={styles.couponBadgeText}>{item.fullCouponCount}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.memberRight}>
                <View style={styles.dobGenderRow}>
                  <Text style={styles.memberDob}>
                    {item.dob?.length === 8 
                      ? `${item.dob.slice(2, 4)}-${item.dob.slice(4, 6)}-${item.dob.slice(6, 8)}` 
                      : item.dob}
                  </Text>
                  {item.gender !== undefined ? (
                    item.gender ? (
                      <View style={styles.genderBadge}>
                        <Text style={styles.genderBadgeText}>{item.gender}</Text>
                      </View>
                    ) : (
                      <View style={styles.noBoardingBadge}>
                        <Text style={styles.noBoardingBadgeText}>✕</Text>
                      </View>
                    )
                  ) : null}
                </View>
                <Text style={styles.memberCreatedAt}>
                  {toKSTDateStr(item.createdAt).slice(2)}
                </Text>
                {item.lastStampTime?.seconds && (() => {
                  const lastStampDate = new Date(item.lastStampTime.seconds * 1000);
                  const today = new Date();
                  const daysDiff = Math.floor((today.getTime() - lastStampDate.getTime()) / (1000 * 60 * 60 * 24));
                  const inactiveDays = getDaysFromMonths(inactivePeriod);
                  const isInactive = daysDiff >= inactiveDays;
                  return (
                    <Text 
                      style={[styles.memberLastLogin, isInactive && styles.memberLastLoginInactive]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      최근: {toKSTDateStr(new Date(item.lastStampTime.seconds * 1000).toISOString()).slice(2)}
                      {isInactive && ` (${inactivePeriod}개월+)`}
                    </Text>
                  );
                })()}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>일치하는 회원이 없습니다.</Text>
        }
      />
      {statsLoadingProgress && (
        <View style={styles.floatingProgressContainer}>
          <View style={styles.floatingProgressBarBg}>
            <View 
              style={[
                styles.floatingProgressBarFill,
                { width: `${Math.round((statsLoadingProgress.loaded / statsLoadingProgress.total) * 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.floatingProgressText}>
            상세정보 {Math.round((statsLoadingProgress.loaded / statsLoadingProgress.total) * 100)}% 로딩중
          </Text>
        </View>
      )}
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
  statsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statsButton: {
    padding: 6,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  activeStatsButton: {
    backgroundColor: '#e3f2fd',
  },
  statsText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#555',
  },
  activeStatsText: {
    color: '#1565c0',
    fontFamily: 'GiantRegular',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 1,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  memberLeft: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  memberRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 95,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dobGenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingHint: {
    fontSize: 11,
    fontFamily: 'GiantRegular',
    color: '#b0c4de',
    marginLeft: 6,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  memberDob: {
    fontSize: 15,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  memberCreatedAt: {
    fontSize: 11,
    fontFamily: 'GiantRegular',
    color: '#999',
    marginTop: 2,
  },
  memberLastLogin: {
    fontSize: 10,
    fontFamily: 'GiantRegular',
    color: '#bbb',
    marginTop: 2,
    textAlign: 'right',
    maxWidth: 120,
  },
  memberLastLoginInactive: {
    color: '#ff9800',
    fontFamily: 'GiantRegular',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    fontFamily: 'GiantRegular',
    marginTop: 30,
  },
  badgeLabel: {
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginRight: 2,
  },
  couponBadge: {
    backgroundColor: '#FFEB3B',
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponBadgeText: {
    fontSize: 11,
    fontFamily: 'GiantRegular',
    color: '#b07000'
  },
  stampBadge: {
    backgroundColor: '#eee',
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampBadgeText: {
    color: '#999',
    fontSize: 11,
    fontFamily: 'GiantRegular'
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
  memoIcon: {
    marginLeft: 4,
    marginBottom: 2
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  
  genderBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
    marginStart: 4,
  },
  genderBadgeText: {
    fontSize: 11,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  noBoardingBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 20,
    alignItems: 'center',
    marginStart: 4,
  },
      noBoardingBadgeText: {
      fontSize: 12,
      fontFamily: 'GiantRegular',
      color: '#fff'
    },
    tripBadge: {
      backgroundColor: '#2196F3',
      minWidth: 20,
      height: 20,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tripBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontFamily: 'GiantRegular'
    },
    floatingProgressContainer: {
      position: 'absolute',
      bottom: 12,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(255,255,255,0.95)',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: -2 },
    },
    floatingProgressBarBg: {
      height: 4,
      backgroundColor: '#e8eef5',
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 4,
    },
    floatingProgressBarFill: {
      height: '100%',
      backgroundColor: '#90caf9',
      borderRadius: 2,
    },
    floatingProgressText: {
      fontSize: 11,
      fontFamily: 'GiantRegular',
      color: '#888',
      textAlign: 'center',
    },
    periodSelectorContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
    },
    periodSelectorLabel: {
      fontSize: 13,
      fontFamily: 'GiantRegular',
      color: '#666',
      marginBottom: 8,
    },
    periodSelectorButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: '#f5f5f5',
      borderWidth: 1,
      borderColor: '#e0e0e0',
      alignItems: 'center',
      marginRight: 8,
    },
    activePeriodButton: {
      backgroundColor: '#e3f2fd',
      borderColor: '#1e88e5',
    },
    periodButtonText: {
      fontSize: 13,
      fontFamily: 'GiantRegular',
      color: '#666',
    },
    activePeriodButtonText: {
      color: '#1565c0',
      fontFamily: 'GiantRegular',
    },
  });
