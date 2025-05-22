import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider, useNavigation } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { canGoBack } from 'expo-router/build/global-state/routing';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

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
        <Stack
          screenOptions={({ route }) => ({
            header: () => (
              <CustomHeader title={getTitle(route?.name)} routeName={route.name} />
            ),
          })}
        >
        <Stack.Screen name="login" />
        <Stack.Screen name="stamp" />
        <Stack.Screen name="coupons" />
        <Stack.Screen name="qr-scan" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="member-detail" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      <ExpoStatusBar style="auto" />
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
    height: 96,
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,

    // ✅ 안드로이드 상태바 높이만큼 padding
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
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
});