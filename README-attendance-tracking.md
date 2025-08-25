# 출석 명부 기능 구현

## 구현 내용

QR 코드 스캔 시 회원의 출석 명부를 기록하는 기능을 구현했습니다.

### 요구사항

1. 파이어베이스에 명부 리스트 컬렉션 추가
2. 날짜별 문서 추가
3. 해당 날짜에 QR 스캔시 해당 회원의 작성된 명부가 리스트로 추가

### 구현 방법

1. **파이어베이스 명부 컬렉션 구조**
   - 컬렉션 이름: `attendance`
   - 문서 ID: 날짜 (YYYY-MM-DD 형식)
   - 문서 구조:
     ```javascript
     {
       date: Timestamp, // 날짜 타임스탬프
       members: Array<string>, // 회원 UUID 배열
       updatedAt: Timestamp // 마지막 업데이트 시간
     }
     ```

2. **구현 로직**
   - QR 코드 스캔 시 회원 정보 확인
   - 회원 정보가 존재하면 현재 날짜의 출석 명부에 회원 UUID 추가
   - 해당 날짜의 문서가 없으면 자동으로 생성

3. **주요 변경 사항**
   - `addMemberToAttendanceList` 함수 추가: 회원을 출석 명부에 추가하는 기능
   - QR 스캔 처리 로직에 출석 명부 추가 기능 통합

## 코드 설명

### 1. 필요한 Firebase 기능 import 추가

```typescript
import { doc, getDoc, updateDoc, increment, collection, setDoc, arrayUnion, Timestamp } from 'firebase/firestore';
```

### 2. 출석 명부 추가 함수 구현

```typescript
// ✅ 출석 명부에 회원 추가
const addMemberToAttendanceList = async (uuid: string | string[]) => {
  try {
    // 현재 날짜 구하기 (YYYY-MM-DD 형식)
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    // 회원 정보 확인
    const userRef = doc(db, 'users', String(uuid));
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log('회원 정보가 존재하지 않습니다.');
      return false;
    }
    
    // 명부 컬렉션 참조
    const attendanceRef = doc(db, 'attendance', dateString);
    
    // 해당 날짜의 문서가 있는지 확인하고 없으면 생성
    await setDoc(
      attendanceRef, 
      { 
        date: Timestamp.fromDate(today),
        members: arrayUnion(String(uuid)),
        updatedAt: Timestamp.now()
      }, 
      { merge: true }
    );
    
    console.log('출석 명부에 회원이 추가되었습니다.');
    return true;
  } catch (error) {
    console.error('출석 명부 추가 오류:', error);
    return false;
  }
};
```

### 3. QR 스캔 처리 로직에 통합

```typescript
// 출석 명부에 회원 추가
try {
  await addMemberToAttendanceList(uuid);
} catch (error) {
  console.error('출석 명부 추가 오류:', error);
}
```

## 사용 방법

1. 회원이 QR 코드를 스캔하면 자동으로 출석 명부에 추가됩니다.
2. Firebase Firestore의 `attendance` 컬렉션에서 날짜별 출석 명부를 확인할 수 있습니다.
3. 각 날짜 문서에는 해당 날짜에 QR 코드를 스캔한 회원의 UUID 목록이 포함되어 있습니다.

## 주의 사항

- 회원 정보가 존재하지 않는 경우 출석 명부에 추가되지 않습니다.
- 이미 해당 날짜에 출석한 회원이 다시 QR 코드를 스캔해도 중복으로 추가되지 않습니다 (Firebase의 `arrayUnion` 기능 사용).