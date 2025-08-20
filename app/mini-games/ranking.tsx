import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// 메달 이미지 컴포넌트
const MedalIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <View style={[styles.medalContainer, { backgroundColor: '#FFD700' }]}>
        <Text style={styles.medalText}>🥇</Text>
      </View>
    );
  } else if (rank === 2) {
    return (
      <View style={[styles.medalContainer, { backgroundColor: '#C0C0C0' }]}>
        <Text style={styles.medalText}>🥈</Text>
      </View>
    );
  } else if (rank === 3) {
    return (
      <View style={[styles.medalContainer, { backgroundColor: '#CD7F32' }]}>
        <Text style={styles.medalText}>🥉</Text>
      </View>
    );
  } else {
    return (
      <View style={[styles.rankContainer]}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
    );
  }
};

// 사용자 타입 정의
type User = {
  id: string;
  name: string;
  totalPoint: number;
};

// 대회 정보 타입 정의
type Tournament = {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
} | null;

// 물고기 잡은 기록 타입 정의
type FishCatch = {
  id: string;
  fishName: string;
  point: number;
  fishLevel: number;
  extraPoint: number;
  at: Date;
};

// 그룹화된 물고기 기록 타입 정의
type GroupedFishCatch = {
  fishName: string;
  totalPoints: number;
  count: number;
  img?: string; // 물고기 이미지 URL
};

// 이미지 캐싱 함수
const getCachedImage = async (uri: string, fishName: string): Promise<string> => {
  try {
    // 캐시 디렉토리 경로
    const cacheDir = `${FileSystem.cacheDirectory}fish-images/`;
    // 캐시 파일 경로 (물고기 이름으로 저장)
    const cacheFilePath = `${cacheDir}${fishName.replace(/\s+/g, '_')}`;
    
    // 캐시 디렉토리가 없으면 생성
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
    
    // 캐시된 파일이 있는지 확인
    const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
    
    if (fileInfo.exists) {
      // 캐시된 파일이 있으면 해당 경로 반환
      return cacheFilePath;
    } else {
      // 캐시된 파일이 없으면 다운로드 후 캐시
      await FileSystem.downloadAsync(uri, cacheFilePath);
      return cacheFilePath;
    }
  } catch (error) {
    console.error('Image caching error:', error);
    // 에러 발생 시 원본 URI 반환
    return uri;
  }
};

// 이름 중간을 '*'로 마스킹하는 함수
const maskName = (name: string): string => {
  if (!name) return name;
  
  if (name.length === 2) {
    // 이름이 2글자인 경우, 두 번째 글자를 '*'로 대체
    return name.charAt(0) + '*';
  } else if (name.length > 2) {
    // 이름이 3글자 이상인 경우, 첫 글자와 마지막 글자를 제외한 나머지를 '*'로 대체
    const firstChar = name.charAt(0);
    const lastChar = name.charAt(name.length - 1);
    const middleMask = '*'.repeat(name.length - 2);
    
    return firstChar + middleMask + lastChar;
  }
  
  // 이름이 1글자인 경우 그대로 반환
  return name;
};

