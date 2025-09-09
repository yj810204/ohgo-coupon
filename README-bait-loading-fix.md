# 미끼 개수 표시 버그 수정

## 문제 설명
게임 초기 로딩 시 남은 미끼가 잠깐 20개 보였다가 실제 남은 수가 보이는 현상이 발생했습니다. 예를 들어, 20개가 보였다가 19개로 바뀌는 문제가 있었습니다.

## 원인 분석
이 문제는 다음과 같은 원인으로 발생했습니다:

1. 미끼 개수(`baitCount`)가 초기에 0으로 설정되었지만, Firebase에서 데이터를 가져오는 과정에서 `dailyBaitLimit`이 먼저 업데이트되고 `todayBaitUsed`가 나중에 업데이트되는 경우가 있었습니다.
2. `useEffect` 훅이 `dailyBaitLimit`과 `todayBaitUsed` 값이 변경될 때마다 `baitCount`를 업데이트했기 때문에, 실제 값이 모두 로드되기 전에 중간 상태가 UI에 표시되었습니다.

## 해결 방법
다음과 같은 변경사항을 통해 문제를 해결했습니다:

1. 미끼 로딩 상태를 추적하는 `baitLoading` 상태 변수를 추가했습니다:
   ```javascript
   const [baitLoading, setBaitLoading] = useState(true); // 미끼 개수 로딩 상태
   ```

2. 미끼 개수가 계산되는 `useEffect`를 개선하여 실제 데이터가 로드된 후에만 `baitCount`를 업데이트하도록 했습니다:
   ```javascript
   useEffect(() => {
     // Only update bait count when both values are loaded from Firebase
     if (dailyBaitLimit !== 0 || todayBaitUsed !== 0) {
       setBaitCount(Math.max(0, dailyBaitLimit - todayBaitUsed));
       setBaitLoading(false); // Once bait count is calculated, set loading to false
     }
   }, [dailyBaitLimit, todayBaitUsed]);
   ```

3. UI를 업데이트하여 미끼 개수가 로딩 중일 때 "미끼 정보 로딩 중..." 메시지를 표시하도록 했습니다:
   ```javascript
   {baitLoading
     ? "미끼 정보 로딩 중..."
     : `남은 미끼: ${baitCount}개`}
   ```

4. 미끼 정보가 로딩 중일 때는 시작 버튼과 미끼 교환권 버튼을 비활성화했습니다:
   ```javascript
   const buttonDisabled = baitCount <= 0 || !isTournamentActive || isDateChecking || !isDateValid || isStarting || baitLoading;
   ```
   ```javascript
   disabled={baitLoading}
   ```

5. 미끼 교환권 사용 함수(`handleUseBaitCoupon`)에서도 로딩 상태를 적절히 관리하도록 업데이트했습니다:
   ```javascript
   setBaitLoading(true); // Set loading state while updating
   // ... 상태 업데이트 ...
   setBaitLoading(false); // Clear loading state after update
   ```

## 결과
이러한 변경사항을 통해 게임 초기 로딩 시 미끼 개수가 잘못 표시되는 문제를 해결했습니다. 이제 미끼 정보가 완전히 로드될 때까지 "미끼 정보 로딩 중..." 메시지가 표시되고, 실제 미끼 개수가 확인된 후에만 정확한 개수가 표시됩니다.