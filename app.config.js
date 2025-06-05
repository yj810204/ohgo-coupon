export default {
  name: '오고피씽',
  slug: 'ohgo-coupon',
  version: '1.2.8',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ohgocoupon',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ohgo.mobile',
    buildNumber: '10028',
    googleServicesFile: './ios/GoogleService-Info.plist', // ✅ Firebase 연동을 위한 추가
    infoPlist: {
      NSCameraUsageDescription:
        'QR 스캔을 위해 카메라 접근 권한이 필요합니다.',
      NSUserTrackingUsageDescription:
        '사용자 맞춤형 광고를 제공하기 위해 추적 권한이 필요합니다.',
      NSLocationWhenInUseUsageDescription:
        '스탬프 적립을 위한 QR 스캔을 위해 사용자의 위치 정보 접근 권한이 필요합니다.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        '스탬프 적립을 위한 QR 스캔 기능을 원활히 사용하려면 위치 접근 권한이 필요합니다.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    edgeToEdgeEnabled: true,
    versionCode: 10028,
    package: 'ohgo.mobile',
    googleServicesFile: './google-services.json', // ✅ Firebase 연동을 위한 추가
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA' // QR 스캔이 포함될 경우 추가 권장
    ]
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
    'expo-secure-store',
    'expo-notifications', // ✅ 푸시 알림을 위한 필수 플러그인
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '05bd1472-c27d-4c9f-b1db-2f66e714d925',
    },
  },
  owner: 'jyn0204',
};