export default function RankingScreen() {
  const router = useRouter();
  const { uuid, name } = useLocalSearchParams<{
    uuid: string;
    name: string;
  }>();

  const flatListRef = useRef<FlatList>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tournament, setTournament] = useState<Tournament>(null);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false); // 관리자 상태
  
  // 물고기 잡은 기록 모달 관련 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [fishCatches, setFishCatches] = useState<FishCatch[]>([]);
  const [groupedFishCatches, setGroupedFishCatches] = useState<GroupedFishCatch[]>([]);
  const [loadingFishCatches, setLoadingFishCatches] = useState(false);
  const [cachedImages, setCachedImages] = useState<{[key: string]: string}>({}); // 캐시된 이미지 상태

  useEffect(() => {
    fetchRankingData();
  }, []);
  
  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const userInfoString = await SecureStore.getItemAsync('userInfo');
        if (userInfoString) {
          const userInfo = JSON.parse(userInfoString);
          const adminStatus = userInfo.isAdmin === true;
          setIsAdmin(adminStatus);
          console.log('Admin status:', adminStatus);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, []);
  
  // Auto-scroll to user's position when myRank is set
  useEffect(() => {
    if (myRank !== null && !loading && !refreshing && flatListRef.current && users.length > 0) {
      // Add a longer delay to ensure the list is fully rendered and measured
      setTimeout(() => {
        // Make sure the index is valid before scrolling
        const index = myRank - 1;
        if (index >= 0 && index < users.length) {
          try {
            flatListRef.current?.scrollToIndex({
              index: index,
              animated: true,
              viewPosition: 0.5, // Center the item in the visible area
              viewOffset: 0,
            });
            console.log(`Auto-scrolling to user's position: rank ${myRank}, index ${index}`);
          } catch (error) {
            console.warn(`Error during auto-scroll: ${error}`);
            // Fallback: try to scroll to a nearby position
            const safeIndex = Math.min(index, users.length - 1);
            flatListRef.current?.scrollToOffset({ offset: safeIndex * 60, animated: true });
          }
        } else {
          console.warn(`Invalid index for auto-scroll: ${index}, users length: ${users.length}`);
        }
      }, 1000); // Increased delay for better reliability
    }
  }, [myRank, loading, refreshing, users.length]);

  const fetchTournamentData = async () => {
    try {
      const tournamentDoc = await getDoc(doc(db, 'gameSettings', 'tournament'));
      
      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        if (data.title && data.startDate && data.endDate) {
          setTournament({
            title: data.title,
            description: data.description || '',
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
          });
          console.log('Tournament data loaded:', data.title);
        } else {
          console.log('Tournament data incomplete:', data);
          setTournament(null);
        }
      } else {
        console.log('No tournament document exists');
        setTournament(null);
      }
    } catch (error) {
      console.error('대회 정보 가져오기 오류:', error);
      setTournament(null);
    }
  };

  // 랭킹 데이터 가져오는 공통 함수
  const fetchRankingDataCommon = async () => {
    // 포인트 기준으로 내림차순 정렬하여 모든 회원 가져오기
    const q = query(
      collection(db, 'users'),
      orderBy('totalPoint', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const usersData: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      usersData.push({
        id: doc.id,
        name: userData.name || '이름 없음',
        totalPoint: userData.totalPoint || 0,
      });
    });
    
    // 전체 회원 수 설정 (실제 총 회원 수)
    setTotalMembers(usersData.length);
    
    // 0포인트 초과인 사용자만 표시하도록 필터링
    const filteredUsersData = usersData.filter(user => {
      // 0포인트 이하인 경우 필터링
      if (user.totalPoint <= 0) {
        return false;
      }
      return true;
    });
    
    setUsers(filteredUsersData);
    
    // 현재 사용자의 순위 찾기
    if (uuid) {
      const myIndex = filteredUsersData.findIndex(user => user.id === uuid);
      if (myIndex !== -1 && myIndex < filteredUsersData.length) {
        setMyRank(myIndex + 1);
        console.log(`User found at index ${myIndex}, setting myRank to ${myIndex + 1}`);
      } else {
        // Reset myRank if user not found or index is invalid
        setMyRank(null);
        console.log(`User not found in ranking list or invalid index: ${myIndex}`);
      }
    }
  };

  const fetchRankingData = async () => {
    try {
      setLoading(true);
      
      // 대회 정보 가져오기
      await fetchTournamentData();
      
      // 랭킹 데이터 가져오기
      await fetchRankingDataCommon();
    } catch (error) {
      console.error('랭킹 데이터 가져오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Don't set loading state during pull-to-refresh to avoid awkward UI
      // This prevents the loading spinner from appearing during pull-to-refresh
      
      // Fetch tournament data
      await fetchTournamentData();
      
      // Fetch ranking data using the common function
      await fetchRankingDataCommon();
      
      // The auto-scroll will be triggered by the useEffect when myRank is updated
      console.log('Refresh completed, auto-scroll will be triggered if myRank is set');
    } catch (error) {
      console.error('새로고침 중 오류 발생:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    router.back();
  };
  
  // 사용자의 물고기 잡은 기록 가져오기
  const fetchUserFishCatches = async (userId: string) => {
    if (!tournament) return;
    
    setLoadingFishCatches(true);
    try {
      // 대회 기간 내의 물고기 잡은 기록만 가져오기
      const q = query(
        collection(db, `users/${userId}/points`),
        where('at', '>=', tournament.startDate),
        where('at', '<=', tournament.endDate),
        orderBy('at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const catches: FishCatch[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        catches.push({
          id: doc.id,
          fishName: data.fishName || '이름 없음',
          point: data.point || 0,
          fishLevel: data.fishLevel || 1,
          extraPoint: data.extraPoint || 0,
          at: data.at.toDate(),
        });
      });
      
      // 물고기 이름별로 그룹화하고 포인트 합계 계산
      const fishGroups: Record<string, GroupedFishCatch> = {};
      
      catches.forEach(fish => {
        if (!fishGroups[fish.fishName]) {
          fishGroups[fish.fishName] = {
            fishName: fish.fishName,
            totalPoints: 0,
            count: 0,
            img: undefined
          };
        }
        
        fishGroups[fish.fishName].totalPoints += fish.point;
        fishGroups[fish.fishName].count += 1;
      });
      
      // 물고기 이미지 정보 가져오기
      const fishesCollection = collection(db, 'fishes');
      const fishesSnapshot = await getDocs(fishesCollection);
      const fishesData: Record<string, string> = {};
      
      fishesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name && data.img) {
          fishesData[data.name] = data.img;
        }
      });
      
      // 이미지 정보 추가
      Object.keys(fishGroups).forEach(fishName => {
        if (fishesData[fishName]) {
          fishGroups[fishName].img = fishesData[fishName];
        }
      });
      
      // 객체를 배열로 변환하고 포인트 내림차순으로 정렬
      const grouped = Object.values(fishGroups).sort((a, b) => 
        b.totalPoints - a.totalPoints
      );
      
      setFishCatches(catches);
      setGroupedFishCatches(grouped);
    } catch (error) {
      console.error('물고기 잡은 기록 가져오기 오류:', error);
      setFishCatches([]);
      setGroupedFishCatches([]);
    } finally {
      setLoadingFishCatches(false);
    }
  };
  
  // 이미지 캐싱 처리
  const loadCachedImage = async (uri: string, fishName: string) => {
    try {
      if (!cachedImages[fishName]) {
        const cachedUri = await getCachedImage(uri, fishName);
        setCachedImages(prev => ({
          ...prev,
          [fishName]: cachedUri
        }));
      }
    } catch (error) {
      console.error('Error loading cached image:', error);
    }
  };

  // 사용자 선택 시 모달 열기
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    fetchUserFishCatches(user.id);
    setModalVisible(true);
  };

  const renderItem = ({ item, index }: { item: User; index: number }) => {
    const isCurrentUser = item.id === uuid;
    
    return (
      <TouchableOpacity 
        style={[
          styles.rankItem, 
          isCurrentUser && styles.currentUserItem
        ]}
        onPress={() => handleUserSelect(item)}
        disabled={!tournament} // 대회 기간이 아니면 클릭 불가
      >
        
        <MedalIcon rank={index + 1} />
        
        <View style={styles.userInfo}>
          <Text style={[
            styles.userName,
            isCurrentUser && styles.currentUserText
          ]}>
            {isCurrentUser || isAdmin ? item.name : maskName(item.name)}
            {isCurrentUser && ' (나)'}
          </Text>
        </View>
        
        <View style={styles.pointContainer}>
          <Text style={[
            styles.pointText,
            isCurrentUser && styles.currentUserText
          ]}>
            {item.totalPoint.toLocaleString()}P
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 대회 기간 포맷팅 함수
  const formatTournamentPeriod = () => {
    if (!tournament) return '';
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    };
    
    return `${formatDate(tournament.startDate)} ~ ${formatDate(tournament.endDate)}`;
  };

  // 날짜 포맷팅 함수
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>랭킹 정보를 불러오는 중...</Text>
        </View>
      ) : (
        <>
          {tournament ? (
            <View style={styles.tournamentBanner}>
              <View style={styles.tournamentTitleContainer}>
                <Ionicons name="trophy" size={20} color="#FFD700" style={styles.trophyIcon} />
                <Text style={styles.tournamentTitle}>{tournament.title}</Text>
              </View>
              {tournament.description ? (
                <Text style={styles.tournamentDescription}>{tournament.description}</Text>
              ) : null}
              <Text style={styles.tournamentPeriod}>{formatTournamentPeriod()}</Text>
            </View>
          ) : (
            <View style={[styles.tournamentBanner, { backgroundColor: '#757575' }]}>
              <Text style={styles.tournamentTitle}>현재 진행 중인 대회가 없습니다</Text>
            </View>
          )}
          
          <View style={styles.rankingHeader}>
            <Text style={styles.rankingHeaderText}>순위</Text>
            <Text style={styles.rankingHeaderText}>이름</Text>
            <Text style={styles.rankingHeaderText}>포인트</Text>
          </View>
          
          <FlatList
            ref={flatListRef}
            data={users}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            getItemLayout={(data, index) => ({
              length: 60, // Fixed height for each item
              offset: 60 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              console.warn('Failed to scroll to index', info);
              // Try to scroll to a nearby valid position with improved error handling
              setTimeout(() => {
                if (flatListRef.current && users.length > 0) {
                  try {
                    // Calculate a valid index to scroll to
                    const validIndex = Math.min(Math.max(0, info.index), users.length - 1);
                    console.log(`Attempting recovery scroll to valid index: ${validIndex}`);
                    
                    // First try: scroll to a valid index
                    flatListRef.current.scrollToIndex({
                      index: validIndex,
                      animated: true,
                      viewPosition: 0.5
                    });
                  } catch (error) {
                    console.warn(`Recovery scrollToIndex failed: ${error}`);
                    
                    // Second fallback: use scrollToOffset as a more reliable alternative
                    // Estimate the position based on average item height
                    const estimatedOffset = Math.max(0, info.index * (info.averageItemLength || 60));
                    console.log(`Using fallback scrollToOffset: ${estimatedOffset}`);
                    flatListRef.current.scrollToOffset({
                      offset: estimatedOffset,
                      animated: true
                    });
                  }
                }
              }, 300); // Increased delay for better reliability
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#2196F3']}
                tintColor="#2196F3"
              />
            }
          />
          
          {myRank && (
            <View style={styles.myRankContainer}>
              <Text style={styles.myRankText}>
                내 순위: {myRank}위 / {users.length}명 중
              </Text>
            </View>
          )}
          
          {/* 물고기 잡은 기록 모달 */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedUser?.id === uuid || isAdmin ? selectedUser?.name : maskName(selectedUser?.name || '')}님의 기록 요약
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                {loadingFishCatches ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#2196F3" />
                    <Text style={styles.loadingText}>기록을 불러오는 중...</Text>
                  </View>
                ) : groupedFishCatches.length > 0 ? (
                  <FlatList
                    data={groupedFishCatches}
                    keyExtractor={(item) => item.fishName}
                    contentContainerStyle={styles.fishListContainer}
                    renderItem={({ item }) => {
                      // 이미지가 있으면 캐싱 처리
                      if (item.img && !cachedImages[item.fishName]) {
                        loadCachedImage(item.img, item.fishName);
                      }
                      
                      return (
                        <View style={styles.fishItem}>
                          <View style={styles.fishItemHeader}>
                            <View style={styles.fishNameContainer}>
                              {item.img ? (
                                <Image 
                                  source={{ uri: cachedImages[item.fishName] || item.img }} 
                                  style={styles.fishThumbnail} 
                                  resizeMode="contain"
                                />
                              ) : (
                                <Ionicons name="fish" size={18} color="#2196F3" style={styles.fishItemIcon} />
                              )}
                              <Text style={styles.fishName}>{item.fishName} ({item.count}마리)</Text>
                            </View>
                          </View>
                          <View style={styles.fishDetails}>
                            <Text style={styles.fishPoint}>
                              누적 : {item.totalPoints.toLocaleString()}P
                            </Text>
                          </View>
                        </View>
                      );
                    }}
                  />
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="information-circle-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>기록이 없습니다.</Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tournamentBanner: {
    backgroundColor: '#1565C0',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0D47A1',
  },
  tournamentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trophyIcon: {
    marginRight: 6,
  },
  tournamentTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'GiantRegular',
  },
  tournamentDescription: {
    fontSize: 14,
    color: '#E3F2FD',
    fontFamily: 'GiantRegular',
    marginBottom: 4,
  },
  tournamentPeriod: {
    fontSize: 14,
    color: '#E3F2FD',
    fontFamily: 'GiantRegular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  refreshButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'GiantRegular',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'GiantRegular',
  },
  listContainer: {
    paddingBottom: 20,
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  rankingHeaderText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'GiantRegular',
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  currentUserItem: {
    backgroundColor: '#e3f2fd',
  },
  currentUserIndicator: {
    position: 'absolute',
    left: 5,
    top: '50%',
    marginTop: -8,
    zIndex: 1,
  },
  medalContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  medalText: {
    fontSize: 20,
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rankText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'GiantRegular',
  },
  pointContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointText: {
    fontSize: 16,
    color: '#2196F3',
    fontFamily: 'GiantRegular',
  },
  fishIcon: {
    marginLeft: 5,
  },
  currentUserText: {
    color: '#1565C0',
  },
  myRankContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  myRankText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'GiantRegular',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f5f5f5',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  fishListContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  fishItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fishItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fishNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fishItemIcon: {
    marginRight: 6,
  },
  fishThumbnail: {
    width: 24,
    height: 24,
    marginRight: 6,
    borderRadius: 4,
  },
  fishName: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
  fishDate: {
    fontSize: 12,
    color: '#757575',
    fontFamily: 'GiantRegular',
  },
  fishDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fishLevel: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'GiantRegular',
  },
  fishPoint: {
    fontSize: 16,
    color: '#2196F3',
    fontFamily: 'GiantRegular',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#757575',
    fontFamily: 'GiantRegular',
    textAlign: 'center',
  },
});