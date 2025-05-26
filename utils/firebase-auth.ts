import {
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { v5 as uuidv5 } from 'uuid';
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

// 🔐 고정된 UUID 생성용 네임스페이스 (절대 바꾸지 말 것)
const UUID_NAMESPACE = '7b6a5c20-7aef-11ee-b962-0242ac120002';

export async function loginOrRegisterUser(name: string, dob: string) {
  const normalizedDob = normalizeDob(dob);
  if (!normalizedDob) throw new Error('생년월일 형식이 잘못되었습니다.');

  // 🔄 항상 같은 UUID 생성
  const deterministicUUID = uuidv5(`${name}-${normalizedDob}`, UUID_NAMESPACE);
  const userRef = doc(db, 'users', deterministicUUID);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return {
      ...userSnap.data(),
      uuid: deterministicUUID,
      isNew: false
    };
  } else {
    const newUser = {
      uuid: deterministicUUID,
      name,
      dob: normalizedDob,
      createdAt: new Date().toISOString(),
      isAdmin: false
    };
    await setDoc(userRef, newUser);
    return {
      ...newUser,
      isNew: true,
    };
  }
}

export async function getUserByUUID(uuid: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uuid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('❗ Firebase UUID 사용자 조회 실패:', error);
    return null;
  }
}
