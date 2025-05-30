import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendPushToUser } from './send-push';
import { format } from 'date-fns';
import { use } from 'react';
import { Alert } from 'react-native';

/** YYYY-MM-DD 포맷으로 오늘 날짜 반환 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function issue50PercentCoupon(uuid: string): Promise<void> {
  const snap = await getDocs(collection(db, `users/${uuid}/stamps`));
  const stamps = snap.docs.sort((a, b) =>
    (a.data().createdAt?.seconds || 0) - (b.data().createdAt?.seconds || 0)
  );

  if (stamps.length < 5) return;

  const toDelete = stamps.slice(0, 5);
  await Promise.all(toDelete.map(d => deleteDoc(d.ref)));

  const couponRef = collection(db, `users/${uuid}/coupons`);
  await addDoc(couponRef, {
    issuedAt: getTodayDate(),
    reason: '5회 적립 50% 할인',
    used: false,
    isHalf: "Y"
  });
}

/** 스탬프 적립 */
export async function addStamp(uuid: string, method: 'QR' | 'ADMIN' = 'QR'): Promise<void> {
  const userRef = doc(db, 'users', uuid);
  const stampRef = collection(db, `users/${uuid}/stamps`);
  const now = Date.now();

  // ✅ 사용자 문서에서 마지막 적립 시간 확인
  const userSnap = await getDoc(userRef);
  const lastStampTime = userSnap.exists()
    ? userSnap.data()?.lastStampTime?.toMillis?.() ?? 0
    : 0;

  // ✅ QR: 6시간 제한 / ADMIN: 1초 제한
  const LIMIT_MS = method === 'QR' ? 6 * 60 * 60 * 1000 : 1000;

  if (lastStampTime && now - lastStampTime < LIMIT_MS) {
    const nextAvailable = new Date(lastStampTime + LIMIT_MS);
    const hours = nextAvailable.getHours().toString().padStart(2, '0');
    const minutes = nextAvailable.getMinutes().toString().padStart(2, '0');

    throw new Error(`⏱️ 다음 적립은 ${hours}:${minutes} 이후에 가능합니다.\n추가 적립은 선장님께 문의해주세요.`);
  }

  // ✅ 1. 새 스탬프 적립
  const stampData = {
    date: getTodayDate(),
    method,
    timestamp: new Date(),
  };
  await addDoc(stampRef, stampData);

  // ✅ 2. 사용자 정보에 마지막 적립 시간 업데이트
  await updateDoc(userRef, {
    lastStampTime: stampData.timestamp,
  });

  // ✅ 3. 스탬프 수 확인
  const snapshotAfter = await getDocs(stampRef);
  const totalCount = snapshotAfter.size;

  // ✅ 4. 조건 충족 시 쿠폰 발급
  if (totalCount >= 10) {
    await issueCoupon(uuid);
    await clearStamps(uuid);

    console.log('쿠폰 발급 완료:', uuid);
    await sendPushToUser({
      uuid,
      title: '쿠폰이 발급되었습니다~! 🎁',
      body: '스탬프 10개 도달! 쿠폰이 발급되었어요~!',
      data: {
        screen: 'coupons',
        uuid,
      },
    });
  }
}

/** 스탬프 목록 조회 */
export async function getStamps(uuid: string): Promise<string[]> {
  const stampRef = collection(db, `users/${uuid}/stamps`);
  const snapshot = await getDocs(stampRef);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const ts = data.timestamp?.toDate?.();
    const method = data.method || '알 수 없음';

    if (ts instanceof Date) {
      // 목록에선 일단 날짜만 전달 (모달에서 full 시간 표시)
      const ymd = format(ts, 'yy-MM-dd');
      const hms = format(ts, 'HH:mm:ss');
      return `${ymd}|${method}|${hms}`; // 시:분:초는 숨겨져 있다가 모달에서만 사용
    }

    return `-|${method}|-`;
  });
}


/** 쿠폰 발급 */
export async function issueCoupon(uuid: string): Promise<void> {
  const couponRef = collection(db, `users/${uuid}/coupons`);
  await addDoc(couponRef, {
    issuedAt: getTodayDate(),
    reason: '10회 적립 100% 할인',
    used: false,
    isHalf: "N",
  });
}

/** 스탬프 모두 삭제 */
export async function clearStamps(uuid: string): Promise<void> {
  const stampRef = collection(db, `users/${uuid}/stamps`);
  const snapshot = await getDocs(stampRef);
  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
  }
}

/** 발급된 쿠폰 수 조회 */
export async function getCouponCount(uuid: string): Promise<number> {
  const couponRef = collection(db, `users/${uuid}/coupons`);
  const q = query(couponRef, where('used', '==', false)); // ✅ 사용 안 한 쿠폰만
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/** 유저 전체 삭제: 문서 + 하위 컬렉션 */
export async function deleteUser(uuid: string): Promise<void> {
  const userRef = doc(db, 'users', uuid);

  // 1. stamps 삭제
  const stampsRef = collection(db, `users/${uuid}/stamps`);
  const stampsSnap = await getDocs(stampsRef);
  for (const docSnap of stampsSnap.docs) {
    await deleteDoc(docSnap.ref);
  }

  // 2. coupons 삭제
  const couponsRef = collection(db, `users/${uuid}/coupons`);
  const couponsSnap = await getDocs(couponsRef);
  for (const docSnap of couponsSnap.docs) {
    await deleteDoc(docSnap.ref);
  }

  // 3. 사용자 문서 삭제
  await deleteDoc(userRef);
}

export async function useOneCoupon(uuid: string): Promise<void> {
  const couponRef = collection(db, `users/${uuid}/coupons`);
  const q = query(couponRef, where('used', '==', false), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) throw new Error('사용 가능한 쿠폰이 없습니다.');

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  if (data.isHalf === 'Y') {
    throw new Error('즉시 쿠폰 사용 불가 (50% 쿠폰 보유)\n직접 쿠폰을 선택해주세요.');
  }

  await updateDoc(docSnap.ref, { used: true });
}

/**
 * 사용자 스탬프 중 정확한 timestamp (date|method|time) 일치하는 문서를 삭제
 */
export async function deleteStamp(uuid: string, value: string, p0: string, p1: string) {
  const [date, method, time] = value.split('|');
  if (!date || !method || !time) {
    console.warn('❗ 잘못된 스탬프 문자열 형식:', value);
    return;
  }

  // 비교용 Date 객체 만들기
  const parsed = new Date(`20${date}T${time}`);
  if (isNaN(parsed.getTime())) {
    console.warn('❗ timestamp 변환 실패:', date, time);
    return;
  }

  const ref = collection(db, `users/${uuid}/stamps`);
  const snap = await getDocs(ref);

  for (const doc of snap.docs) {
    const data = doc.data();
    const docTimestamp = data.timestamp?.toDate?.();

    const sameTime =
      docTimestamp instanceof Date &&
      Math.abs(docTimestamp.getTime() - parsed.getTime()) < 1000; // 1초 허용

    if (data.method === method && sameTime) {
      console.log('🧹 삭제할 문서 ID:', doc.id);
      await deleteDoc(doc.ref);
      
      // ✅ 푸시 알림 전송
      await sendPushToUser({
        uuid,
        title: '스탬프가 회수되었습니다.',
        body: `${date} ${time} 스탬프 1개가 관리자에 의해 회수되었습니다.`,
        data: {
          screen: 'stamp',
          uuid
        },
      });

      console.log('✅ 스탬프 삭제 및 푸시 완료');
      return;
    }
  }

  console.warn('❌ 일치하는 스탬프 문서 없음:', value);
}
