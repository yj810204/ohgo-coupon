export default {
  name: '오고피씽',
  slug: 'ohgo-coupon',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ohgocoupon',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ohgo.mobile',
    buildNumber: '10011',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#000000',
    },
    edgeToEdgeEnabled: true,
    versionCode: 10011,
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
