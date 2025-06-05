## 🚀 주요 업데이트 요약

### ✨ 승선 정보 입력 기능 추가

* 입력 항목:

  * 이름, 생년월일 (📆 날짜 선택)
  * 성별 (모달 선택)
  * 연락처, 비상 연락처 (📱 자동 하이픈 포맷)
  * 주소
  * ✅ 개인정보 수집 및 제3자 제공 동의 체크박스
* Firestore 저장 구조:

  * `users/{uuid}/boarding/info` 경로에 저장
  * `getUser()`를 통해 SecureStore의 uuid 기반으로 저장/불러오기 처리
* 저장 시 모든 항목 유효성 검사 수행
* 기존 정보가 있을 경우 자동으로 불러와 채워짐


### 📍 QR 스탬프 적립 – GPS 거리 제한 도입

* QR 코드 스캔 시 현재 위치를 Firestore 기준 위치와 비교
* `Location.getLastKnownPositionAsync()` → 실패 시 `getCurrentPositionAsync()` fallback
* `accuracy: Low` 설정으로 빠른 응답
* 거리 초과 시 스탬프 적립 제한 및 경고 메시지 표시


### 🎨 UI 및 UX 개선

* `GiantRegular` 폰트 전역 적용
* `KeyboardAvoidingView` 및 `ScrollView` 조합으로 키보드 가림 문제 해결
* 입력 시 자동 스크롤 보정 처리로 Android에서도 안정적인 포커스 유지
* 생년월일 iOS 확인 버튼 및 Android 자동 반영 처리
