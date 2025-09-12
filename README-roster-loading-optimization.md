# 승선 명부 페이지 로딩 최적화

## 문제점
승선 명부 페이지(`today-roster.tsx`)에 처음 들어올 때 로딩 시간이 너무 오래 걸리는 문제가 있었습니다.

## 원인 분석
코드를 분석한 결과, 다음과 같은 성능 병목 현상이 발견되었습니다:

1. **비효율적인 데이터 가져오기**: 한 달의 모든 날짜에 대해 개별적인 Firestore 쿼리를 실행하고 있었습니다. 이는 한 달에 최대 31개의 개별 쿼리를 발생시켜 로딩 시간이 길어지는 주요 원인이었습니다.

2. **캐싱 부재**: 사용자가 월간 달력을 탐색할 때마다 동일한 데이터를 반복적으로 가져오고 있었습니다.

## 구현된 최적화

### 1. 배치 쿼리 사용
개별 날짜별 쿼리 대신 월 단위로 배치 쿼리를 사용하도록 변경했습니다:

```typescript
// 한 달 전체에 대한 출석 데이터 일괄 가져오기
const attendanceQuery = query(
  collection(db, 'attendance'),
  where('__name__', '>=', startDateStr),
  where('__name__', '<=', endDateStr)
);
const attendanceSnapshot = await getDocs(attendanceQuery);

// 한 달 전체에 대한 항차 데이터 일괄 가져오기
const tripsQuery = query(
  collection(db, 'trips'),
  where('__name__', '>=', startDateStr),
  where('__name__', '<=', endDateStr)
);
const tripsSnapshot = await getDocs(tripsQuery);
```

이 변경으로 31개의 개별 쿼리 대신 단 2개의 쿼리만 실행하게 되었습니다.

### 2. 데이터 캐싱 구현
이전에 로드한 월 데이터를 캐싱하여 사용자가 이미 방문한 월로 돌아갈 때 즉시 데이터를 표시할 수 있도록 했습니다:

```typescript
// 캐시된 데이터가 있는지 확인
if (cachedMonths[monthKey]) {
  console.log('Using cached data for month:', monthKey);
  setDatesWithRoster(cachedMonths[monthKey].datesWithRoster);
  setConfirmedTrips(cachedMonths[monthKey].confirmedTrips);
  setUsingCachedData(true);
  
  // 타임스탬프 업데이트
  setCachedMonths(prev => {
    const updatedCache = {
      ...prev,
      [monthKey]: {
        ...prev[monthKey],
        timestamp: Date.now()
      }
    };
    return limitCacheSize(updatedCache);
  });
  
  setLoading(false);
  return;
}
```

### 3. 캐시 크기 제한
메모리 사용량을 제한하기 위해 최대 3개월의 데이터만 캐시에 유지하도록 구현했습니다:

```typescript
// 캐시 크기 제한 함수 (최근에 사용된 3개월만 유지)
const limitCacheSize = (cache: Record<string, any>) => {
  const MAX_CACHE_SIZE = 3;
  if (Object.keys(cache).length <= MAX_CACHE_SIZE) return cache;
  
  // 타임스탬프로 정렬 (최근 사용 순)
  const sortedEntries = Object.entries(cache).sort((a, b) => b[1].timestamp - a[1].timestamp);
  // MAX_CACHE_SIZE개의 최근 항목만 유지
  const limitedEntries = sortedEntries.slice(0, MAX_CACHE_SIZE);
  
  return Object.fromEntries(limitedEntries);
};
```

### 4. 로딩 상태 타임아웃
로딩 상태가 무한정 지속되는 것을 방지하기 위해 10초 타임아웃을 추가했습니다:

```typescript
// 로딩 인디케이터가 너무 오래 표시되는 것을 방지하기 위한 타임아웃 추가
useEffect(() => {
  if (loading) {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 10000); // 10초 타임아웃
    return () => clearTimeout(timer);
  }
}, [loading]);
```

### 5. 캐시 사용 시각적 표시
사용자에게 캐시된 데이터가 사용되고 있음을 알리기 위한 시각적 표시를 추가했습니다:

```tsx
{usingCachedData && (
  <View style={styles.cachedIndicator}>
    <Ionicons name="flash" size={14} color="#4caf50" />
    <Text style={styles.cachedText}>빠른 로딩</Text>
  </View>
)}
```

## 개선 효과

1. **로딩 시간 단축**: 배치 쿼리를 사용함으로써 네트워크 요청 수가 크게 감소하여 초기 로딩 시간이 단축되었습니다.

2. **반응성 향상**: 캐싱을 통해 이미 방문한 월로 이동할 때 즉시 데이터가 표시되어 사용자 경험이 향상되었습니다.

3. **네트워크 사용량 감소**: 불필요한 중복 요청이 제거되어 네트워크 사용량이 감소했습니다.

4. **사용자 피드백 개선**: 캐시 사용 시 시각적 표시를 통해 사용자에게 빠른 로딩이 이루어지고 있음을 알려줍니다.

이러한 최적화를 통해 승선 명부 페이지의 로딩 성능이 크게 향상되었습니다.