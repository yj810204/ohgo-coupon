# 오고피씽 프로젝트

## 1. 프로젝트 개요

오고피씽은 낚시 미니게임과 포인트 시스템을 갖춘 모바일 애플리케이션입니다. 사용자는 낚시 게임을 통해 다양한 물고기를 잡고 포인트를 획득할 수 있으며, 관리자는 물고기 데이터를 관리하고 사용자에게 푸시 알림을 보낼 수 있습니다.

### 최근 변경사항 (2025-08-17)

- 모든 문서를 하나의 README.md로 통합
- Gradle 빌드 문제 해결 (2025-08-11)

### 이전 변경사항 (2025-06-05)

- 🔔 관리자 푸시 기능 추가
  - `/admin-push` 화면 추가
  - 제목, 내용 입력 후 전체 사용자에게 푸시 발송
  - 발송 시 Firestore에 저장된 expoPushToken 기준
  - 관리자일 경우 헤더 우측에 megaphone 아이콘 버튼 표시
- 🔐 로그인 관련
  - 로그인 성공 시 `userInfo`에 `isAdmin` 포함하여 SecureStore 저장
  - `index.tsx` 자동 로그인에서도 `isAdmin` 값 기반으로 `/admin` 또는 `/stamp` 라우팅 처리
  - 로그인할 때마다 expo push token 갱신되도록 수정
- 🧭 커스텀 헤더 개선
  - 타이틀 중앙 정렬 문제 해결
  - 좌우 버튼 여백 조정
  - settings 화면에서는 설정 아이콘 제거, 알림 버튼 위치 유지
- 🧾 입력/전송 UI 개선
  - `KeyboardAvoidingView` 및 `ScrollView`를 활용하여 키보드에 가려지지 않도록 조정
  - 버튼 하단 여백 추가로 여유 공간 확보
- 🎨 스타일 통일
  - 로그인, 관리자푸시, 스탬프 등 주요 화면 배경색 `#f7f9fc`로 통일
  - 로그인 화면 SafeAreaView 추가로 전체 회색 영역 제거
- 🏷 기타
  - `stamp.tsx` 화면 내 Floating QR 버튼 위치 보정
  - `stamp.tsx` 화면 내 스탬프 모달 및 회수 기능 유지

## 2. 기능

### 2.1 낚시 미니게임

#### 2.1.1 물고기 관리

물고기 정보는 Firebase Firestore에 저장되며, 물고기 이미지는 Firebase Storage에 저장됩니다. 관리자 페이지를 통해 물고기 정보를 등록, 수정, 삭제할 수 있습니다.

**주요 기능:**
- 물고기 정보 관리 (추가, 수정, 삭제)
- 물고기 이미지 업로드 및 관리
- Firebase Storage를 통한 이미지 저장
- 앱 업데이트 없이 물고기 정보 변경 가능

**데이터 구조:**
- Firestore 컬렉션: `fishes`
  - `name`: 물고기 이름 (string)
  - `point`: 획득 포인트 (number)
  - `level`: 물고기 난이도 (number, 1-5)
  - `description`: 물고기 설명 (string, 선택사항)
  - `img`: 이미지 URL (string, 선택사항)
  - `createdAt`: 생성 시간 (ISO string)
  - `updatedAt`: 수정 시간 (ISO string, 선택사항)

**관리자 페이지 사용법:**
1. 관리자 메인 페이지에서 "물고기 관리" 메뉴 선택
2. 물고기 목록에서 추가/수정/삭제 작업 수행
3. 이미지 업로드는 물고기 추가/수정 폼에서 가능

#### 2.1.2 물고기 레벨 시스템

물고기마다 난이도(level) 필드를 추가하여 1(쉬움)에서 5(어려움)까지 구분하고, 레벨에 따라 거리, 시간, 포인트가 자동으로 계산됩니다.

**레벨별 특성:**

| 레벨 | 난이도 | 거리 범위 (기본값 기준) | 포인트 범위 (기본값 기준) | 시간 |
|------|--------|-------------------------|--------------------------|------|
| 1    | 매우 쉬움 | 40-50% | 40-60% | 거리의 50% |
| 2    | 쉬움     | 50-60% | 50-70% | 거리의 50% |
| 3    | 보통     | 60-70% | 60-80% | 거리의 50% |
| 4    | 어려움   | 70-80% | 70-90% | 거리의 50% |
| 5    | 매우 어려움 | 80-100% | 80-100% | 거리의 50% |

**게임 설정:**
- 관리자 화면의 '낚시 게임 설정' 섹션에서 다음 값을 설정 가능:
  - **공통 거리**: 모든 물고기에 적용되는 기본 거리 값 (기본값: 50)
  - **공통 포인트**: 모든 물고기에 적용되는 기본 포인트 값 (기본값: 1000)

**주의 사항:**
- 기존 물고기 데이터에 레벨을 추가하지 않으면 기본적으로 레벨 1로 처리
- 게임 설정을 변경하면 모든 물고기에 즉시 적용
- 물고기 데이터의 기존 `distance`, `limitTime`, `point` 필드는 더 이상 사용되지 않음

