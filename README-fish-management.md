# 물고기 관리 기능 문서

## 개요

이 문서는 오고 피씽 앱의 물고기 관리 기능에 대한 설명입니다. 물고기 정보는 Firebase Firestore에 저장되며, 물고기 이미지는 Firebase Storage에 저장됩니다. 관리자 페이지를 통해 물고기 정보를 등록, 수정, 삭제할 수 있습니다.

## 기능

1. 물고기 정보 관리 (추가, 수정, 삭제)
2. 물고기 이미지 업로드 및 관리
3. Firebase Storage를 통한 이미지 저장
4. 앱 업데이트 없이 물고기 정보 변경 가능

## 데이터 구조

### Firestore 컬렉션: `fishes`

각 물고기 문서는 다음 필드를 포함합니다:

- `name`: 물고기 이름 (string)
- `point`: 획득 포인트 (number)
- `description`: 물고기 설명 (string, 선택사항)
- `img`: 이미지 URL (string, 선택사항)
- `createdAt`: 생성 시간 (ISO string)
- `updatedAt`: 수정 시간 (ISO string, 선택사항)

### Firebase Storage

물고기 이미지는 다음 경로에 저장됩니다:
- 경로: `fishes/{fish_id}`
- 각 물고기 ID에 해당하는 이미지 파일이 저장됩니다.

## 관리자 페이지 사용법

### 물고기 관리 페이지 접근

1. 관리자 메인 페이지에서 "물고기 관리" 메뉴를 선택합니다.
2. 물고기 목록이 표시됩니다.

### 새 물고기 추가

1. "새 물고기" 버튼을 클릭합니다.
2. 물고기 정보 입력 폼이 나타납니다.
3. 필수 정보(이름, 포인트)를 입력합니다.
4. 선택적으로 구역, 설명, 이미지를 추가할 수 있습니다.
5. "추가하기" 버튼을 클릭하여 저장합니다.

### 물고기 정보 수정

1. 물고기 목록에서 수정하려는 물고기의 수정(연필) 아이콘을 클릭합니다.
2. 물고기 정보 수정 폼이 나타납니다.
3. 원하는 정보를 수정합니다.
4. "수정하기" 버튼을 클릭하여 저장합니다.

### 물고기 삭제

1. 물고기 목록에서 삭제하려는 물고기의 삭제(휴지통) 아이콘을 클릭합니다.
2. 확인 대화상자가 나타납니다.
3. "삭제" 버튼을 클릭하여 물고기를 삭제합니다.

### 이미지 업로드

1. 물고기 추가/수정 폼에서 이미지 선택 영역을 클릭합니다.
2. 기기의 갤러리에서 이미지를 선택합니다.
3. 이미지는 물고기 정보 저장 시 함께 업로드됩니다.

## 기술적 구현

### Firebase Storage 통합

Firebase Storage는 물고기 이미지를 저장하는 데 사용됩니다. 이미지는 각 물고기의 ID를 사용하여 저장되며, 다운로드 URL이 Firestore 문서에 저장됩니다.

```javascript
// 이미지 업로드 예시
const imageRef = ref(storage, `fishes/${fishId}`);
await uploadBytes(imageRef, blob);
const downloadURL = await getDownloadURL(imageRef);
```

### 물고기 데이터 모델

물고기 데이터는 다음과 같은 인터페이스를 따릅니다:

```typescript
interface Fish {
  id: string;
  name: string;
  point: number;
  img?: string;
  description?: string;
}
```

### 낚시 게임 통합

낚시 게임은 Firestore에서 물고기 정보를 가져와 사용합니다. 물고기 이미지가 있는 경우 해당 이미지를 표시하고, 없는 경우 기본 이미지를 사용합니다.

```jsx
<Image 
  source={fish.img ? { uri: fish.img } : require('../../assets/fishing/fish-shadow.png')}
  style={styles.fishImage}
  resizeMode="contain"
/>
```

## 주의사항

1. 이미지 크기: 업로드하는 이미지는 적절한 크기로 조정됩니다. 너무 큰 이미지는 성능에 영향을 줄 수 있습니다.
2. 권한: 이미지 업로드를 위해 갤러리 접근 권한이 필요합니다.
3. 네트워크: 이미지 업로드 및 다운로드는 네트워크 연결이 필요합니다.

## 향후 개선 사항

1. 이미지 압축 및 최적화
2. 물고기 카테고리 추가
3. 물고기 희귀도 설정
4. 통계 기능 추가 (가장 많이 잡힌 물고기 등)