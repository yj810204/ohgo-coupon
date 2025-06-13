// app/mini-games/fishing.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Vibration,
  Animated,
  Easing,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const { width, height } = Dimensions.get('window');

type CatchItem = {
  name: string;
  point: number;
  level?: number;
};

export default function FishingGame() {
  const [caughtItem, setCaughtItem] = useState<CatchItem | null>(null);
  const [baitCount, setBaitCount] = useState(10);
  const [message, setMessage] = useState('🎣 탭해서 낚시 시작!');
  const [catchOptions, setCatchOptions] = useState<CatchItem[]>([]);
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'hit' | 'reeling' | 'result' | 'readyToReset'>('idle');
  const [reelProgress, setReelProgress] = useState(0);
  const [reelGoal, setReelGoal] = useState(100);
  const [visibleBanner, setVisibleBanner] = useState('');
  const [targetPosition, setTargetPosition] = useState(0.5);
  const barPosition = useRef(new Animated.Value(0)).current;
  const barValue = useRef(0);
  const [reelStartTime, setReelStartTime] = useState<number | null>(null);
  const bobberY = useRef(new Animated.Value(0)).current;
  const [showBobber, setShowBobber] = useState(false);
  const [now, setNow] = useState(Date.now());
  const bobberFloatingAnim = useRef<Animated.CompositeAnimation | null>(null);
  const bobberRotate = useRef(new Animated.Value(0)).current;
  const bobberShakeX = useRef(new Animated.Value(0)).current;

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const reelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fishCount = 3;
  const fishOpacities = useRef([...Array(fishCount)].map(() => new Animated.Value(0))).current;
  const fishPositions = useRef([...Array(fishCount)].map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  const startFishAnimation = () => {
    fishPositions.forEach((pos, i) => {
      Animated.parallel([
        Animated.timing(fishOpacities[i], {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pos.x, {
          toValue: Math.random() * 40 - 20, // 찌 근처 x
          duration: 2000 + Math.random() * 500,
          useNativeDriver: true,
        }),
        Animated.timing(pos.y, {
          toValue: Math.random() * 20 - 10, // 찌 근처 y
          duration: 2000 + Math.random() * 500,
          useNativeDriver: true,
        }),
      ]).start(() => loopFish(i));
    });
  };
  
  const loopFish = (i: number) => {
    const pos = fishPositions[i];
    const animate = () => {
      const tx = Math.random() * 40 - 20;
      const ty = Math.random() * 30 - 15;
  
      Animated.parallel([
        Animated.timing(pos.x, {
          toValue: tx,
          duration: 2000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pos.y, {
          toValue: ty,
          duration: 2000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };
    animate();
  };


  const rotateInterpolate = bobberRotate.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const shakeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startShaking = () => {
    if (shakeInterval.current !== null) return;
  
    shakeInterval.current = setInterval(() => {
      const randomX = Math.random() * 6 - 3; // -3 ~ +3 px
      bobberShakeX.setValue(randomX);
    }, 40);
  };

  const stopShaking = () => {
    if (shakeInterval.current) {
      clearInterval(shakeInterval.current);
      shakeInterval.current = null;
      bobberShakeX.setValue(0);
    }
  };
  

  useEffect(() => {
    const fetchCatchOptions = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'config', 'fishing'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.items)) setCatchOptions(data.items);
        }
      } catch (e) {
        console.error('🎣 데이터 불러오기 실패', e);
      }
    };
    fetchCatchOptions();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const id = barPosition.addListener(({ value }) => {
      barValue.current = value;
    });
    return () => barPosition.removeListener(id);
  }, [barPosition]);

  const animateBobber = (mode: 'soft' | 'intense') => {
    if (bobberFloatingAnim.current) bobberFloatingAnim.current.stop();
  
    if (mode === 'intense') {
      startShaking(); // 랜덤 떨림 시작
    } else {
      // 일반적인 잠방잠방 (부드러운 위아래 이동)
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(bobberY, {
            toValue: 6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(bobberY, {
            toValue: -6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(bobberY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      bobberFloatingAnim.current = anim;
      anim.start();
    }
  };
  

  const throwBobberOnce = useRef(false);

  const throwBobber = (onComplete: () => void) => {
    if (throwBobberOnce.current) return;
    throwBobberOnce.current = true;
  
    // 애니메이션 없이 즉시 찌를 착수 위치로 설정
    bobberY.setValue(height / 2);   // 바로 착수 위치
    onComplete();                   // 착수 후 콜백 실행
  };

  const startFishing = () => {
    startFishAnimation(); // ✅ 물고기 등장 시작
    
    if (baitCount <= 0) {
      Alert.alert('미끼 없음', '더 이상 낚시할 수 없습니다.');
      return;
    }

    stopShaking(); // ✅ 시작 시 떨림 초기화!

    throwBobberOnce.current = false;
    setBaitCount(prev => prev - 1);
    setMessage('입질을 기다리는 중...');
    setShowBobber(true);
    setGameState('waiting');
    throwBobber(() => animateBobber('soft'));

    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => {
      setGameState('hit');
      setVisibleBanner('🎯 타이밍을 맞춰 챔질!');
      Vibration.vibrate(500);
      setTargetPosition(Math.random());
      animateBobber('intense');
      Animated.loop(
        Animated.sequence([
          Animated.timing(barPosition, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(barPosition, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    }, delay);
  };

  const startReeling = () => {
    const item = catchOptions[Math.floor(Math.random() * catchOptions.length)];
    const level = item.level ?? 100;
    setCaughtItem(item);
    setReelGoal(level);
    setReelProgress(0);
    setGameState('reeling');
    setVisibleBanner('🎣 무언가를 끌어올리는 중...');
    setReelStartTime(Date.now());

    reelTimeout.current = setTimeout(() => {
      setVisibleBanner('⌛ 시간 초과! 무언가를 놓쳤어요ㅠ');
      if (progressInterval.current) clearInterval(progressInterval.current);
      setGameState('result');
    }, 20000);

    progressInterval.current = setInterval(() => {
      setReelProgress(prev => Math.max(0, prev - 8));
    }, 200);
  };

  const handleTouch = () => {
    if (gameState === 'idle') {
      startFishing();
    } else if (gameState === 'hit') {
      const distance = Math.abs(targetPosition - barValue.current);
      Vibration.vibrate(300); // ✅ 챔질 시 진동 추가
      if (distance < 0.1) {
        setVisibleBanner('🎣 히트 성공!');
        Animated.timing(barPosition, {
          toValue: barValue.current,
          duration: 0,
          useNativeDriver: false,
        }).stop();
        startReeling();
      } else {
        setMessage('💨 놓쳤어요...');
        setVisibleBanner('😢 챔질 타이밍이 어긋났습니다');

        // 🔥 물고기들 바깥으로 이동 + fade out
        fishPositions.forEach((pos, i) => {
          Animated.parallel([
            Animated.timing(fishOpacities[i], {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pos.x, {
              toValue: Math.random() > 0.5 ? 150 : -150,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pos.y, {
              toValue: 80 + Math.random() * 40,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]).start();
        });

        animateBobber('soft');
        stopShaking();
        setGameState('result');
      }
    } else if (gameState === 'reeling') {
      setReelProgress(prev => {
        const next = prev + 10;
        if (next >= reelGoal) {
          if (progressInterval.current) clearInterval(progressInterval.current);
          if (reelTimeout.current) clearTimeout(reelTimeout.current);
          setVisibleBanner(`🎉 ${caughtItem?.name} 획득! ${caughtItem?.point}점`);
          setGameState('result');
          setTimeout(() => {
            setGameState('readyToReset');
          }, 1500);
        }
        return next;
      });
    } else if (gameState === 'readyToReset') {
      resetGame();
    }
  };

  const resetGame = () => {
    setCaughtItem(null);
    setReelProgress(0);
    setReelGoal(100);
    setGameState('idle');
    setVisibleBanner('');
    setMessage('🎣 탭해서 낚시 시작!');
    bobberFloatingAnim.current?.stop(); // 추가
    setShowBobber(false); // 추가

    fishOpacities.forEach(o => o.setValue(0));
    fishPositions.forEach((pos, i) => {
      pos.x.setValue((i % 2 === 0 ? -1 : 1) * (width / 2 + 100)); // 왼쪽 or 오른쪽 바깥
      pos.y.setValue(60 + Math.random() * 30); // 찌보다 아래
    });
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/fishing/bg.png')} style={styles.background} />
      <Text style={styles.baitText}>🎣 미끼: {baitCount}개</Text>
      <TouchableOpacity
        style={styles.gameArea}
        onPress={gameState === 'result' || gameState === 'readyToReset' ? undefined : handleTouch}
      />
      <Text style={styles.message}>{message}</Text>

      {visibleBanner !== '' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{visibleBanner}</Text>
        </View>
      )}

      {showBobber && (
        <Animated.Image
        source={require('../../assets/fishing/bobber.png')}
        style={[
          styles.bobber,
          {
            transform: [
              { translateY: bobberY },
              { translateX: bobberShakeX }, // 랜덤 떨림 적용
            ],
          },
        ]}
      />
      
      )}

      {showBobber &&
        fishPositions.map((pos, i) => (
          <Animated.Image
            key={`fish-${i}`}
            source={require('../../assets/fishing/fish-shadow.png')}
            style={{
              position: 'absolute',
              top: height / 2 + 40,
              left: width / 2 - 32, // 중심 기준
              width: 64,
              height: 32,
              opacity: fishOpacities[i],
              transform: [
                { translateX: pos.x },
                { translateY: pos.y },
              ],
              zIndex: 5,
            }}
          />
        ))}

      {gameState === 'hit' && (
        <View style={styles.gaugeBox}>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeTarget, { left: `${targetPosition * 100}%` }]} />
            <Animated.View style={[styles.gaugePointer, { left: barPosition.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        </View>
      )}

      {gameState === 'reeling' && (
        <View style={styles.reelBox}>
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${(reelProgress / reelGoal) * 100}%` }]} />
          </View>
          <View style={styles.reelTimerBar}>
            <View style={[
              styles.reelTimerProgress,
              {
                width: `${Math.max(0, 1 - ((now - (reelStartTime ?? now)) / 20000)) * 100}%`
              }
            ]} />
          </View>
          <Text style={styles.reelText}>{reelProgress} / {reelGoal}</Text>
        </View>
      )}

      {(gameState === 'result' || gameState === 'readyToReset') && (
        <TouchableOpacity onPress={resetGame} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>🔄 다시 도전!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bobber: {
    position: 'absolute',
    top: height / 2, // 착수 위치를 고정
    left: width / 2 - 24,
    width: 48,
    height: 48,
    zIndex: 10,
  },
    resetButton: {
      position: 'absolute',
      bottom: 160,
      alignSelf: 'center',
      backgroundColor: '#2196F3',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    resetButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    container: { flex: 1, backgroundColor: '#000' },
    background: { position: 'absolute', width: '100%', height: '100%', resizeMode: 'cover' },
    gameArea: { flex: 1 },
    baitText: { position: 'absolute', top: 40, left: 20, color: '#fff', fontSize: 18 },
    message: { position: 'absolute', bottom: 30, width: '100%', textAlign: 'center', color: '#fff', fontSize: 18 },
    banner: { position: 'absolute', top: height / 2 - 60, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.8)', padding: 12, borderRadius: 8 },
    bannerText: { fontSize: 18, color: '#000', fontWeight: 'bold' },
    reelBox: { position: 'absolute', bottom: 100, alignSelf: 'center', alignItems: 'center' },
    progressBar: { height: 20, width: width * 0.8, backgroundColor: '#ccc', borderRadius: 10, overflow: 'hidden', marginBottom: 4 },
    progress: { height: '100%', backgroundColor: '#4caf50' },
    reelTimerBar: {
      height: 4,
      width: width * 0.8,
      backgroundColor: '#400',
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 8,
    },
    reelTimerProgress: {
      height: '100%',
      backgroundColor: 'red',
    },
    reelText: { color: '#fff', fontSize: 16 },
    gaugeBox: { position: 'absolute', bottom: 160, width: width * 0.8, height: 40, backgroundColor: '#111', alignSelf: 'center', justifyContent: 'center' },
    gaugeTrack: { position: 'relative', width: '100%', height: 8, backgroundColor: '#555', borderRadius: 4 },
    gaugeTarget: { position: 'absolute', top: -6, width: 10, height: 20, backgroundColor: 'red', borderRadius: 5 },
    gaugePointer: { position: 'absolute', top: -6, width: 10, height: 20, backgroundColor: 'yellow', borderRadius: 5 },
  });
  