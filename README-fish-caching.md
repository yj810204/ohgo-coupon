# 물고기 데이터 캐싱 구현 문서

## 문제 설명
미니 게임 화면에 처음 접속할 때 물고기 데이터를 받아오는 과정에서 이미지가 늦게 로드되는 문제가 있었습니다.

## 해결 방법
물고기 데이터와 이미지를 캐싱하여 미니 게임 화면에 접속할 때 더 빠르게 로드될 수 있도록 구현했습니다.

## 구현 내용

### 1. 캐싱 관련 상수 및 라이브러리 추가
- AsyncStorage를 사용하여 데이터 캐싱 구현
- 캐시 키, 버전, 만료 시간 등의 상수 정의

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// 캐싱을 위한 상수
const FISH_DATA_CACHE_KEY = 'FISH_DATA_CACHE';
const FISH_IMAGES_LOADED_KEY = 'FISH_IMAGES_LOADED';
const FISH_CACHE_VERSION_KEY = 'FISH_CACHE_VERSION';
const FISH_CACHE_VERSION = '1.0'; // 캐시 버전 - 앱 업데이트 시 변경
const FISH_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간 (밀리초)
```

### 2. 캐시 버전 확인 기능
앱 업데이트 시 캐시를 초기화하기 위한 버전 확인 기능을 구현했습니다.

```javascript
// 캐시 버전 확인
const checkCacheVersion = async () => {
  try {
    const currentVersion = await AsyncStorage.getItem(FISH_CACHE_VERSION_KEY);
    
    // 버전이 다르면 캐시 초기화
    if (currentVersion !== FISH_CACHE_VERSION) {
      console.log('캐시 버전이 변경되었습니다. 캐시를 초기화합니다.');
      await AsyncStorage.removeItem(FISH_DATA_CACHE_KEY);
      await AsyncStorage.removeItem(FISH_IMAGES_LOADED_KEY);
      await AsyncStorage.setItem(FISH_CACHE_VERSION_KEY, FISH_CACHE_VERSION);
      return false;
    }
    return true;
  } catch (error) {
    console.error('캐시 버전 확인 오류:', error);
    return false;
  }
};
```

### 3. 물고기 데이터 캐싱 기능
Firebase에서 가져온 물고기 데이터를 캐시에 저장하고, 다음 접속 시 캐시에서 먼저 데이터를 확인하도록 구현했습니다.

```javascript
// 캐시에서 물고기 데이터 가져오기
const getFishDataFromCache = async () => {
  try {
    // 캐시 버전 확인
    const isValidVersion = await checkCacheVersion();
    if (!isValidVersion) {
      return null;
    }
    
    const cachedData = await AsyncStorage.getItem(FISH_DATA_CACHE_KEY);
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      const now = new Date().getTime();
      
      // 캐시가 유효한지 확인 (24시간 이내)
      if (now - timestamp < FISH_CACHE_EXPIRY) {
        console.log('물고기 데이터를 캐시에서 불러왔습니다.');
        return data;
      } else {
        console.log('캐시된 물고기 데이터가 만료되었습니다.');
      }
    }
  } catch (error) {
    console.error('캐시에서 물고기 데이터 불러오기 오류:', error);
  }
  return null;
};

