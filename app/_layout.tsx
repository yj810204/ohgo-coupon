import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider, useNavigation } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { canGoBack } from 'expo-router/build/global-state/routing';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context'; // 설치 필요
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import Constants from 'expo-constants';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';

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

  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ 푸시 클릭 이벤트 리스너 등록
  useEffect(() => {

    const fetchUserInfo = async () => {
      try {
        const userRaw = await SecureStore.getItemAsync('userInfo');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          const snap = await getDoc(doc(db, 'users', user.uuid));
          if (snap.exists() && snap.data().isAdmin) {
            setIsAdmin(true);
          }
        }
      } catch (e) {
        console.warn('관리자 여부 확인 실패:', e);
      }
    };

    fetchUserInfo(); // ✅ 관리자 확인 추가
    checkAppVersion(); // 앱 버전 체크

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

      if (data?.screen === 'main') {
        router.push({
          pathname: '/main',
          params: {
            uuid: typeof data.uuid === 'string' ? data.uuid : '',
            name: typeof data.name === 'string' ? data.name : '',
            dob: typeof data.dob === 'string' || typeof data.dob === 'number'
              ? String(data.dob)
              : '',
          },
        });
      } else if (data?.screen === 'stamp') {
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
      } else if (data?.screen === 'admin-main') {
        router.push({
          pathname: '/admin-main',
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
      <ActionSheetProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <Stack
            key={`stack-${isAdmin}`}
            screenOptions={({ route }) => ({
              header: () => (
                <CustomHeader
                  title={getTitle(route?.name)}
                  routeName={route.name}
                  isAdmin={isAdmin} // ✅ isAdmin 전달
                />
              ),
            })}
          >
            <Stack.Screen name="index" />

            <Stack.Screen name="+not-found" />
            <Stack.Screen name="admin-push" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="admin-main" />
            <Stack.Screen name="boarding-form" />
            <Stack.Screen name="coupons" />

            <Stack.Screen name="login" />
            <Stack.Screen name="logs" />
            <Stack.Screen name="member-detail" />
            <Stack.Screen name="memo" />
            <Stack.Screen name="notification-history" />
            <Stack.Screen name="qr-scan" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="stamp-history" />
            <Stack.Screen name="stamp" />

            <Stack.Screen name="mini-games/fishing" />
            <Stack.Screen name="mini-games/ranking" />
            <Stack.Screen name="today-roster" />
            <Stack.Screen name="roster-list" />
          </Stack>
          <ExpoStatusBar style="auto" />
        </SafeAreaView>
      </ActionSheetProvider>
    </ThemeProvider>
  );

  function getTitle(routeName?: string): string {
    const titles: Record<string, string> = {
      'main': 'Home',
      'admin-push': 'Notification',
      'admin': 'Admin',
      'admin-main': 'Admin',
      'boarding-form': 'Boarding',
      'coupons': 'Coupons',
      'index': 'Oh-Go Fishing',
      'login': 'Oh-Go Fishing',
      'logs': 'Logs',
      'member-detail': 'Detail',
      'memo': 'Memo',
      'notification-history': 'History',
      'qr-scan': 'QR Scan',
      'settings': 'Settings',
      'stamp-history': 'History',
      'stamp': 'Stamps',
      'mini-games/fishing': 'Game',
      'mini-games/ranking': 'Ranking',
      'admin-fish': 'Fishes',
      'admin-fish-add': 'New Fish',
      'admin-fish-edit': 'Edit Fish',
      'admin-game-settings': 'Game',
      'today-roster': '승선 명부',
      'roster-list': '승선 명부',
      'location-time-selection': '승선 명부',
    };
    return titles[routeName ?? ''] ?? '';
  }

  type CustomHeaderProps = {
    title: string;
    routeName: string;
    isAdmin?: boolean; // ✅ isAdmin prop 추가
  };

  function CustomHeader({ title, routeName, isAdmin }: CustomHeaderProps) {
    const navigation = useNavigation();

    const handleAddNewFish = () => {
      router.push('/admin-fish-add');
    };

    return (
      <View style={styles.header}>
        {/* 왼쪽 뒤로가기 버튼 */}
        <View style={styles.sideBtn}>
          {canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>

        {/* 중앙 타이틀 */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        {/* 오른쪽 버튼 영역 */}
        <View style={styles.sideBtnRight}>

        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 24,
    color: '#fff',
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
  header: {
    height: 50,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  sideBtn: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sideBtnRight: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // ✅ 알림 버튼을 오른쪽으로 밀기
  },
  addFishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addFishButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 2,
    fontFamily: 'GiantRegular',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontFamily: 'GiantInline',
  },
});