import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, increment, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocalSearchParams } from 'expo-router';

const { width } = Dimensions.get('window');
type GameState = 'idle' | 'casting' | 'waiting' | 'bite' | 'reel' | 'result';
const BITE_TIMEOUT = 2000;
const INITIAL_DISTANCE = 10;
const REEL_TIME_LIMIT = 13000; // ms (ex. 13초, 필요시 하드코딩/DB값)

function todayStr() {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  return date.toISOString().split('T')[0];
}

export default function FishingGame() {
  const { uuid, name, dob } = useLocalSearchParams<{
    uuid: string;
    name: string;
    dob: string;
  }>();

  // ... state 정의(동일, 위 코드 참고) ...
  const [fishes, setFishes] = useState<any[]>([]); // 물고기 데이터
  const [fishLoading, setFishLoading] = useState(true); // 물고기 데이터 로딩 상태
  const [dailyBaitLimit, setDailyBaitLimit] = useState(5); // 하루 미끼 제한 개수
  const [todayBaitUsed, setTodayBaitUsed] = useState(0); // 오늘 사용한 미끼 개수

  const [state, setState] = useState<GameState>('idle'); // 게임 상태
  const [baitCount, setBaitCount] = useState<number>(0); // 남은 미끼 개수
  const [fish, setFish] = useState<any>(null); // 현재 잡은 물고기 정보
  const [showResult, setShowResult] = useState(false); // 결과 화면 표시 여부
  const [resultText, setResultText] = useState(''); // 결과 메시지
  const [isSaving, setIsSaving] = useState(false); // 포인트 저장 중 여부
  const [biteDuration, setBiteDuration] = useState(BITE_TIMEOUT); // 입질 타이머 지속 시간
  const [gaugeSpeed, setGaugeSpeed] = useState(500); // ms, 기본값
  const [totalPoint, setTotalPoint] = useState<number>(0); // 총 포인트 (사용자 정보에서 가져올 예정)

  // 애니메이션 및 타이머
  const castAnim = useRef(new Animated.Value(0)).current; // 캐스팅 애니메이션
  const gaugeAnim = useRef(new Animated.Value(0)).current; // 게이지 애니메이션
  const biteTimeoutAnim = useRef(new Animated.Value(1)).current; // 입질 타이머 애니메이션
  const gaugeMovingRef = useRef(false); // 게이지 움직임 상태
  const biteTimer = useRef<any>(null); // 입질 타이머
  const biteTimeout = useRef<any>(null); // 입질 타임아웃
  const timeBarAnim = useRef(new Animated.Value(1)).current; // 릴링 시간 바 애니메이션

  const [distance, setDistance] = useState(INITIAL_DISTANCE);
  const [reelLimit, setReelLimit] = useState(REEL_TIME_LIMIT);
  const [reelGauge, setReelGauge] = useState(0);
  const reelInterval = useRef<any>(null);
  const reelDangerTimeout = useRef<any>(null);

  const reelTimeout = useRef<any>(null); // 릴링 제한시간 타이머
  const [gaugeZone, setGaugeZone] = useState<[number, number]>([0, 1]);
  const [fishDistance, setFishDistance] = useState(INITIAL_DISTANCE);
  const waitingHapticInterval = useRef<any>(null);

  const [reelZones, setReelZones] = useState({
    dangerZone: [0.85, 1],
    greenZone: [0.7, 0.85],
    normalZone: [0.5, 0.7],
  });

  useEffect(() => {
    if (!uuid) return;
    const userRef = doc(db, 'users', uuid);
    const unsub = onSnapshot(userRef, (snap) => {
      setTotalPoint(Math.max(snap.data()?.totalPoint ?? 0, 0)); // 0점 미만 방어
    });
    return unsub;
  }, [uuid]);

  // uuid 방어
  useEffect(() => {
    if (!uuid) return;
    (async () => {
      const baitSnap = await getDoc(doc(db, 'config', 'bait'));
      setDailyBaitLimit(baitSnap.exists() ? (baitSnap.data().dailyLimit ?? 5) : 5);

      try {
        setFishLoading(true);
        const snap = await getDocs(collection(db, 'fishes'));
        const arr = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            point: Number(data.point),
            zone: Array.isArray(data.zone) ? data.zone.map(Number) : data.zone,
          };
        });
        setFishes(arr);
      } catch (e) {
        console.error('Fish fetch error', e);
        setFishes([]);
      } finally {
        setFishLoading(false);
      }

      // 오늘 사용 미끼
      const usageSnap = await getDoc(doc(db, `users/${uuid}/baitUsage`, todayStr()));
      setTodayBaitUsed(usageSnap.exists() ? (usageSnap.data().used || 0) : 0);
    })();
  }, [uuid]);

  useEffect(() => {
    if (state === 'waiting') {
      waitingHapticInterval.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1000);
    } else {
      if (waitingHapticInterval.current) {
        clearInterval(waitingHapticInterval.current);
        waitingHapticInterval.current = null;
      }
    }
    // 언마운트 시 클린업도 필요
    return () => {
      if (waitingHapticInterval.current) {
        clearInterval(waitingHapticInterval.current);
        waitingHapticInterval.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    setBaitCount(Math.max(0, dailyBaitLimit - todayBaitUsed));
  }, [dailyBaitLimit, todayBaitUsed]);

  useEffect(() => {
    if (state === 'result' && fish && showResult) {
      // 릴 성공 기준에 맞춰서 적립
      if (reelGauge > 0.5 && !isSaving) {
        savePointToUser();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate(200);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate(150);
      }
    }
  }, [state, showResult]);

  useEffect(() => {
    return () => {
      [biteTimer, biteTimeout].forEach(t => {
        if (t.current) clearTimeout(t.current);
      });
    };
  }, []);

  useEffect(() => {
    if (state === 'result') setShowResult(true);
  }, [state]);

  async function savePointToUser() {
    if (!uuid || !fish || isSaving) return;
    // 릴게임 성공 기준: resultText === '' (즉, 실패 메시지가 없다면 성공)
    if (!fish.point || resultText !== '') return;
  
    setIsSaving(true);
    try {
      // 1. 포인트 이력 기록
      await addDoc(collection(db, `users/${uuid}/points`), {
        fishName: fish.name,
        point: fish.point,
        at: new Date(),
      });
  
      // 2. totalPoint 음수 방지 트랜잭션
      const userRef = doc(db, 'users', uuid);
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        let current = (userSnap.data()?.totalPoint ?? 0) as number;
        let next = current + fish.point;
        if (next < 0) next = 0;
        transaction.update(userRef, { totalPoint: next });
      });
    } catch (e) {
      console.error('savePointToUser error:', e);
    }
    setIsSaving(false);
  }
  

  async function startFishing() {
    if (!uuid) {
      Alert.alert('오류', '회원 정보가 없습니다.');
      return;
    }
    if (baitCount <= 0) {
      Alert.alert('미끼가 부족합니다', '오늘은 더이상 낚시할 수 없습니다!');
      return;
    }
    if (fishes.length === 0) {
      Alert.alert('물고기 데이터가 없습니다!');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const usageRef = doc(db, `users/${uuid}/baitUsage`, todayStr());
      await setDoc(usageRef, { used: increment(1), date: todayStr() }, { merge: true });
      setTodayBaitUsed(u => u + 1);
    } catch {}

    [biteTimer, biteTimeout, reelTimeout, reelDangerTimeout].forEach(t => {
      if (t.current) clearTimeout(t.current);
    });
    if (reelInterval.current) clearInterval(reelInterval.current);

    setResultText('');
    setState('casting');
    Animated.timing(castAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start(() => {
      setState('waiting');
      castAnim.setValue(0);
      const delay = 2000 + Math.random() * 2000;
      biteTimer.current = setTimeout(() => setState('bite'), delay);
    });
    const randomFish = fishes[Math.floor(Math.random() * fishes.length)];
    setFish(randomFish);
    setDistance(randomFish.distance || INITIAL_DISTANCE);
    setReelLimit(randomFish.limitTime || REEL_TIME_LIMIT);
    setFishDistance(randomFish.distance || INITIAL_DISTANCE);
    setShowResult(false);
  }

  function onWaitingTouch() {
    if (state !== 'waiting') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate(150);
    [biteTimer, biteTimeout].forEach(t => {
      if (t.current) clearTimeout(t.current);
    });
    setResultText('입질 전에 터치하면\n물고기가 도망가요!');
    setState('result');
  }

  function onBiteEnter() {
    // zone width: 0.22~0.34 사이 랜덤, start: 0.08~0.68 내
    const zoneWidth = 0.22 + Math.random() * 0.12; // 더 넓게
    const zoneStart = 0.08 + Math.random() * (0.68 - zoneWidth); // 좌우에 여유 확보
    setGaugeZone([zoneStart, zoneStart + zoneWidth]);

    // 게이지 왕복 속도 (0.3~1.2초 랜덤, 한 번만 선택)
    const gaugeDuration = Math.round(300 + Math.random() * 900);
    setGaugeSpeed(gaugeDuration);
  
    // 게이지 시작
    gaugeMovingRef.current = true;
    startGaugeLoop(1, gaugeDuration);
  
    // 제한시간 2~4초 랜덤 (2000~4000ms)
    const duration = Math.round(2000 + Math.random() * 2000);
    setBiteDuration(duration);
  
    biteTimeoutAnim.setValue(1);
    Animated.timing(biteTimeoutAnim, {
      toValue: 0,
      duration: duration,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
    biteTimeout.current = setTimeout(() => {
      gaugeMovingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Vibration.vibrate(150);
      setResultText('챔질 실패!\n물고기가 도망갔습니다.');
      setState('result');
    }, duration);
  }

  function onTimingGaugePress() {
    if (!gaugeMovingRef.current) return;
    gaugeMovingRef.current = false;
    if (biteTimeout.current) clearTimeout(biteTimeout.current);
  
    // 현재 애니메이션 값 즉시 획득
    const val = (gaugeAnim as any).__getValue();
    const zone = gaugeZone;
    if (!zone || !Array.isArray(zone) || zone.length !== 2) return;
    if (val >= zone[0] && val <= zone[1]) {
      setResultText('');
      setTimeout(() => setState('reel'), 30);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Vibration.vibrate(150);
      setResultText('챔질 실패!\n물고기가 도망갔습니다.');
      setTimeout(() => setState('result'), 30);
    }
  }
  

  function updateDistanceByGauge(gaugeValue: number, isPress = false) {
    // reelZones에서 가져오기
    if (!reelZones) return;
    const { normalZone, greenZone, dangerZone } = reelZones;
  
    let decrease = 0;
  
    if (gaugeValue >= greenZone[0] && gaugeValue <= greenZone[1]) {
      // 그린존
      decrease = 0.04;
    } else if (gaugeValue >= dangerZone[0] && gaugeValue <= dangerZone[1]) {
      // 위험존
      decrease = 0.12;
    } else if (gaugeValue >= normalZone[0] && gaugeValue < normalZone[1]) {
      // 노말존
      decrease = 0.01;
    }
    // 0~0.5 구간은 감소 없음
  
    if (decrease > 0) {
      setDistance(d => Math.max(0, d - decrease));
    }
  }
  
  

  function startReelGame() {
    // 1. 랜덤 zone 생성
    const dzStart = 0.80 + Math.random() * 0.15;
    const dzEnd = 1.0;
    const greenWidth = 0.08 + Math.random() * 0.12;
    const greenStart = Math.max(0.5, dzStart - greenWidth);
    const greenEnd = dzStart;
    const normalStart = 0.5;
    const normalEnd = greenStart;
  
    setReelZones({
      dangerZone: [dzStart, dzEnd],
      greenZone: [greenStart, greenEnd],
      normalZone: [normalStart, normalEnd],
    });
  
    // 2. 릴게이지 초기값 = greenZone 중간
    setReelGauge((greenStart + greenEnd) / 2);
  
    // 3. 남은 시간 애니메이션
    timeBarAnim.setValue(1);
    Animated.timing(timeBarAnim, {
      toValue: 0,
      duration: reelLimit,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
  
    // 4. 게이지 자동감소
    reelInterval.current = setInterval(() => {
      setReelGauge(prev => {
        let next = Math.max(0, prev - 0.009);
        updateDistanceByGauge(next); // ↓ 여기도 아래처럼 reelZones 써야 함
        if (state !== 'reel') return prev;
        if (next <= 0) {
          setResultText('릴링이 너무 약해요!');
          setState('result');
        }
        return next;
      });
    }, 24);
  
    // 5. 제한시간 타이머
    if (reelTimeout.current) clearTimeout(reelTimeout.current);
    reelTimeout.current = setTimeout(() => {
      setResultText('제한시간 초과! 물고기를 놓쳤습니다.');
      setState('result');
    }, reelLimit);
  }
  

  // reel 진입할 때 단 한 번만 distance, 게이지 등 초기화
  useEffect(() => {
    if (state === 'reel') {
      if (!fish) return;
      if (reelInterval.current) clearInterval(reelInterval.current); // 혹시 몰라 추가
      if (reelTimeout.current) clearTimeout(reelTimeout.current);
      setDistance(fish.distance || INITIAL_DISTANCE);
      setReelGauge(0.7); // 예시값
      setResultText('');
      startReelGame();
    }
  }, [state, fish]);

  useEffect(() => {
    if (state === 'reel' && distance <= 0) {
      console.log('릴 바로 성공/실패?', distance, state);
      if (reelTimeout.current) clearTimeout(reelTimeout.current); // 성공시 타이머 해제
      setResultText('');
      setState('result');
    }
  }, [distance, state]);
  
  useEffect(() => {
    if (state !== 'reel' || !fish) return;
    const dz = fish.dangerZone
      ? Array.isArray(fish.dangerZone)
        ? fish.dangerZone
        : [fish.dangerZone, 1]
      : [0.85, 1];
  
    // 위험존에 들어온 경우
    if (reelGauge >= dz[0] && reelGauge <= dz[1]) {
      // 이미 타이머 돌고 있으면 아무것도 안함
      if (!reelDangerTimeout.current) {
        reelDangerTimeout.current = setTimeout(() => {
          // 0.3초 이후에 추가 랜덤 시간(0~1초) 후 터짐 체크
          const randomDelay = Math.random() * 1000; // 0~1초 추가
          reelDangerTimeout.current = setTimeout(() => {
            setResultText('앗! 줄이 터졌다!\n릴링이 너무 강했어요!');
            setState('result');
          }, randomDelay);
        }, 300);
      }
    } else {
      // 위험존 벗어나면 타이머 취소
      if (reelDangerTimeout.current) {
        clearTimeout(reelDangerTimeout.current);
        reelDangerTimeout.current = null;
      }
    }
  }, [reelGauge, state, fish]);
  
  useEffect(() => {
    if (state === 'result' || state === 'idle') {
      if (reelInterval.current) clearInterval(reelInterval.current);
      if (reelDangerTimeout.current) clearTimeout(reelDangerTimeout.current);
      if (reelTimeout.current) clearTimeout(reelTimeout.current); // 추가
    }
  }, [state]);

  useEffect(() => {
    if (state === 'bite') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onBiteEnter();
    }
    else if (state === 'result') {
      if (biteTimeout.current) clearTimeout(biteTimeout.current);
      biteTimeoutAnim.setValue(1);
    }
  }, [state]);
  function startGaugeLoop(direction: 1 | -1, duration: number) {
    gaugeAnim.setValue(direction === 1 ? 0 : 1);
  
    Animated.timing(gaugeAnim, {
      toValue: direction === 1 ? 1 : 0,
      duration: duration,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start(({ finished }) => {
      if (!gaugeMovingRef.current) return;
      startGaugeLoop(-direction as 1 | -1, duration); // 동일 duration 유지!
    });
  }

  function resetGame() {
    [biteTimer, biteTimeout, reelTimeout, reelDangerTimeout].forEach(t => {
      if (t.current) clearTimeout(t.current);
    });
    if (reelInterval.current) clearInterval(reelInterval.current);
    gaugeMovingRef.current = false;
    setState('idle');
    setShowResult(false);
    setFish(null);
    setResultText('');
    setDistance(INITIAL_DISTANCE);
  }

  // --- UI(리턴 부분) ---
  if (!uuid) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>회원 정보가 없습니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ marginVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, color: '#111', fontWeight: 'bold' }}>
        내 총 포인트: {totalPoint}P
      </Text>
    </View>

      {(fishLoading || fishes.length === 0) && (
        <View style={{alignItems:'center', justifyContent:'center', flex:1}}>
          <Text style={{fontSize:22, color:'#888'}}>데이터를 불러오는 중...</Text>
        </View>
      )}

      {(!fishLoading && fishes.length > 0) && (
        <>
          {state === 'idle' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.title}>🎣 낚시 미니게임</Text>
              <Text style={styles.bait}>오늘 남은 미끼: {baitCount}개 / 하루 제한: {dailyBaitLimit}개</Text>
              <TouchableOpacity
                style={[styles.button, baitCount <= 0 && { backgroundColor: '#888' }]}
                disabled={baitCount <= 0}
                onPress={startFishing}
              >
                <Text style={styles.btnText}>낚시 시작</Text>
              </TouchableOpacity>
            </View>
          )}

          {state === 'casting' && (
            <View style={styles.castingBox}>
              <View style={styles.sea} />
              <Animated.View
                style={[
                  styles.baitShape,
                  {
                    transform: [
                      {
                        translateY: castAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 250],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fa8', borderWidth: 2, borderColor: '#fff' }} />
              </Animated.View>
            </View>
          )}

          {state === 'waiting' && (
            <Pressable
              style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
              onPress={onWaitingTouch}
            >
              <Text style={styles.title}>🎣 낚시 미니게임</Text>
              <View style={{ marginVertical: 20, alignItems: 'center' }}>
                <Text style={styles.info}>캐스팅!</Text>
                <Text style={styles.info}>입질을 기다리는 중...(터치 금지!)</Text>
              </View>
              <View style={{
                marginTop: 20,
                width: 120,
                height: 40,
                backgroundColor: '#b2e3fa',
                borderRadius: 20,
                opacity: 0.6,
              }} />
            </Pressable>
          )}

          {state === 'bite' && (
            <Pressable style={styles.gaugeBox} onPress={onTimingGaugePress}>
              <Text style={styles.gaugeTitle}>⏳ 타이밍에 맞춰 터치!(후킹)</Text>
              <View style={styles.gaugeTrack}>
                <View style={[
                  styles.gaugeSuccessZone,
                  {
                    left: `${gaugeZone[0] * 100}%`,
                    width: `${(gaugeZone[1] - gaugeZone[0]) * 100}%`
                  }
                ]} />
                <Animated.View
                  style={[
                    styles.gaugePointer,
                    {
                      left: gaugeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.info}>그린존에 위치시키면 후킹 성공!</Text>
            </Pressable>
          )}

          {state === 'reel' && fish && (
            (() => {
              const { dangerZone, greenZone, normalZone } = reelZones;

              return (
                <Pressable
                  style={styles.gaugeBox}
                  onPress={() => {
                    setReelGauge(prev => {
                      let next = Math.min(1, prev + 0.045); // 연타마다만 올라감
                      updateDistanceByGauge(next, true);    // 연타로 거리감소, 위험존 터짐 체크
                      if (next <= 0) {
                        setResultText('게이지가 0이 되어 놓쳤습니다!');
                        setState('result');
                      }
                      return next;
                    });
                  }}
                >
                  <Text style={styles.gaugeTitle}>무언가를 끌어 올리는중!</Text>
                  <View style={styles.gaugeTrack}>
                    {/* 노말존 */}
                    <View
                      style={[
                        styles.gaugeNormalZone,
                        {
                          left: `${normalZone[0] * 100}%`,
                          width: `${(normalZone[1] - normalZone[0]) * 100}%`
                        },
                      ]}
                    />
                    {/* 그린존 */}
                    <View
                      style={[
                        styles.gaugeGreenZone,
                        {
                          left: `${greenZone[0] * 100}%`,
                          width: `${(greenZone[1] - greenZone[0]) * 100}%`
                        },
                      ]}
                    />
                    {/* 위험존 */}
                    <View
                      style={[
                        styles.gaugeDangerZone,
                        {
                          left: `${dangerZone[0] * 100}%`,
                          width: `${(dangerZone[1] - dangerZone[0]) * 100}%`
                        },
                      ]}
                    />
                    {/* 게이지 */}
                    <View
                      style={[
                        styles.gaugePointer,
                        { width: `${reelGauge * 100}%` }
                      ]}
                    />
                  </View>
                  {/* 남은 시간 표시 바 */}
                  <View style={styles.timeBarTrack}>
                    <Animated.View
                      style={[
                        styles.timeBarFill,
                        {
                          width: timeBarAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        }
                      ]}
                    />
                  </View>

                  {/* 남은 거리 bar */}
                  <View style={styles.distanceBarTrack}>
                    <View
                      style={[
                        styles.distanceBar,
                        { width: `${Math.max(0, Math.min(1, distance / fishDistance)) * 100}%` }
                      ]}
                    />
                  </View>

                  <Text style={styles.trialInfo}>
                    남은 거리: {distance.toFixed(2)}m | 게이지: {(reelGauge * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.info}>
                    그린존, 파이팅존에 게이지를 두고 있으면 거리가 줄어듭니다! 레드존에 들어가면 줄이 터질 수 있어요!!
                  </Text>
                </Pressable>
              );
            })()
          )}



          {state === 'result' && fish && showResult && (
            <View style={styles.resultBox}>
              {resultText ? (
                <Text style={styles.resultTitle}>{resultText}</Text>
              ) : (
                <>
                  <Text style={styles.resultTitle}>{reelGauge > 0.5 ? '성공!' : '실패...'}</Text>
                  {reelGauge > 0.5 && (
                    <>
                      <Text style={styles.resultDesc}>🎣 {fish.name}을(를) 잡았다!</Text>
                      <Text style={styles.resultDesc}>{fish.point}점 획득!</Text>
                    </>
                  )}
                </>
              )}
              <TouchableOpacity style={styles.button} onPress={resetGame}>
                <Text style={styles.btnText}>다시하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5f4fd', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#008cff' },
  bait: { fontSize: 16, color: '#0a0a0a', marginBottom: 20 },
  button: {
    backgroundColor: '#34aaff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  castingBox: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', width: '100%' },
  sea: { width: width, height: 200, backgroundColor: '#3cc0fa', position: 'absolute', bottom: 0, left: 0 },
  baitShape: { position: 'absolute', left: width / 2 - 12, top: 50, zIndex: 10 },
  info: { fontSize: 20, color: '#222', marginVertical: 4 },
  biteText: { fontSize: 28, color: '#ff621f', fontWeight: 'bold' },
  fullScreenCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  gaugeBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingTop: 60,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  gaugeTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 16, color: '#008cff' },
  gaugeTrack: {
    width: width * 0.8,
    height: 30,
    backgroundColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
  },
  // styles
  gaugeNormalZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(30,200,80,0.18)', // 선명한 그린
    zIndex: 1,
  },
  gaugeGreenZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,200,100,0.35)', // 연한 주황
    zIndex: 2,
  },
  gaugeDangerZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,0,0,0.14)',
    zIndex: 3,
  },
  gaugeSuccessZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,220,40,0.3)',
    borderRadius: 12,
  },
  gaugePointer: {
    position: 'absolute',
    top: 0,
    width: 12,
    height: 30,
    backgroundColor: '#ff621f',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  trialInfo: { fontSize: 17, color: '#666', marginTop: 4 },
  timeoutTrack: {
    marginTop: 16,
    width: width * 0.8,
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeoutBar: {
    height: 10,
    backgroundColor: '#ffa930',
    borderRadius: 12,
  },
  resultBox: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultTitle: { fontSize: 32, fontWeight: 'bold', marginBottom: 16, color: '#008cff', textAlign: 'center' },
  resultDesc: { fontSize: 18, color: '#222', marginTop: 12, textAlign: 'center' },

  timeBarTrack: {
    width: width * 0.8,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 8,
  },
  timeBarFill: {
    height: 8,
    backgroundColor: '#ffa930',
    borderRadius: 5,
  },
  distanceBarTrack: {
    width: width * 0.8,
    height: 8,
    backgroundColor: '#b5e8fc',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  distanceBar: {
    height: 8,
    backgroundColor: '#11b364',
    borderRadius: 8,
  },
});