#### 2.1.3 물고기 데이터 캐싱

미니 게임 화면에 처음 접속할 때 물고기 데이터를 받아오는 과정에서 이미지가 늦게 로드되는 문제를 해결하기 위해 물고기 데이터와 이미지를 캐싱하는 기능을 구현했습니다.

**구현 내용:**
- AsyncStorage를 사용하여 데이터 캐싱 구현
- 캐시 키, 버전, 만료 시간 등의 상수 정의
- 캐시 버전 확인 기능 (앱 업데이트 시 캐시 초기화)
- 물고기 데이터 캐싱 기능
- 물고기 이미지 미리 로드 기능
- 데이터 로딩 로직 개선 (캐시 → Firebase 순서)

**기대 효과:**
1. 미니 게임 화면에 처음 접속할 때 물고기 데이터와 이미지를 캐시에 저장
2. 이후 접속 시 캐시된 데이터를 먼저 사용하여 화면 로딩 속도 향상
3. 백그라운드에서 최신 데이터를 가져와 캐시 업데이트
4. 앱 업데이트 시 캐시 버전 확인을 통해 캐시 초기화

**주의사항:**
- 캐시 버전(`FISH_CACHE_VERSION`)은 앱 업데이트 시 변경해야 함
- 캐시 만료 시간(`FISH_CACHE_EXPIRY`)은 필요에 따라 조정 가능 (기본값: 24시간)

#### 2.1.4 물고기 기록 그룹화

사용자가 잡은 물고기 기록을 개별 항목으로 표시하는 대신, 물고기 이름별로 그룹화하여 포인트 합계를 표시하도록 변경했습니다.

**주요 변경사항:**
1. 그룹화된 물고기 기록을 위한 새로운 타입 정의 추가
   ```typescript
   type GroupedFishCatch = {
     fishName: string;
     totalPoints: number;
     count: number;
   };
   ```

2. 물고기 기록을 그룹화하는 로직 추가
   - 물고기 이름별로 그룹화
   - 각 그룹별 포인트 합계 계산
   - 포인트 내림차순으로 정렬

3. UI 변경
   - 물고기 이름과 잡은 개수 표시
   - 포인트 합계 표시
   - 날짜 정보 제거 (요구사항에 따라)
   - 모달 타이틀 및 메시지 업데이트

**변경된 파일:**
- `/app/mini-games/ranking.tsx`

**사용 방법:**
1. 랭킹 화면에서 사용자를 선택하면 해당 사용자의 물고기 기록 요약이 표시
2. 물고기 기록은 물고기 이름별로 그룹화되어 있으며, 각 물고기별 잡은 개수와 포인트 합계가 표시
3. 물고기 기록은 포인트 합계 기준으로 내림차순 정렬

#### 2.1.5 포인트 반올림

낚시 게임에서 획득하는 포인트를 10단위로 반올림하는 기능을 구현했습니다.

**요구사항:**
- 포인트를 10단위로 반올림
- 0-4로 끝나는 숫자는 내림 (예: 663 → 660)
- 5-9로 끝나는 숫자는 올림 (예: 665 → 670)

**구현 내용:**
```javascript
// 포인트를 10단위로 반올림 (5 이상은 올림, 5 미만은 내림)
const rawPoint = Math.round(commonPoint * pointPercent);
const lastDigit = rawPoint % 10;
const point = lastDigit >= 5 ? rawPoint + (10 - lastDigit) : rawPoint - lastDigit;
```

**테스트 결과:**

| 원래 값 | 반올림 값 |
|---------|-----------|
| 663     | 660       |
| 665     | 670       |
| 660     | 660       |
| 670     | 670       |
| 671     | 670       |
| 674     | 670       |
| 675     | 680       |
| 679     | 680       |
| 1001    | 1000      |
| 999     | 1000      |

### 2.2 관리자 기능

#### 2.2.1 푸시 알림

사용자가 낚시 게임에서 포인트를 획득할 때 관리자에게 푸시 알림을 전송하는 기능을 구현했습니다.

**변경된 파일:**
1. `/app/mini-games/fishing.tsx`
   - `notifyAllAdmins` 함수 import 추가
   - `savePointToUser` 함수에 관리자 알림 전송 로직 추가

2. `/utils/send-push.ts`
   - `notifyAllAdmins` 함수 개선
     - 기존: 신규 회원 가입 알림만 전송 가능
     - 변경: 다양한 알림 유형에 대응할 수 있도록 파라미터 추가 (메시지, 제목, 화면)

**동작 방식:**
1. 사용자가 낚시 게임에서 물고기를 성공적으로 잡으면 포인트가 부여됨
2. 포인트가 부여될 때 `savePointToUser` 함수가 호출됨
3. 이 함수는 사용자의 포인트를 저장하고, 관리자에게 푸시 알림을 전송함
4. 알림에는 다음 정보가 포함됨:
   - 제목: "포인트 획득 알림"
   - 내용: "[사용자 이름]님이 [포인트 금액]포인트를 획득했습니다!"

