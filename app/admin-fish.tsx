import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

// 물고기 타입 정의
interface Fish {
  id: string;
  name: string;
  level: number;
  img?: string;
}

// 이미지 캐싱 함수
const getCachedImage = async (uri: string, fishId: string): Promise<string> => {
  try {
    // 캐시 디렉토리 경로
    const cacheDir = `${FileSystem.cacheDirectory}fish-images/`;
    // 캐시 파일 경로
    const cacheFilePath = `${cacheDir}${fishId}`;
    
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

// 레벨 바 컴포넌트
const LevelBar = ({ level }: { level: number }) => {
  // 레벨은 1-5 사이의 값
  const normalizedLevel = Math.max(1, Math.min(5, level));
  
  // 색상 배열 (노란색에서 빨간색으로)
  const colors = ['#FFD700', '#FFA500', '#FF8C00', '#FF4500', '#FF0000'];
  
  return (
    <View style={styles.levelBarContainer}>
      {[1, 2, 3, 4, 5].map((barLevel) => (
        <View 
          key={barLevel}
          style={[
            styles.levelBarSegment,
            barLevel <= normalizedLevel ? 
              { backgroundColor: colors[barLevel-1] } : 
              styles.levelBarInactive
          ]}
        />
      ))}
      <Text style={styles.levelText}>레벨 {normalizedLevel}</Text>
    </View>
  );
};

// 페이지당 아이템 수
const ITEMS_PER_PAGE = 10;

export default function AdminFishScreen() {
  const [fishes, setFishes] = useState<Fish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const router = useRouter();

  useEffect(() => {
    fetchFishes();
  }, []);
  
  // Add focus effect to refresh fish list when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchFishes();
    }, [])
  );

  useEffect(() => {
    // 물고기 목록이나 검색어가 변경될 때마다 총 페이지 수 계산
    const filteredFishes = getFilteredFishes();
    const newTotalPages = Math.ceil(filteredFishes.length / ITEMS_PER_PAGE);
    setTotalPages(newTotalPages);
    
    // 검색어가 변경된 경우에만 첫 페이지로 이동 (새로고침 시에는 현재 페이지 유지)
    if (searchQuery && !refreshing) {
      setCurrentPage(1);
    } else if (currentPage > newTotalPages && newTotalPages > 0) {
      // 현재 페이지가 새로운 총 페이지 수보다 크면 마지막 페이지로 이동
      setCurrentPage(newTotalPages);
    }
  }, [fishes, searchQuery, refreshing, currentPage]);

  const fetchFishes = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'fishes'));
      const fishData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          level: Number(data.level) || 1,
        } as Fish;
      });
      // 가나다순으로 정렬
      const sortedFishData = [...fishData].sort((a, b) => 
        a.name.localeCompare(b.name, 'ko')
      );
      setFishes(sortedFishData);
    } catch (error) {
      console.error('Error fetching fishes:', error);
      Alert.alert('오류', '물고기 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFishes();
    setRefreshing(false);
    // Preserve current page after refresh
  };

  const handleAddNew = () => {
    router.push('/admin-fish-add');
  };

  const handleEdit = (fish: Fish) => {
    router.push({
      pathname: '/admin-fish-edit',
      params: { id: fish.id }
    });
  };

  const handleDelete = async (fish: Fish) => {
    Alert.alert(
      '물고기 삭제',
      `${fish.name}을(를) 정말 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Firestore에서 문서 삭제
              await deleteDoc(doc(db, 'fishes', fish.id));
              
              // 이미지가 있으면 Storage에서도 삭제
              if (fish.img) {
                try {
                  const imageRef = ref(storage, `fishes/${fish.id}`);
                  await deleteObject(imageRef);
                } catch (imageError) {
                  console.error('이미지 삭제 실패:', imageError);
                  // 이미지 삭제 실패해도 계속 진행
                }
              }
              
              // 상태 업데이트
              setFishes(prev => prev.filter(f => f.id !== fish.id));
              Alert.alert('성공', '물고기가 삭제되었습니다.');
            } catch (error) {
              console.error('물고기 삭제 오류:', error);
              Alert.alert('오류', '물고기 삭제에 실패했습니다.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const [cachedImages, setCachedImages] = useState<{[key: string]: string}>({});

  // 이미지 캐싱 처리
  const loadCachedImage = async (uri: string, fishId: string) => {
    try {
      if (!cachedImages[fishId]) {
        const cachedUri = await getCachedImage(uri, fishId);
        setCachedImages(prev => ({
          ...prev,
          [fishId]: cachedUri
        }));
      }
    } catch (error) {
      console.error('Error loading cached image:', error);
    }
  };

  const renderFishItem = ({ item }: { item: Fish }) => {
    // 이미지가 있으면 캐싱 처리
    if (item.img && !cachedImages[item.id]) {
      loadCachedImage(item.img, item.id);
    }

    return (
      <TouchableOpacity 
        style={styles.fishCard}
        onPress={() => handleEdit(item)}
      >
        <View style={styles.fishContent}>
          {item.img ? (
            <Image 
              source={{ uri: cachedImages[item.id] || item.img }} 
              style={styles.fishImage} 
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={40} color="#ccc" />
              <Text style={styles.noImageText}>이미지 없음</Text>
            </View>
          )}
          
          <View style={styles.fishInfo}>
            <Text style={styles.fishName}>{item.name}</Text>
            <LevelBar level={item.level} />
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]} 
              onPress={(e) => {
                e.stopPropagation(); // Prevent triggering the parent's onPress
                handleDelete(item);
              }}
            >
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 검색 필터링된 물고기 목록
  const getFilteredFishes = () => {
    if (!searchQuery.trim()) {
      return fishes;
    }
    return fishes.filter(fish => 
      fish.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // 현재 페이지에 표시할 물고기 목록
  const getCurrentPageItems = () => {
    const filteredFishes = getFilteredFishes();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredFishes.slice(startIndex, endIndex);
  };

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 페이지네이션 컴포넌트
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.pageButton,
            currentPage === i && styles.activePageButton
          ]}
          onPress={() => handlePageChange(i)}
        >
          <Text
            style={[
              styles.pageButtonText,
              currentPage === i && styles.activePageButtonText
            ]}
          >
            {i}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, currentPage === 1 && styles.disabledPageButton]}
          onPress={() => currentPage > 1 && handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPage === 1 ? '#ccc' : '#1e88e5'}
          />
        </TouchableOpacity>
        
        {pages}
        
        <TouchableOpacity
          style={[styles.pageButton, currentPage === totalPages && styles.disabledPageButton]}
          onPress={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={currentPage === totalPages ? '#ccc' : '#1e88e5'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>물고기 도감 관리</Text>
          <Text style={styles.totalCount}>총 {fishes.length}종</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>추가</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="이름 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e88e5" />
          <Text style={styles.loadingText}>물고기 정보 불러오는 중...</Text>
        </View>
      ) : fishes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fish-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>등록된 물고기가 없습니다.</Text>
          <Text style={styles.emptySubText}>새 물고기를 추가해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={getCurrentPageItems()}
          renderItem={renderFishItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.fishList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={renderPagination}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f7f9fc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  totalCount: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e88e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontFamily: 'GiantRegular',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#999',
  },
  fishList: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  fishCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
  },
  fishInfo: {
    flex: 1,
    marginLeft: 16,
  },
  fishName: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 4,
  },
  fishPoint: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#1e88e5',
  },
  actionButtons: {
    marginLeft: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  fishContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fishImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  noImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 10,
    fontFamily: 'GiantRegular',
    color: '#999',
    marginTop: 4,
  },
  fishDetails: {
    width: '100%',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activePageButton: {
    backgroundColor: '#1e88e5',
    borderColor: '#1e88e5',
  },
  disabledPageButton: {
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
  },
  activePageButtonText: {
    color: '#fff',
  },
  levelBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
  },
  levelBarSegment: {
    flex: 1,
    height: 8,
    marginRight: 4,
    borderRadius: 2,
  },
  levelBarInactive: {
    backgroundColor: '#e0e0e0',
  },
  levelText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginLeft: 4,
  },
});