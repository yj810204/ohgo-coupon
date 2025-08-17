// app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { getUserByUUID } from '../utils/firebase-auth';
import { getUser } from '../utils/secure-store';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const localUser = await getUser(); // { uuid, name, dob }
      console.log('🧪 SecureStore user:', localUser); // ✅ 1단계 로그

      if (!localUser?.uuid) {
        console.log('🛑 localUser 없음 → 로그인 화면으로 이동');
        router.replace('/login');
        return;
      }

      const remoteUser = await getUserByUUID(localUser.uuid);
      console.log('🧪 Firestore user:', remoteUser); // ✅ 2단계 로그

      if (remoteUser) {
        console.log('✅ 자동 로그인 성공 →', remoteUser.isAdmin ? '/admin-main' : '/main');
        setChecking(false);
        const route = remoteUser.isAdmin ? '/admin-main' : '/main';
        router.replace({
          pathname: route,
          params: remoteUser,
        });
      } else {
        console.log('🛑 Firestore에 사용자 없음 → 로그인 화면으로 이동');
        setChecking(false);
        router.replace('/login'); // Firestore에 없는 사용자
      }
    };

    checkUser();
  }, []);

  if (checking) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color="#2196F3" style={{ marginBottom: 10 }} />
        <Text style={styles.messageText}>자동 로그인 중...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f9fc', // 필요 시 배경색 조절
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
  },
});