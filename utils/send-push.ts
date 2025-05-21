import { doc, getDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { db } from '../firebase';

export const sendPushToUser = async ({
  uuid,
  title,
  body,
  data = {}
}: {
  uuid: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}) => {
  try {
    const snap = await getDoc(doc(db, 'users', uuid));

    if (!snap.exists()) {
      console.warn('회원 없음:', uuid);
      Alert.alert('오류', '회원 정보를 찾을 수 없습니다.');
      return;
    }

    const expoPushToken = snap.data().expoPushToken;
    if (!expoPushToken) {
      console.warn('❗푸시 토큰 없음:', uuid);
      Alert.alert('푸시 실패', '해당 회원에게 저장된 푸시 토큰이 없습니다.');
      return;
    }

    const payload = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    console.log('푸시 페이로드:', payload);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('푸시 응답 상태:', response.status);
    const text = await response.text();
    console.log('푸시 응답 본문:', text);

    if (response.ok) {
    //   Alert.alert('전송 완료', '푸시 메시지를 성공적으로 전송했습니다.');
    } else {
      Alert.alert('푸시 실패', 'Expo 서버에서 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('푸시 전송 에러:', error);
    Alert.alert('푸시 실패', '알 수 없는 오류');
  }
};
