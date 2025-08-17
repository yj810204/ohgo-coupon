# 오고피씽 변경사항 요약 (2025-06-05)

## 🔔 관리자 푸시 기능 추가
- `/admin-push` 화면 추가
  - 제목, 내용 입력 후 전체 사용자에게 푸시 발송
  - 발송 시 Firestore에 저장된 expoPushToken 기준
- 관리자일 경우 헤더 우측에 megaphone 아이콘 버튼 표시
  - `admin-push` 화면에서는 숨김 처리됨

## 🔐 로그인 관련
- 로그인 성공 시 `userInfo`에 `isAdmin` 포함하여 SecureStore 저장
- `index.tsx` 자동 로그인에서도 `isAdmin` 값 기반으로 `/admin` 또는 `/stamp` 라우팅 처리
- 로그인할 때마다 expo push token 갱신되도록 수정

## 🧭 커스텀 헤더 개선
- 타이틀 중앙 정렬 문제 해결
- 좌우 버튼 여백 조정
- settings 화면에서는 설정 아이콘 제거, 알림 버튼 위치 유지

## 🧾 입력/전송 UI 개선
- `KeyboardAvoidingView` 및 `ScrollView`를 활용하여 키보드에 가려지지 않도록 조정
- 버튼 하단 여백 추가로 여유 공간 확보

## 🎨 스타일 통일
- 로그인, 관리자푸시, 스탬프 등 주요 화면 배경색 `#f7f9fc`로 통일
- 로그인 화면 SafeAreaView 추가로 전체 회색 영역 제거

## 🏷 기타
- `stamp.tsx` 화면 내 Floating QR 버튼 위치 보정
- `stamp.tsx` 화면 내 스탬프 모달 및 회수 기능 유지
