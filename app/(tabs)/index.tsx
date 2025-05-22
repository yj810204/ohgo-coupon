// app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getUserByUUID } from '../../utils/firebase-auth';
import { getUser } from '../../utils/secure-store';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const localUser = await getUser(); // { uuid, name, dob }

      if (!localUser?.uuid) {
        router.replace('/login');
        return;
      }

      const remoteUser = await getUserByUUID(localUser.uuid);

      if (remoteUser) {
        const route = remoteUser.isAdmin ? '/admin' : '/stamp';
        router.replace({
          pathname: route,
          params: remoteUser,
        });
      } else {
        router.replace('/login'); // Firestore에 없는 사용자
      }

      setChecking(false);
    };

    checkUser();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text>자동 로그인 중...</Text>
      </View>
    );
  }

  return null;
}