# 낚시 게임 개선 구현 요약

## 구현 내용

이 업데이트는 낚시 게임의 물고기 관리 방식을 개선하여 다음과 같은 변경 사항을 적용했습니다:

1. 물고기마다 난이도(level) 필드를 추가하여 1(쉬움)에서 5(어려움)까지 구분
2. 개별 물고기의 distance 대신 공통 distance 값을 사용하도록 변경
3. 개별 물고기의 point 대신 공통 point 값을 사용하도록 변경
4. 게임 시작 시 난이도에 따라 거리, 시간, 포인트가 자동으로 계산되도록 구현

## 변경된 파일

1. `/app/mini-games/fishing.tsx`
   - Fish 인터페이스에 level 필드 추가
   - 공통 거리 및 포인트 값을 위한 상태 변수 추가
   - Firebase에서 게임 설정을 가져오는 함수 추가
   - 물고기 레벨에 따라 파라미터를 계산하는 함수 구현
   - startFishing 함수 업데이트하여 계산된 값 사용
   - savePointToUser 함수 업데이트하여 물고기 레벨 기록

2. `/app/admin-game-settings.tsx`
   - 공통 거리 및 포인트 값을 설정하는 UI 추가
   - 게임 설정을 Firebase에 저장하는 기능 구현
   - Firebase에서 게임 설정을 가져오는 기능 구현

3. `/README-fish-level-update.md`
   - 물고기 데이터에 레벨 필드를 추가하는 방법 설명
   - 레벨별 특성 및 게임 설정 방법 안내

## 기술적 구현 세부 사항

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

## 사용자 경험 개선

1. 관리자는 이제 각 물고기마다 거리, 시간, 포인트를 개별적으로 설정할 필요 없이 레벨만 설정하면 됩니다.
2. 공통 거리 및 포인트 값을 한 곳에서 관리할 수 있어 게임 밸런싱이 용이해졌습니다.
3. 레벨에 따른 랜덤 요소가 추가되어 게임의 다양성이 향상되었습니다.

## 향후 개선 가능성

1. 레벨별 시각적 표시 추가 (예: 별 아이콘으로 난이도 표시)
2. 레벨별 특수 효과 추가 (예: 높은 레벨 물고기는 더 빠르게 움직임)
3. 레벨 기반 보상 시스템 확장 (예: 높은 레벨 물고기 잡을 시 추가 보너스)