# 출석 명부 조회 기능 업데이트

## 변경 내용

`roster-list.tsx` 파일을 수정하여 `attendance` 컬렉션에서 날짜별 문서에 등록된 members 리스트를 불러오도록 변경했습니다.

### 이전 구현

이전에는 모든 사용자를 조회한 후 각 사용자의 boarding 정보가 있는지 확인하는 방식으로 구현되어 있었습니다:

```typescript
// Query all users who have boarding info
const usersQuery = query(collection(db, 'users'));
const userSnapshots = await getDocs(usersQuery);

const rosterData: RosterItem[] = [];

// For each user, check if they have boarding info
for (const userDoc of userSnapshots.docs) {
  const userId = userDoc.id;
  const boardingInfoRef = doc(db, 'users', userId, 'boarding', 'info');
  const boardingInfoSnap = await getDoc(boardingInfoRef);
  
  if (boardingInfoSnap.exists()) {
    const data = boardingInfoSnap.data();
    rosterData.push({
      id: userId,
      name: data.name || '',
      birth: data.birth || '',
      gender: data.gender || '',
      phone: data.phone || '',
      emergency: data.emergency || '',
      address: data.address || '',
    });
  }
}
```

### 새로운 구현

이제는 `attendance` 컬렉션에서 특정 날짜의 문서를 조회하고, 해당 문서에 등록된 members 배열에서 사용자 정보를 불러오는 방식으로 변경되었습니다:

```typescript
// Get the attendance document for the specified date
const attendanceRef = doc(db, 'attendance', String(date));
const attendanceSnap = await getDoc(attendanceRef);

const rosterData: RosterItem[] = [];

// Check if the attendance document exists and has members
if (attendanceSnap.exists() && attendanceSnap.data().members) {
  const memberIds = attendanceSnap.data().members;
  
  // For each member ID in the attendance list
  for (const memberId of memberIds) {
    // Get user's boarding info
    const boardingInfoRef = doc(db, 'users', memberId, 'boarding', 'info');
    const boardingInfoSnap = await getDoc(boardingInfoRef);
    
    if (boardingInfoSnap.exists()) {
      const data = boardingInfoSnap.data();
      rosterData.push({
        id: memberId,
        name: data.name || '',
        birth: data.birth || '',
        gender: data.gender || '',
        phone: data.phone || '',
        emergency: data.emergency || '',
        address: data.address || '',
      });
    }
  }
}
```

## 데이터 구조

`attendance` 컬렉션의 문서 구조:
- 문서 ID: 날짜 (YYYY-MM-DD 형식)
- 문서 내용:
```
{
  date: Timestamp, // 날짜 타임스탬프
  members: Array<string>, // 회원 UUID 배열
  updatedAt: Timestamp // 마지막 업데이트 시간
}
```

## 작동 방식

1. 특정 날짜의 `attendance` 문서를 조회합니다.
2. 문서가 존재하고 `members` 배열이 있는 경우, 각 회원 ID에 대해 boarding 정보를 조회합니다.
3. boarding 정보가 있는 회원만 명부에 표시됩니다.
4. 명부는 이름 순으로 정렬됩니다.

## 주의 사항

- 특정 날짜에 출석한 회원이 없거나 해당 날짜의 문서가 없는 경우 빈 명부가 표시됩니다.
- 출석 명부에 등록된 회원 중 boarding 정보가 없는 회원은 명부에 표시되지 않습니다.