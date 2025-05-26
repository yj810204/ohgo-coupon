import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import uuid from 'react-native-uuid';
import { db } from '../firebase';

function normalizeDob(input: string): string | null {
  if (/^\d{6}$/.test(input)) {
    const year = parseInt(input.slice(0, 2), 10);
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    return `${fullYear}${input.slice(2)}`;
  } else if (/^\d{8}$/.test(input)) {
    return input;
  } else {
    return null;
  }
}

export async function loginOrRegisterUser(name: string, dob: string) {
  const normalizedDob = normalizeDob(dob);
  if (!normalizedDob) throw new Error('생년월일 형식이 잘못되었습니다.');

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('name', '==', name), where('dob', '==', normalizedDob));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].data();
  } else {
    const uuidv4 = uuid.v4 as () => string;
    const newUser = {
      uuid: uuidv4(),
      name,
      dob: normalizedDob,
      createdAt: new Date().toISOString(),
      isAdmin: false
    };
    await setDoc(doc(usersRef, newUser.uuid), newUser);
    return newUser;
  }
}

export async function getUserByUUID(uuid: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uuid));
    if (userDoc.exists()) {
      return userDoc.data(); // { name, dob, isAdmin?, uuid, ... }
    }
    return null;
  } catch (error) {
    console.error('❗ Firebase UUID 사용자 조회 실패:', error);
    return null;
  }
}