// 물고기 데이터를 캐시에 저장
const cacheFishData = async (fishData) => {
  try {
    // 캐시 버전 설정
    await AsyncStorage.setItem(FISH_CACHE_VERSION_KEY, FISH_CACHE_VERSION);
    
    const cacheData = {
      data: fishData,
      timestamp: new Date().getTime()
    };
    await AsyncStorage.setItem(FISH_DATA_CACHE_KEY, JSON.stringify(cacheData));
    console.log('물고기 데이터가 캐시에 저장되었습니다.');
  } catch (error) {
    console.error('물고기 데이터 캐싱 오류:', error);
  }
};
```

### 4. 물고기 이미지 미리 로드 기능
물고기 이미지를 미리 로드하여 결과 화면에서 이미지가 즉시 표시되도록 구현했습니다.

```javascript
// 물고기 이미지 미리 로드
const preloadFishImages = async (fishData) => {
  try {
    // 캐시 버전 확인
    const isValidVersion = await checkCacheVersion();
    if (!isValidVersion) {
      // 버전이 변경되었으면 이미지 다시 로드
      console.log('캐시 버전이 변경되어 이미지를 다시 로드합니다.');
    } else {
      // 이미 이미지가 로드되었는지 확인
      const imagesLoaded = await AsyncStorage.getItem(FISH_IMAGES_LOADED_KEY);
      if (imagesLoaded === 'true') {
        console.log('물고기 이미지가 이미 로드되어 있습니다.');
        return;
      }
    }

    console.log('물고기 이미지 미리 로드 시작...');
    const imagePromises = fishData
      .filter(fish => fish.img) // img 속성이 있는 물고기만 필터링
      .map(fish => {
        // React Native의 Image.prefetch 사용
        return Image.prefetch(fish.img)
          .then(() => {
            console.log(`이미지 로드 완료: ${fish.name}`);
          })
          .catch(error => {
            console.error(`이미지 로드 실패: ${fish.name}`, error);
            // 실패해도 계속 진행
          });
      });

    // 모든 이미지 로드 대기
    await Promise.all(imagePromises);
    
    // 이미지 로드 완료 표시
    await AsyncStorage.setItem(FISH_IMAGES_LOADED_KEY, 'true');
    console.log('모든 물고기 이미지 미리 로드 완료');
  } catch (error) {
    console.error('물고기 이미지 미리 로드 오류:', error);
  }
};
```

### 5. 데이터 로딩 로직 개선
미니 게임 화면에 접속할 때 캐시된 데이터를 먼저 확인하고, 없으면 Firebase에서 데이터를 가져오도록 로직을 개선했습니다.

```javascript
// uuid 방어
useEffect(() => {
  if (!uuid) return;
  (async () => {
    console.log('미니게임 화면 접속: 물고기 데이터 로딩 시작');
    
    // 이벤트 정보 가져오기
    await fetchTournamentData();
    
    const baitSnap = await getDoc(doc(db, 'config', 'bait'));
    setDailyBaitLimit(baitSnap.exists() ? (baitSnap.data().dailyLimit ?? 5) : 5);

    try {
      setFishLoading(true);
      
      // 먼저 캐시에서 데이터 확인
      console.log('캐시에서 물고기 데이터 확인 중...');
      const cachedFishData = await getFishDataFromCache();
      
      if (cachedFishData && cachedFishData.length > 0) {
        // 캐시된 데이터가 있으면 사용
        console.log(`캐시된 물고기 데이터 ${cachedFishData.length}개 사용`);
        setFishes(cachedFishData);
        setFishLoading(false);
        
        // 백그라운드에서 최신 데이터 가져오기
        console.log('백그라운드에서 최신 데이터 확인 중...');
        fetchLatestFishData();
      } else {
        // 캐시된 데이터가 없으면 Firebase에서 가져오기
        console.log('캐시된 데이터 없음, Firebase에서 데이터 가져오기');
        await fetchLatestFishData();
      }
    } catch (e) {
      console.error('Fish fetch error', e);
      setFishes([]);
      setFishLoading(false);
    }

    // 오늘 사용 미끼
    const usageSnap = await getDoc(doc(db, `users/${uuid}/baitUsage`, todayStr()));
    setTodayBaitUsed(usageSnap.exists() ? (usageSnap.data().used || 0) : 0);
  })();
}, [uuid]);
```

## 기대 효과
1. 미니 게임 화면에 처음 접속할 때 물고기 데이터와 이미지를 캐시에 저장
2. 이후 접속 시 캐시된 데이터를 먼저 사용하여 화면 로딩 속도 향상
3. 백그라운드에서 최신 데이터를 가져와 캐시 업데이트
4. 앱 업데이트 시 캐시 버전 확인을 통해 캐시 초기화

## 주의사항
- 캐시 버전(`FISH_CACHE_VERSION`)은 앱 업데이트 시 변경해야 합니다.
- 캐시 만료 시간(`FISH_CACHE_EXPIRY`)은 필요에 따라 조정할 수 있습니다.