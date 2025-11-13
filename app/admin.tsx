import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, getDocs, getDoc, doc, query, where, limit } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      uuid: doc.data().uuid,
      name: doc.data().name,
      dob: doc.data().dob,
      createdAt: doc.data().createdAt,
              lastStampTime: doc.data().lastStampTime,
        gender: undefined as string | undefined, // Will be loaded from boarding/info
        // Initialize stats as undefined to show loading state
        tripCount: undefined as number | undefined, // 승선 횟수 (users 문서에서 직접 가져옴)
        couponCount: undefined as number | undefined,
        halfCouponCount: undefined as number | undefined, // 50% 쿠폰 개수
        fullCouponCount: undefined as number | undefined, // 100% 쿠폰 개수
        stampCount: undefined as number | undefined,
        hasMemo: undefined as boolean | undefined,
        hasBoarding: undefined as boolean | undefined,
      }));

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

  // Load stats in batches to avoid overwhelming Firebase with too many concurrent requests
  const loadStatsInBackground = async (uuids: string[]) => {
    statsLoadedRef.current.clear();
    
    // Remove duplicates and filter out invalid uuids
    const uniqueUuids = [...new Set(uuids.filter(uuid => uuid && typeof uuid === 'string'))];
    const totalCount = uniqueUuids.length;
    
    if (totalCount === 0) {
      setStatsLoadingProgress(null);
      return;
    }
    
    setStatsLoadingProgress({ loaded: 0, total: totalCount });
    
    const BATCH_SIZE = 15; // Process 15 members at a time
    const BATCH_DELAY = 100; // 100ms delay between batches
    
    let loadedCount = 0;
    
    // Process uuids in batches
    for (let i = 0; i < uniqueUuids.length; i += BATCH_SIZE) {
      const batch = uniqueUuids.slice(i, i + BATCH_SIZE);
      
      // Process each batch in parallel
      const batchPromises = batch.map((uuid) => {
        // Skip if already loaded or loading
        if (statsLoadedRef.current.has(uuid)) {
          loadedCount++;
          setStatsLoadingProgress({ loaded: loadedCount, total: totalCount });
          return Promise.resolve();
        }
        
        return (async () => {
          try {
            const [couponsRef, stampsRef, memoRef, boardingRef, userDoc] = await Promise.all([
              getDocs(collection(db, `users/${uuid}/coupons`)),
              getDocs(collection(db, `users/${uuid}/stamps`)),
              getDocs(collection(db, `users/${uuid}/memo`)),
              getDocs(collection(db, `users/${uuid}/boarding`)),
              getDoc(doc(db, 'users', uuid)),
            ]);
            
            const activeCoupons = couponsRef.docs.filter((couponDoc: any) => !couponDoc.data().used);
            // 50% 쿠폰과 100% 쿠폰 구분
            const halfCoupons = activeCoupons.filter((couponDoc: any) => couponDoc.data().isHalf === 'Y');
            const fullCoupons = activeCoupons.filter((couponDoc: any) => couponDoc.data().isHalf !== 'Y');
            const halfCouponCount = halfCoupons.length;
            const fullCouponCount = fullCoupons.length;
            const hasMemo = memoRef.docs.some((memoDoc: any) => !memoDoc.data().deleted);
            const boardingInfoDoc = boardingRef.docs.find((boardingDoc: any) => boardingDoc.id === 'info');
            const hasBoarding = !!boardingInfoDoc;
            // 성별 정보가 없으면 null로 명시적으로 설정 (undefined는 로딩 중으로 간주)
            const gender = boardingInfoDoc?.data()?.gender || null;
            const tripCount = userDoc.exists() ? (userDoc.data().tripCount !== undefined ? userDoc.data().tripCount : 0) : 0;
            
            statsLoadedRef.current.add(uuid);
            loadedCount++;
            
            // Progress update
            setStatsLoadingProgress({ loaded: loadedCount, total: totalCount });
            
            // 해당 회원의 정보가 로드되면 즉시 해당 회원만 업데이트 (점진적 업데이트)
            setAllMembers(prev => {
              return prev.map(member => {
                if (member.uuid === uuid) {
                  return {
                    ...member,
                    couponCount: activeCoupons.length,
                    halfCouponCount,
                    fullCouponCount,
                    stampCount: stampsRef.docs.length,
                    hasMemo,
                    hasBoarding,
                    gender,
                    tripCount,
                  };
                }
                return member;
              });
            });
          } catch (error) {
            console.error(`❗ Error loading stats for ${uuid}:`, error);
            // Update progress even on error
            loadedCount++;
            setStatsLoadingProgress({ loaded: loadedCount, total: totalCount });
          }
        })();
      });
      
      // Wait for current batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid overwhelming Firebase
      if (i + BATCH_SIZE < uniqueUuids.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    // Hide progress bar when done
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
        contentContainerStyle={statsLoadingProgress ? { paddingBottom: 80 } : undefined}
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
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {item.hasMemo && (
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color="#1e88e5"
                      style={styles.memoIcon}
                    />
                  )}
                </View>
                <View style={{ flexDirection: 'column', marginTop: 4 }}>
                  {item.stampCount !== undefined ? (
                    item.stampCount > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.badgeLabel}>스탬프</Text>
                        <View style={styles.stampBadge}>
                          <Text style={styles.stampBadgeText}>{item.stampCount}</Text>
                        </View>
                      </View>
                    )
                  ) : (
                    <View style={styles.loadingBadge}>
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  )}
                  {item.halfCouponCount !== undefined && item.fullCouponCount !== undefined ? (
                    (item.halfCouponCount > 0 || item.fullCouponCount > 0) && (
                      <>
                        {item.halfCouponCount > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.badgeLabel}>쿠폰(50%)</Text>
                            <View style={styles.couponBadge}>
                              <Text style={styles.couponBadgeText}>{item.halfCouponCount}</Text>
                            </View>
                          </View>
                        )}
                        {item.fullCouponCount > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.badgeLabel}>쿠폰</Text>
                            <View style={styles.couponBadge}>
                              <Text style={styles.couponBadgeText}>{item.fullCouponCount}</Text>
                            </View>
                          </View>
                        )}
                      </>
                    )
                  ) : (
                    item.stampCount === undefined && (
                      <View style={styles.loadingBadge}>
                        <ActivityIndicator size="small" color="#999" />
                      </View>
                    )
                  )}
                  {item.tripCount !== undefined ? (
                    item.tripCount > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.badgeLabel}>승선</Text>
                        <View style={styles.tripBadge}>
                          <Text style={styles.tripBadgeText}>{item.tripCount}</Text>
                        </View>
                      </View>
                    )
                  ) : (
                    <View style={styles.loadingBadge}>
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', minWidth: 100 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Text style={styles.memberDob}>
                    {item.dob?.length === 8 
                      ? `${item.dob.slice(2, 4)}-${item.dob.slice(4, 6)}-${item.dob.slice(6, 8)}` 
                      : item.dob}
                  </Text>
                  {item.gender === undefined ? (
                    <View style={styles.loadingBadge}>
                      <ActivityIndicator size="small" color="#999" />
                    </View>
                  ) : item.gender ? (
                    <View style={styles.genderBadge}>
                      <Text style={styles.genderBadgeText}>{item.gender}</Text>
                    </View>
                  ) : (
                    <View style={styles.noBoardingBadge}>
                      <Text style={styles.noBoardingBadgeText}>✕</Text>
                    </View>
                  )}
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
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      최근 스탬프: {toKSTDateStr(new Date(item.lastStampTime.seconds * 1000).toISOString()).slice(2)}
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
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill,
                { width: `${(statsLoadingProgress.loaded / statsLoadingProgress.total) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressBarText}>
            {statsLoadingProgress.loaded}명 로딩 중... ({statsLoadingProgress.total}명 중)
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
    fontSize: 12,
    fontFamily: 'GiantRegular',
    color: '#999',
    marginTop: 0,
  },
  memberLastLogin: {
    fontSize: 9,
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
  loadingBadge: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginStart: 4,
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
    progressBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: -2 },
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: '#e0e0e0',
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#1e88e5',
      borderRadius: 3,
    },
    progressBarText: {
      fontSize: 12,
      fontFamily: 'GiantRegular',
      color: '#666',
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