**주의사항:**
- 관리자 계정에 `isAdmin` 속성이 `true`로 설정되어 있어야 함
- 관리자 기기에 `expoPushToken`이 저장되어 있어야 함
- 푸시 알림을 받으려면 앱에서 알림 권한이 허용되어 있어야 함

## 3. 구현 세부사항

### 레벨 기반 계산 로직

물고기 레벨에 따른 파라미터 계산:

```javascript
const calculateFishParameters = (fishLevel: number = 1) => {
  // 레벨 범위 확인 (1-5)
  const level = Math.max(1, Math.min(5, fishLevel));
  
  // 거리 계산: 레벨이 높을수록 거리가 짧아짐 (더 어려움)
  const minDistancePercent = 0.4 + ((level - 1) * 0.1); // 0.4, 0.5, 0.6, 0.7, 0.8
  const maxDistancePercent = 0.5 + ((level - 1) * 0.1); // 0.5, 0.6, 0.7, 0.8, 1.0
  const distancePercent = minDistancePercent + (Math.random() * (maxDistancePercent - minDistancePercent));
  const distance = Math.round(commonDistance * distancePercent);
  
  // 시간 계산: 거리의 50% 수준으로 결정
  const limitTime = Math.round(distance * 0.5) * 1000; // 초 단위로 변환 (ms)
  
  // 포인트 계산: 레벨이 높을수록 포인트가 높아짐
  const minPointPercent = 0.4 + ((level - 1) * 0.1); // 0.4, 0.5, 0.6, 0.7, 0.8
  const maxPointPercent = 0.6 + ((level - 1) * 0.1); // 0.6, 0.7, 0.8, 0.9, 1.0
  const pointPercent = minPointPercent + (Math.random() * (maxPointPercent - minPointPercent));
  const point = Math.round(commonPoint * pointPercent);
  
  return { distance, limitTime, point };
};
```

### Firebase 데이터 구조

1. `fishes` 컬렉션:
   - 각 물고기 문서에 `level` 필드 추가 (1-5)

2. `gameSettings` 컬렉션:
   - `fishing` 문서 추가:
     - `distance`: 공통 거리 값 (기본값: 50)
     - `point`: 공통 포인트 값 (기본값: 1000)

### 캐싱 관련 코드

```javascript
// 캐싱을 위한 상수
const FISH_DATA_CACHE_KEY = 'FISH_DATA_CACHE';
const FISH_IMAGES_LOADED_KEY = 'FISH_IMAGES_LOADED';
const FISH_CACHE_VERSION_KEY = 'FISH_CACHE_VERSION';
const FISH_CACHE_VERSION = '1.0'; // 캐시 버전 - 앱 업데이트 시 변경
const FISH_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

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

## 4. 기술 참고사항

### 4.1 Gradle 빌드 설정

#### 최근 이슈 (2025-08-11)
Android 빌드가 다음 오류로 실패했습니다:
```
BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_' Unsupported class file major version 68
```

**원인:**
- **Class file major version 68**은 **Java 24**에 해당
- **Gradle 8.13**(이 프로젝트에서 사용)은 Java 24와 호환되지 않음
- Gradle 8.13은 Java 17부터 21까지 호환됨

**해결책:**
`android/gradle.properties` 파일에서 Java 17 경로를 다시 활성화했습니다:
```properties
# Specify Java version for Gradle to use
# The project requires Java 17-21 for compatibility with Gradle 8.13
# Class file major version 68 (Java 24) is not compatible with this Gradle version
org.gradle.java.home=/opt/homebrew/Cellar/openjdk@17/17.0.15/libexec/openjdk.jdk/Contents/Home
```

**배포 시 참고사항:**
CI/CD 환경이나 다른 개발자 머신에서 이 특정 Java 경로가 존재하지 않는 경우:
1. 경로를 유효한 Java 17-21 설치 경로로 수정
2. 또는 이 줄을 제거하고 시스템의 기본 Java 버전이 호환되는지(17-21) 확인

#### Gradle-Java 호환성 매트릭스
- Gradle 8.x: Java 17-21
- Gradle 7.x: Java 8-19
- Gradle 6.x: Java 8-15

## 5. 향후 개선사항

### 물고기 관리 개선
1. 이미지 압축 및 최적화
2. 물고기 카테고리 추가
3. 물고기 희귀도 설정
4. 통계 기능 추가 (가장 많이 잡힌 물고기 등)

### 레벨 시스템 개선
1. 레벨별 시각적 표시 추가 (예: 별 아이콘으로 난이도 표시)
2. 레벨별 특수 효과 추가 (예: 높은 레벨 물고기는 더 빠르게 움직임)
3. 레벨 기반 보상 시스템 확장 (예: 높은 레벨 물고기 잡을 시 추가 보너스)