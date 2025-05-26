export default {
  name: '오고피씽',
  slug: 'ohgo-coupon',
  version: '1.1.5',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ohgocoupon',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ohgo.mobile',
    buildNumber: '10015',
    googleServicesFile: './ios/GoogleService-Info.plist', // ✅ Firebase 연동을 위한 추가
    infoPlist: {
      NSCameraUsageDescription:
        '오고피씽은 쿠폰 스캔을 위해 카메라 접근 권한이 필요합니다.',
      NSUserTrackingUsageDescription:
        '오고피씽은 사용자 맞춤형 광고를 제공하기 위해 추적 권한이 필요합니다.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    edgeToEdgeEnabled: true,
    versionCode: 10015,
    package: 'ohgo.mobile',
    googleServicesFile: './google-services.json', // ✅ Firebase 연동을 위한 추가
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