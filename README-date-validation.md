# 날짜 검증 기능 구현

## 기능 설명
게임 첫 화면 진입시 디바이스의 날짜와 서버의 날짜가 다르면 경고창을 표시하고 시작 버튼을 비활성화하는 기능을 구현했습니다.

## 구현 내용

### 1. 서버 날짜 가져오기
Firebase의 `serverTimestamp()` 함수를 사용하여 서버의 현재 날짜를 가져오는 기능을 구현했습니다.

```javascript
async function getServerDate() {
  try {
    // 서버 타임스탬프 문서 생성 또는 업데이트
    const timestampRef = doc(db, 'system', 'timestamp');
    await setDoc(timestampRef, { timestamp: serverTimestamp() }, { merge: true });
    
    // 서버 타임스탬프 문서 가져오기
    const timestampDoc = await getDoc(timestampRef);
    if (timestampDoc.exists() && timestampDoc.data().timestamp) {
      const serverTimestampData = timestampDoc.data().timestamp.toDate();
      // 한국 시간으로 변환 (+9시간)
      serverTimestampData.setHours(serverTimestampData.getHours() + 9);
      return serverTimestampData.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error('서버 날짜 가져오기 오류:', error);
  }
  
  // 오류 발생 시 로컬 날짜 반환
  return todayStr();
}
```

### 2. 날짜 비교 로직
컴포넌트 마운트 시 서버 날짜와 디바이스 날짜를 비교하는 로직을 구현했습니다.

```javascript
// 날짜 검증 관련 상태
const [serverDate, setServerDate] = useState<string>('');
const [isDateValid, setIsDateValid] = useState<boolean>(true);
const [isDateChecking, setIsDateChecking] = useState<boolean>(true);

// 서버 날짜와 디바이스 날짜 비교
useEffect(() => {
  if (!uuid) return;
  
  const checkDateValidity = async () => {
    setIsDateChecking(true);
    try {
      // 서버 날짜 가져오기
      const sDate = await getServerDate();
      setServerDate(sDate);
      
      // 디바이스 날짜 가져오기
      const dDate = todayStr();
      
      // 날짜 비교
      const isValid = sDate === dDate;
      setIsDateValid(isValid);
      
      if (!isValid) {
        console.log('날짜 불일치 감지: 서버 날짜 =', sDate, '디바이스 날짜 =', dDate);
      }
    } catch (error) {
      console.error('날짜 검증 오류:', error);
      // 오류 발생 시 유효하다고 간주 (사용자 경험 저하 방지)
      setIsDateValid(true);
    } finally {
      setIsDateChecking(false);
    }
  };
  
  checkDateValidity();
}, [uuid]);
```

### 3. 경고창 표시
날짜가 일치하지 않을 경우 경고창을 표시하는 로직을 구현했습니다.

```javascript
// 날짜 불일치 시 경고 표시
useEffect(() => {
  if (!isDateChecking && !isDateValid) {
    Alert.alert(
      '날짜 불일치 감지',
      '디바이스의 날짜와 서버의 날짜가 일치하지 않습니다. 디바이스의 날짜와 시간 설정을 확인해주세요.',
      [{ text: '확인', style: 'default' }]
    );
  }
}, [isDateChecking, isDateValid]);
```

### 4. 시작 버튼 비활성화
날짜가 일치하지 않을 경우 시작 버튼을 비활성화하고, 버튼 텍스트를 변경하는 로직을 구현했습니다.

```javascript
// 날짜 검증 중이거나 날짜가 유효하지 않으면 버튼 비활성화
const buttonDisabled = baitCount <= 0 || !isTournamentActive || isDateChecking || !isDateValid;

// 버튼 텍스트 변경
<Text style={styles.baitCountText}>
  {isDateChecking 
    ? "날짜 확인 중..." 
    : !isDateValid 
      ? "날짜 설정을 확인해주세요." 
      : isTournamentActive
        ? `남은 미끼: ${baitCount}개`
        : "이벤트 기간이 아닙니다."}
</Text>
```

### 5. 게임 시작 시 날짜 검증
게임 시작 함수에서도 날짜 유효성을 검사하여 날짜가 일치하지 않을 경우 게임을 시작하지 못하도록 구현했습니다.

```javascript
async function startFishing() {
  // ... 기존 코드 ...
  
  // 날짜 유효성 검사
  if (!isDateValid) {
    Alert.alert(
      '날짜 불일치',
      '디바이스의 날짜와 서버의 날짜가 일치하지 않아 게임을 시작할 수 없습니다. 디바이스의 날짜와 시간 설정을 확인해주세요.',
      [{ text: '확인', style: 'default' }]
    );
    return;
  }
  
  // ... 기존 코드 ...
}
```

## 작동 방식
1. 게임 화면에 진입하면 서버 날짜와 디바이스 날짜를 비교합니다.
2. 날짜가 일치하지 않으면 경고창을 표시하고 시작 버튼을 비활성화합니다.
3. 시작 버튼 아래에 "날짜 설정을 확인해주세요." 메시지를 표시합니다.
4. 사용자가 디바이스의 날짜 설정을 수정한 후 앱을 다시 실행하면 정상적으로 게임을 시작할 수 있습니다.

## 주의사항
- 서버 날짜를 가져오는 과정에서 네트워크 오류가 발생할 경우, 사용자 경험 저하를 방지하기 위해 디바이스 날짜를 유효하다고 간주합니다.
- 날짜 비교는 YYYY-MM-DD 형식의 문자열로 변환하여 수행하므로, 시간대 차이로 인한 오차는 발생하지 않습니다.