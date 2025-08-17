import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * role이 'captain'인 사용자 목록 조회
 */
export const findCaptains = async (): Promise<
  { uuid: string; name: string; expoPushToken?: string }[]
> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'captain'));

    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
      uuid: doc.id,
      name: doc.data().name,
      expoPushToken: doc.data().expoPushToken,
    }));
  } catch (e) {
    console.error('캡틴 조회 실패:', e);
    return [];
  }
};
