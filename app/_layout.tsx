import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider, useNavigation } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { canGoBack } from 'expo-router/build/global-state/routing';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, Linking, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context'; // 설치 필요
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import Constants from 'expo-constants';

Notifications.addNotificationReceivedListener(async (notification) => {
  const title = notification.request.content.title || '';
  const body = notification.request.content.body || '';
  const log = {
    title,
    body,
    time: new Date().toISOString(),
  };

  const raw = await SecureStore.getItemAsync('notificationHistory');
  const history = raw ? JSON.parse(raw) : [];
  history.unshift(log);

  // 최근 50개만 유지
  if (history.length > 50) history.pop();

  await SecureStore.setItemAsync('notificationHistory', JSON.stringify(history));
});


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,     // 🔔 포그라운드에서도 알림 배너 표시
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function compareVersions(v1: string, v2: string): number {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkAppVersion() {
  const currentVersion = Constants.expoConfig?.version || '0.0.0';

  try {
    const snap = await getDoc(doc(db, 'config', 'appVersion'));
    if (!snap.exists()) return;

    const { minRequired, iosUrl, androidUrl } = snap.data();

    if (compareVersions(currentVersion, minRequired) < 0) {
      Alert.alert(
        '업데이트 필요',
        '오고피씽의 새 버전이 출시되었습니다.\n더 나은 서비스 이용을 위해 지금 업데이트해 주세요.',
        [
          {
            text: '업데이트',
            onPress: () => {
              const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
              Linking.openURL(url);
            },
          },
        ],
        { cancelable: false }
      );
    }
  } catch (e) {
    console.warn('버전 체크 실패:', e);
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    GiantBold: require('../assets/fonts/Giants-Bold.ttf'),
    GiantInline: require('../assets/fonts/Giants-Inline.ttf'),
    GiantRegular: require('../assets/fonts/Giants-Regular.ttf'),
  });

  // ✅ 푸시 클릭 이벤트 리스너 등록
  useEffect(() => {
    checkAppVersion();
    
    const requestNotificationPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        console.log('📛 푸시 권한 요청 결과:', newStatus);
      } else {
        console.log('✅ 푸시 권한 이미 허용됨');
      }
    };
  
    requestNotificationPermission();

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('📩 푸시 클릭됨:', data);
  
      if (data?.screen === 'stamp') {
        router.push({
          pathname: '/stamp',
          params: {
            uuid: typeof data.uuid === 'string' ? data.uuid : '',
            name: typeof data.name === 'string' ? data.name : '',
            dob: typeof data.dob === 'string' || typeof data.dob === 'number'
              ? String(data.dob)
              : '',
          },
        });
      } else if (data?.screen === 'coupons') {
        router.push({
          pathname: '/coupons',
          params: {
            uuid: typeof data.uuid === 'string' ? data.uuid : '',
            name: typeof data.name === 'string' ? data.name : '',
            dob: typeof data.dob === 'string' || typeof data.dob === 'number'
              ? String(data.dob)
              : '',
          },
        });
      } else if (data?.screen === 'member-detail') {
        router.push({
          pathname: '/member-detail',
          params: {
            uuid: typeof data.uuid === 'string' ? data.uuid : '',
            name: typeof data.name === 'string' ? data.name : '',
            dob: typeof data.dob === 'string' || typeof data.dob === 'number'
              ? String(data.dob)
              : '',
          },
        });
      } else if (data?.screen === 'admin') {
        router.push({
          pathname: '/admin',
          params: {
            uuid: typeof data.uuid === 'string' ? data.uuid : '',
            name: typeof data.name === 'string' ? data.name : '',
            dob: typeof data.dob === 'string' || typeof data.dob === 'number'
              ? String(data.dob)
              : '',
          },
        });
      } else {
        console.warn('❗ 알 수 없는 screen 값:', data?.screen);
      }
    });
  
    return () => subscription.remove();
  }, []);  

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Stack
          screenOptions={({ route }) => ({
            header: () => (
              <CustomHeader title={getTitle(route?.name)} routeName={route.name} />
            ),
          })}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="stamp" />
          <Stack.Screen name="coupons" />
          <Stack.Screen name="qr-scan" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="member-detail" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <ExpoStatusBar style="auto" />
      </SafeAreaView>
    </ThemeProvider>
  );
  
  function getTitle(routeName: string | undefined): string {
    switch (routeName) {
      case 'login':
        return 'Oh-go Fishing';
      case 'stamp':
        return 'Stamps';
      case 'coupons':
        return 'Coupons';
      case 'qr-scan':
        return 'QR Scan';
      case 'admin':
        return 'Admin';
      case 'member-detail':
        return 'Admin';
      case 'settings':
        return 'Settings';
      case 'logs':
        return 'Logs';
      case 'notification-history':
        return 'History';
      case 'boarding-form':
        return 'Boarding';
      default:
        return '';
    }
  }
  
  type CustomHeaderProps = {
    title: string;
    routeName: string;
  };
  
  function CustomHeader({ title, routeName }: CustomHeaderProps) {
    const navigation = useNavigation();
  
    return (
      <View style={styles.header}>
        {canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
  
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
  
        {!['login', 'settings'].includes(routeName) ? (
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.rightBtn}>
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.rightBtn} />
        )}
      </View>
    );
  }  
}

const styles = StyleSheet.create({
  header: {
    height: 50,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,

    // ✅ 안드로이드 상태바 높이만큼 padding
    //paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
  },
  backBtn: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 24,
    color: '#fff',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontFamily: 'GiantInline',
  },
  rightBtn: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
});