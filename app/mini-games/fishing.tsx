import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  StyleProp,
  ViewStyle,
  Image,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, increment, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { notifyAllAdmins } from '../../utils/send-push';

const { width, height } = Dimensions.get('window');
type GameState = 'idle' | 'casting' | 'bite' | 'reel' | 'result'; // 'waiting' 상태 제거
const BITE_TIMEOUT = 2000;
const INITIAL_DISTANCE = 10;
const REEL_TIME_LIMIT = 13000; // ms (ex. 13초, 필요시 하드코딩/DB값)
const DEFAULT_COMMON_DISTANCE = 50; // 기본 공통 거리
const DEFAULT_COMMON_POINT = 1000; // 기본 공통 포인트

// 캐싱을 위한 상수
const FISH_DATA_CACHE_KEY = 'FISH_DATA_CACHE';
const FISH_IMAGES_LOADED_KEY = 'FISH_IMAGES_LOADED';
const FISH_CACHE_VERSION_KEY = 'FISH_CACHE_VERSION';
const FISH_CACHE_VERSION = '1.0'; // 캐시 버전 - 앱 업데이트 시 변경
const FISH_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

// 이벤트 정보 타입 정의
type Tournament = {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
} | null;

// 물고기 데이터 타입 정의
interface Fish {
  id: string;
  name: string;
  point: number;
  img?: string;
  level?: number; // 난이도 (1-5): 1(easy) ~ 5(hard)
  distance?: number; // 개별 거리 (기존 호환성 유지)
  limitTime?: number; // 개별 제한 시간 (기존 호환성 유지)
  [key: string]: any; // 추가 속성을 위한 인덱스 시그니처
}

// 배경 애니메이션을 위한 컴포넌트
const WaterBubble = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  // 성능 최적화: 랜덤 값을 useRef로 미리 계산하여 리렌더링 방지
  const bubbleSize = useRef(10 + Math.random() * 15).current; // 크기 범위 축소 (10~25px)
  const animatedValue = useRef(new Animated.Value(0)).current;
  const xPos = useRef(Math.random() * width).current;
  const duration = useRef(6000 + Math.random() * 4000).current; // 지속 시간 범위 축소 (6~10초)

  // 성능 최적화: 컴포넌트 마운트 시 한 번만 실행
  useEffect(() => {
    // 애니메이션 시작
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true, // 네이티브 드라이버 사용으로 성능 향상
      })
    );

    animation.start();

    // 클린업 함수에서 애니메이션 중지
    return () => {
      animation.stop();
    };
  }, []);

  // 미리 계산된 스타일 객체
  const animatedStyle = {
    position: 'absolute' as const,
    width: bubbleSize,
    height: bubbleSize,
    borderRadius: bubbleSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    left: xPos,
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [height + bubbleSize, -bubbleSize * 2],
        }),
      },
      {
        translateX: animatedValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 10, 0], // 움직임 범위 축소
        }),
      },
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.1, 1], // 크기 변화 축소
        }),
      },
    ],
    opacity: animatedValue.interpolate({
      inputRange: [0, 0.8, 1],
      outputRange: [0.5, 0.7, 0], // 투명도 범위 축소
    }),
  };

  return <Animated.View style={[animatedStyle, style]} />;
};

// 물결 애니메이션 컴포넌트
const WaterWave = ({ style, index = 0 }: { style?: StyleProp<ViewStyle>; index?: number }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const startDelay = useRef(index * 800).current; // 딜레이 시간 감소
  const duration = useRef(10000 - index * 500).current; // 각 물결마다 다른 속도

  useEffect(() => {
    // 타이머 참조 저장
    const timer = setTimeout(() => {
      // 애니메이션 참조 저장
      const animation = Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true, // 네이티브 드라이버 사용
        })
      );

      animation.start();

      // 클린업 함수에서 애니메이션 중지
      return () => {
        animation.stop();
      };
    }, startDelay);

    // 클린업 함수에서 타이머 제거
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 미리 계산된 스타일 객체
  const animatedStyle = {
    position: 'absolute' as const,
    width: width * 2,
    height: 40, // 높이 감소
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 20, // 높이에 맞게 조정
    bottom: 60 + index * 35, // 간격 조정
    left: -width / 2,
    transform: [
      {
        translateX: waveAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, width / 5, 0], // 이동 거리 감소
        }),
      },
      {
        translateY: waveAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, index % 2 === 0 ? -5 : 5, 0], // 단순화된 움직임
        }),
      },
    ],
  };

  return <Animated.View style={[animatedStyle, style]} />;
};

// 물고기 실루엣 애니메이션 컴포넌트
const FishSilhouette = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  // 성능 최적화: 모든 랜덤 값을 useRef로 미리 계산
  const fishSize = useRef(15 + Math.random() * 20).current; // 크기 범위 축소 (15~35px)
  const animatedValue = useRef(new Animated.Value(0)).current;
  const yPos = useRef(height * 0.4 + Math.random() * (height * 0.3)).current; // 위치 범위 축소
  const direction = useRef(Math.random() > 0.5 ? 1 : -1).current; // 왼쪽 또는 오른쪽으로 이동
  const duration = useRef(12000 + Math.random() * 8000).current; // 지속 시간 범위 축소 (12~20초)

  // 물고기 꼬리 스타일 미리 계산
  const tailStyle = useRef({
    position: 'absolute' as const,
    left: -fishSize/4, // Changed from right to left to reverse the tail direction
    top: fishSize/8,
    width: fishSize/3,
    height: fishSize/4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderTopLeftRadius: fishSize/4, // Changed from Right to Left
    borderBottomLeftRadius: fishSize/4, // Changed from Right to Left
    transform: [{ scaleX: direction > 0 ? 1 : -1 }]
  }).current;

  useEffect(() => {
    // 애니메이션 참조 저장
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true, // 네이티브 드라이버 사용
      })
    );

    animation.start();

    // 클린업 함수에서 애니메이션 중지
    return () => {
      animation.stop();
    };
  }, []);

  // 미리 계산된 스타일 객체
  const animatedStyle = {
    position: 'absolute' as const,
    width: fishSize,
    height: fishSize / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: fishSize / 4,
    top: yPos,
    transform: [
      {
        translateX: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: direction > 0 ?
            [-fishSize, width + fishSize] :
            [width + fishSize, -fishSize],
        }),
      },
      {
        scaleX: direction, // 방향에 따라 물고기 방향 전환
      },
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, direction > 0 ? -5 : 5, 0], // 단순화된 움직임
        }),
      },
    ],
    opacity: 0.3, // 투명도 감소
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      {/* 물고기 꼬리 */}
      <View style={tailStyle} />
    </Animated.View>
  );
};

// 해초 애니메이션 컴포넌트
const Seaweed = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  // 성능 최적화: 랜덤 값을 useRef로 미리 계산
  const seaweedHeight = useRef(50 + Math.random() * 100).current; // 높이 범위 (50~150px)
  const seaweedWidth = useRef(10 + Math.random() * 10).current; // 너비 범위 (10~20px)
  const xPos = useRef(Math.random() * width).current; // x 위치
  const segments = useRef(3 + Math.floor(Math.random() * 3)).current; // 해초 마디 개수 (3~5)
  const animatedValue = useRef(new Animated.Value(0)).current;
  const hue = useRef(140 + Math.random() * 40).current; // 초록색 계열 (140~180)
  const saturation = useRef(60 + Math.random() * 30).current; // 채도 (60~90%)
  const lightness = useRef(30 + Math.random() * 20).current; // 명도 (30~50%)
  
  // 바닥에 딱 일치하게 설정 (매립 깊이 0)
  const embedDepth = useRef(0).current;

  useEffect(() => {
    // 애니메이션 시작
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 2000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      ])
    );

    animation.start();

    // 클린업 함수에서 애니메이션 중지
    return () => {
      animation.stop();
    };
  }, []);

  // 해초 마디 생성
  const renderSegments = () => {
    return Array.from({ length: segments }).map((_, index) => {
      const segmentHeight = seaweedHeight / segments;
      const segmentColor = `hsla(${hue}, ${saturation}%, ${lightness - (index * 5)}%, 0.7)`;

      // 바닥에 박혀있는 부분은 더 어둡게 표현
      const isEmbedded = index === segments - 1; // 가장 아래 세그먼트
      const embeddedColor = isEmbedded
        ? `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 15, 10)}%, 0.8)`
        : segmentColor;

      return (
        <Animated.View
          key={`segment-${index}`}
          style={{
            position: 'absolute',
            width: seaweedWidth - (index * (seaweedWidth / segments / 2)), // 위로 갈수록 약간 얇아짐
            height: segmentHeight,
            backgroundColor: embeddedColor,
            borderRadius: seaweedWidth / 2,
            bottom: index * segmentHeight - (isEmbedded ? embedDepth : 0), // 가장 아래 세그먼트는 바닥에 박혀있음
            transform: [{
              rotate: animatedValue.interpolate({
                inputRange: [0, 1],
                // 바닥에 박힌 부분은 움직임이 적게
                outputRange: isEmbedded
                  ? [`${-2}deg`, `${2}deg`]
                  : [`${-5 - (index * 3)}deg`, `${5 + (index * 3)}deg`]
              })
            }],
            zIndex: segments - index, // 위쪽 세그먼트가 더 앞에 보이도록
          }}
        />
      );
    });
  };

  return (
    <View
      style={[
        {
          position: 'absolute',
          width: seaweedWidth,
          height: seaweedHeight,
          left: xPos,
          bottom: 37, // 바닥에 딱 일치하게 설정
          overflow: 'visible',
          zIndex: 0, // 바닥보다 뒤에 표시 (맨뒤에)
        },
        style
      ]}
    >
      {renderSegments()}
    </View>
  );
};


// 배경 애니메이션 컨테이너
const AnimatedBackground = ({ gameState }: { gameState: GameState }) => {
  // 성능 최적화를 위해 애니메이션 개수 조정
  // 버블 개수
  const bubbleCount = gameState === 'reel' ? 5 : 10; // 15에서 10으로 감소
  // 물결 개수
  const waveCount = 3; // 4에서 3으로 감소
  // 물고기 실루엣 개수
  const fishCount = gameState === 'reel' ? 3 : 6; // 3에서 6으로 증가
  // 해초 개수
  const seaweedCount = 8; // 5에서 8로 증가

  // 수면 물결 애니메이션
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // 바다 깊이에 따른 그라데이션 레이어 생성
  const renderDepthLayers = () => {
    // 5개의 레이어로 나누어 점점 어두워지는 효과 생성
    const layerCount = 5;
    return Array.from({ length: layerCount }).map((_, index) => {
      // 위에서부터 아래로 갈수록 더 어두워지는 색상
      // 기본 바다색 #2a8dc0에서 점점 어두워지는 효과
      const opacity = 0.15 + (index * 0.1); // 0.15, 0.25, 0.35, 0.45, 0.55
      const top = (height * 0.15) + ((height * 0.85) / layerCount) * index; // 수면(height * 0.15) 아래부터 시작
      const layerHeight = (height * 0.85) / layerCount;
      
      return (
        <View 
          key={`depth-layer-${index}`}
          style={{
            position: 'absolute',
            top: top,
            left: 0,
            right: 0,
            height: layerHeight,
            backgroundColor: 'rgba(0, 20, 50, ' + opacity + ')', // 어두운 청색으로 점점 어두워짐
            zIndex: 0,
          }}
        />
      );
    });
  };

  return (
    <View style={styles.backgroundContainer}>
      {/* 바다 깊이 그라데이션 레이어 */}
      {renderDepthLayers()}
      
      {/* 물결 애니메이션 */}
      {Array.from({ length: waveCount }).map((_, index) => (
        <WaterWave key={`wave-${index}`} index={index} style={{}} />
      ))}

      {/* 버블 애니메이션 */}
      {Array.from({ length: bubbleCount }).map((_, index) => (
        <WaterBubble key={`bubble-${index}`} style={{}} />
      ))}

      {/* 물고기 실루엣 애니메이션 */}
      {Array.from({ length: fishCount }).map((_, index) => (
        <FishSilhouette key={`fish-${index}`} style={{}} />
      ))}
      
      {/* 해초 애니메이션 - 바닥보다 뒤에 배치 */}
      {Array.from({ length: seaweedCount }).map((_, index) => (
        <Seaweed key={`seaweed-${index}`} style={{}} />
      ))}
      
      {/* 바닥 표시 */}
      <View style={styles.oceanFloor}>
        {/* 바닥 질감을 위한 작은 돌멩이들 - 고정 위치 */}
        {useMemo(() => {
          return Array.from({ length: 12 }).map((_, index) => {
            // 각 돌멩이마다 고정된 랜덤 값 생성
            const pebbleWidth = 4 + Math.random() * 8;
            const pebbleHeight = 3 + Math.random() * 5;
            const pebbleColor = `rgba(${150 + Math.random() * 50}, ${120 + Math.random() * 40}, ${100 + Math.random() * 30}, 0.8)`;
            const pebbleTop = Math.random() * 20;
            const pebbleLeft = (width / 12) * index + (Math.random() * 30 - 15);
            
            return (
              <View 
                key={`pebble-${index}`}
                style={{
                  position: 'absolute',
                  width: pebbleWidth,
                  height: pebbleHeight,
                  backgroundColor: pebbleColor,
                  borderRadius: 3,
                  top: pebbleTop,
                  left: pebbleLeft,
                }}
              />
            );
          });
        }, [])} 
        {/* 빈 의존성 배열로 컴포넌트가 처음 렌더링될 때만 실행 */}
      </View>

      {/* 수면 효과 */}
      <View style={styles.waterSurface}>
        {/* 수면 위의 물결 효과 */}
        <Animated.View style={{
          position: 'absolute' as const,
          width: width * 2,
          height: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          left: -width / 2,
          top: 0,
          transform: [{
            translateX: waveAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-width / 2, width / 2],
            })
          }]
        }} />

        {/* 수면 아래 반사 효과 */}
        <View style={styles.waterReflection} />
      </View>
    </View>
  );
};

// 폭죽 애니메이션 컴포넌트
const Firework = ({ style, x, y, delay = 0, size = 1 }: { 
  style?: StyleProp<ViewStyle>; 
  x: number; 
  y: number; 
  delay?: number;
  size?: number;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const particles = useRef(Array.from({ length: 12 }, () => ({
    angle: Math.random() * Math.PI * 2,
    distance: 0.5 + Math.random() * 0.5,
    color: [
      '#ffff00', // 노랑
      '#ff4500', // 주황
      '#ff0000', // 빨강
      '#00ff00', // 초록
      '#00ffff', // 하늘
      '#ff00ff', // 핑크
    ][Math.floor(Math.random() * 6)],
    size: 4 + Math.random() * 4,
  }))).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={[{
      position: 'absolute',
      left: x,
      top: y,
      width: 1,
      height: 1,
    }, style]}>
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            width: particle.size * size,
            height: particle.size * size,
            backgroundColor: particle.color,
            borderRadius: (particle.size * size) / 2,
            opacity: animatedValue.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateX: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(particle.angle) * 100 * particle.distance * size],
                }),
              },
              {
                translateY: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(particle.angle) * 100 * particle.distance * size],
                }),
              },
              {
                scale: animatedValue.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.3, 1, 0.5],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
};

// 성공 폭죽 애니메이션 컴포넌트 (루프 재생)
const SuccessFireworks = () => {
  // 애니메이션 루프를 위한 상태 추가
  const [fireworksKey, setFireworksKey] = useState(0);
  const fireworks = useRef(Array.from({ length: 8 }, () => ({
    x: Math.random() * width * 0.8 + width * 0.1,
    y: Math.random() * height * 0.6 + height * 0.2,
    delay: Math.random() * 1000,
    size: 0.8 + Math.random() * 0.4,
  }))).current;

  // 애니메이션 루프를 위한 타이머 설정
  useEffect(() => {
    // 2.5초마다 새로운 폭죽 세트 생성
    const timer = setInterval(() => {
      // 새로운 랜덤 위치로 폭죽 재생성
      fireworks.forEach(firework => {
        firework.x = Math.random() * width * 0.8 + width * 0.1;
        firework.y = Math.random() * height * 0.6 + height * 0.2;
        firework.delay = Math.random() * 1000;
        firework.size = 0.8 + Math.random() * 0.4;
      });
      // 키 변경으로 컴포넌트 리렌더링 유도
      setFireworksKey(prev => prev + 1);
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      {fireworks.map((firework, index) => (
        <Firework
          key={`${fireworksKey}-${index}`}
          x={firework.x}
          y={firework.y}
          delay={firework.delay}
          size={firework.size}
        />
      ))}
    </View>
  );
};

function todayStr() {
  const date = new Date();
  date.setHours(date.getHours() + 9);
  return date.toISOString().split('T')[0];
}

export default function FishingGame() {
  const router = useRouter();
  const { uuid, name, dob } = useLocalSearchParams<{
    uuid: string;
    name: string;
    dob: string;
  }>();

  // ... state 정의(동일, 위 코드 참고) ...
  const [fishes, setFishes] = useState<Fish[]>([]); // 물고기 데이터
  const [fishLoading, setFishLoading] = useState(true); // 물고기 데이터 로딩 상태
  const [dailyBaitLimit, setDailyBaitLimit] = useState(5); // 하루 미끼 제한 개수
  const [todayBaitUsed, setTodayBaitUsed] = useState(0); // 오늘 사용한 미끼 개수
  const [baitCoupons, setBaitCoupons] = useState(0); // 보유한 미끼 교환권 개수
  const [baitPerCoupon, setBaitPerCoupon] = useState(5); // 교환권 당 미끼 수량
  const [tournament, setTournament] = useState<Tournament>(null); // 이벤트 정보
  const [modalVisible, setModalVisible] = useState(false); // 모달 표시 여부
  const [commonDistance, setCommonDistance] = useState(DEFAULT_COMMON_DISTANCE); // 공통 거리 값
  const [commonPoint, setCommonPoint] = useState(DEFAULT_COMMON_POINT); // 공통 포인트 값

  const [state, setState] = useState<GameState>('idle'); // 게임 상태
  const [baitCount, setBaitCount] = useState<number>(0); // 남은 미끼 개수
  const [fish, setFish] = useState<Fish | null>(null); // 현재 잡은 물고기 정보
  const [showResult, setShowResult] = useState(false); // 결과 화면 표시 여부
  const [resultText, setResultText] = useState(''); // 결과 메시지
  const [isSaving, setIsSaving] = useState(false); // 포인트 저장 중 여부
  const [biteDuration, setBiteDuration] = useState(BITE_TIMEOUT); // 입질 타이머 지속 시간
  const [gaugeSpeed, setGaugeSpeed] = useState(500); // ms, 기본값
  const [totalPoint, setTotalPoint] = useState<number>(0); // 총 포인트 (사용자 정보에서 가져올 예정)
  const [showResetButton, setShowResetButton] = useState(false); // 다시하기 버튼 표시 여부

  // 애니메이션 및 타이머
  const castAnim = useRef(new Animated.Value(0)).current; // 캐스팅 애니메이션
  const gaugeAnim = useRef(new Animated.Value(0)).current; // 게이지 애니메이션
  const biteTimeoutAnim = useRef(new Animated.Value(1)).current; // 입질 타이머 애니메이션
  const gaugeMovingRef = useRef(false); // 게이지 움직임 상태
  const biteTimer = useRef<any>(null); // 입질 타이머
  const biteTimeout = useRef<any>(null); // 입질 타임아웃
  const timeBarAnim = useRef(new Animated.Value(1)).current; // 릴링 시간 바 애니메이션

  // 결과 화면 애니메이션
  const resultScaleAnim = useRef(new Animated.Value(0.9)).current; // 결과 화면 크기 애니메이션
  const resultOpacityAnim = useRef(new Animated.Value(0)).current; // 결과 화면 투명도 애니메이션
  
  // 물고기 파닥거림 애니메이션
  const fishFlutterAnim = useRef(new Animated.Value(0)).current; // 물고기 파닥거림 애니메이션
  const fishFlutterAnimRef = useRef<Animated.CompositeAnimation | null>(null); // 애니메이션 참조

  const [distance, setDistance] = useState(INITIAL_DISTANCE);
  const [reelLimit, setReelLimit] = useState(REEL_TIME_LIMIT);
  const [reelGauge, setReelGauge] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [timeBarValue, setTimeBarValue] = useState(1); // Track timeBarAnim value
  const reelInterval = useRef<any>(null);
  const reelDangerTimeout = useRef<any>(null);

  const reelTimeout = useRef<any>(null); // 릴링 제한시간 타이머
  const [gaugeZone, setGaugeZone] = useState<[number, number]>([0, 1]);
  const [fishDistance, setFishDistance] = useState(INITIAL_DISTANCE);
  // 입질을 기다리는 중 상태를 제거하여 관련 ref도 제거

  const [reelZones, setReelZones] = useState({
    dangerZone: [0.85, 1],
    greenZone: [0.7, 0.85],
    normalZone: [0.5, 0.7],
  });

  // 특별 버튼 상태
  const [showBaitButton, setShowBaitButton] = useState(false);
  const [showCatchButton, setShowCatchButton] = useState(false);
  const [showDistanceButton, setShowDistanceButton] = useState(false);
  const [showBombButton, setShowBombButton] = useState(false);
  const [showPointButton, setShowPointButton] = useState(false);
  const [specialButtonPosition, setSpecialButtonPosition] = useState({ x: 0, y: 0 });

  // 추가 포인트 상태
  const [extraPoint, setExtraPoint] = useState(0);

  // 특별 버튼 애니메이션
  const specialButtonAnim = useRef(new Animated.Value(1)).current;

  // 특별 버튼 펄스 애니메이션 시작
  const specialButtonAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const startSpecialButtonAnimation = () => {
    // 기존 애니메이션이 있으면 중지
    if (specialButtonAnimRef.current) {
      specialButtonAnimRef.current.stop();
    }

    // 새 애니메이션 생성 및 시작 - 더 빠르고 더 큰 확대/축소 효과 (300ms)
    specialButtonAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(specialButtonAnim, {
          toValue: 1.5, // 더 큰 확대 효과
          duration: 30, // 더 빠른 애니메이션 (300ms 총 주기의 절반)
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(specialButtonAnim, {
          toValue: 1,
          duration: 30, // 더 빠른 애니메이션 (300ms 총 주기의 절반)
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );

    specialButtonAnimRef.current.start();
  };

  const stopSpecialButtonAnimation = () => {
    if (specialButtonAnimRef.current) {
      specialButtonAnimRef.current.stop();
      specialButtonAnimRef.current = null;
    }
    specialButtonAnim.setValue(1);
  };

  // 물고기 파닥거림 애니메이션 스타일 타입
  const FlutterType = {
    PADAK: 'padak',         // 파닥 - 단일 움직임
    PADAK_PADAK: 'padakpadak', // 파닥파닥 - 빠른 연속 움직임
    PADAK_SLOW: 'padakslow'    // 느린 파닥 - 천천히 움직임
  };

  // 물고기 파닥거림 애니메이션 시작 함수
  const startFishFlutterAnimation = (type: string | null = null) => {
    // 기존 애니메이션이 있으면 중지
    if (fishFlutterAnimRef.current) {
      fishFlutterAnimRef.current.stop();
    }

    // 애니메이션 값 초기화
    fishFlutterAnim.setValue(0);

    // 타입이 지정되지 않은 경우 랜덤하게 선택
    const flutterType = type || [
      FlutterType.PADAK,
      FlutterType.PADAK_PADAK,
      FlutterType.PADAK_SLOW
    ][Math.floor(Math.random() * 3)];

    // 애니메이션 타입에 따라 다른 설정 적용
    let animConfig: {
      toValue: number;
      useNativeDriver: boolean;
      easing: any; // Fix for TS2694 error
      duration?: number;
    } = {
      toValue: 1,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic)
    };

    switch (flutterType) {
      case FlutterType.PADAK:
        // 기본 파닥 - 단일 움직임
        animConfig.duration = 300;
        fishFlutterAnimRef.current = Animated.timing(fishFlutterAnim, animConfig);
        break;

      case FlutterType.PADAK_PADAK:
        // 파닥파닥 - 빠른 연속 움직임
        animConfig.duration = 500;
        fishFlutterAnimRef.current = Animated.sequence([
          Animated.timing(fishFlutterAnim, {
            ...animConfig,
            toValue: 0.5,
            duration: 150,
          }),
          Animated.timing(fishFlutterAnim, {
            ...animConfig,
            toValue: 1,
            duration: 150,
          })
        ]);
        break;

      case FlutterType.PADAK_SLOW:
        // 느린 파닥 - 천천히 움직임
        animConfig.duration = 600;
        animConfig.easing = Easing.inOut(Easing.cubic);
        fishFlutterAnimRef.current = Animated.timing(fishFlutterAnim, animConfig);
        break;
    }

    // 애니메이션 시작
    if (fishFlutterAnimRef.current) {
      fishFlutterAnimRef.current.start(() => {
        // 애니메이션이 끝나면 참조 제거
        fishFlutterAnimRef.current = null;
      });
    }
  };

  // 터치 텍스트 깜박임 애니메이션
  const touchBlinkAnim = useRef(new Animated.Value(0)).current;

  // 릴링 메시지 깜박임 애니메이션
  const reelingMsgBlinkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!uuid) return;
    const userRef = doc(db, 'users', uuid);
    const unsub = onSnapshot(userRef, (snap) => {
      setTotalPoint(Math.max(snap.data()?.totalPoint ?? 0, 0)); // 0점 미만 방어
    });
    return unsub;
  }, [uuid]);

  // 결과 화면에서 다시하기 버튼 지연 표시
  useEffect(() => {
    if (state === 'result') {
      // 성공 시 3초 후, 실패 시 1.5초 후에 다시하기 버튼 표시
      const delay = reelGauge > 0.5 ? 3000 : 1500;
      const timer = setTimeout(() => {
        setShowResetButton(true);
      }, delay);

      return () => clearTimeout(timer);
    } else {
      setShowResetButton(false);
    }
  }, [state, reelGauge]);

  // 물고기 파닥거림 타이머 참조
  const flutterTimerRef = useRef<number | null>(null);

  // 물고기 자동 파닥거림 효과 - 불규칙적으로 변경
  useEffect(() => {
    // 성공 결과 화면에서만 자동 파닥거림 활성화
    if (state === 'result' && reelGauge > 0.5 && fish) {
      // 초기 파닥거림 시작 - 기본 파닥 타입으로 시작
      startFishFlutterAnimation(FlutterType.PADAK);

      // 불규칙적인 파닥거림을 위한 재귀 함수
      const scheduleNextFlutter = () => {
        // 0.8초에서 4초 사이의 랜덤한 시간 간격 생성
        const randomDelay = 800 + Math.random() * 3200;

        return setTimeout(() => {
          // 다음 파닥거림 패턴 결정
          // 파닥파닥 패턴이 나올 확률을 약간 높임 (40%)
          const randomValue = Math.random();
          let flutterType;

          if (randomValue < 0.4) {
            flutterType = FlutterType.PADAK_PADAK; // 40% 확률
          } else if (randomValue < 0.7) {
            flutterType = FlutterType.PADAK; // 30% 확률
          } else {
            flutterType = FlutterType.PADAK_SLOW; // 30% 확률
          }

          // 선택된 패턴으로 애니메이션 시작
          startFishFlutterAnimation(flutterType);

          // 다음 파닥거림 예약
          const nextTimer = scheduleNextFlutter();
          // 타이머 참조 업데이트
          flutterTimerRef.current = nextTimer;
        }, randomDelay);
      };

      // 첫 번째 불규칙 파닥거림 예약
      flutterTimerRef.current = scheduleNextFlutter();

      // 컴포넌트 언마운트 또는 의존성 변경 시 타이머 정리
      return () => {
        if (flutterTimerRef.current) {
          clearTimeout(flutterTimerRef.current);
        }
      };
    }
  }, [state, reelGauge, fish]);

  // 이벤트 정보 가져오기
  const fetchTournamentData = async () => {
    try {
      const tournamentDoc = await getDoc(doc(db, 'gameSettings', 'tournament'));

      if (tournamentDoc.exists()) {
        const data = tournamentDoc.data();
        if (data.title && data.startDate && data.endDate) {
          setTournament({
            title: data.title,
            description: data.description || '',
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
          });
          console.log('Tournament data loaded:', data.title);
        } else {
          console.log('Tournament data incomplete:', data);
          setTournament(null);
        }
      } else {
        console.log('No tournament document exists');
        setTournament(null);
      }
    } catch (error) {
      console.error('이벤트 정보 가져오기 오류:', error);
      setTournament(null);
    }
  };

  // Firebase 버튼 설정을 저장할 변수들
  const [firebaseBaitButton, setFirebaseBaitButton] = useState(false);
  const [firebaseCatchButton, setFirebaseCatchButton] = useState(false);
  const [firebaseDistanceButton, setFirebaseDistanceButton] = useState(false);
  const [firebaseBombButton, setFirebaseBombButton] = useState(false);
  const [firebasePointButton, setFirebasePointButton] = useState(false);

  // 게임 설정 가져오기
  const fetchGameSettings = async () => {
    try {
      const gameSettingsDoc = await getDoc(doc(db, 'gameSettings', 'fishing'));

      if (gameSettingsDoc.exists()) {
        const data = gameSettingsDoc.data();
        if (data.distance) {
          setCommonDistance(data.distance);
        }
        if (data.point) {
          setCommonPoint(data.point);
        }
        
        // 특별 버튼 표시 설정 불러오기 - 게임 시작 시에는 버튼을 표시하지 않도록 수정
        if (data.showBaitButton !== undefined) {
          // 버튼 상태는 항상 false로 시작하고, Firebase 설정만 저장
          setShowBaitButton(false);
          setFirebaseBaitButton(data.showBaitButton);
        }
        if (data.showCatchButton !== undefined) {
          setShowCatchButton(false);
          setFirebaseCatchButton(data.showCatchButton);
        }
        if (data.showDistanceButton !== undefined) {
          setShowDistanceButton(false);
          setFirebaseDistanceButton(data.showDistanceButton);
        }
        if (data.showBombButton !== undefined) {
          setShowBombButton(false);
          setFirebaseBombButton(data.showBombButton);
        }
        if (data.showPointButton !== undefined) {
          setShowPointButton(false);
          setFirebasePointButton(data.showPointButton);
        }
        
        console.log('Game settings loaded - distance:', data.distance, 'point:', data.point);
        console.log('Button settings loaded - bait:', data.showBaitButton, 'catch:', data.showCatchButton, 
                    'distance:', data.showDistanceButton, 'bomb:', data.showBombButton, 'point:', data.showPointButton);
      } else {
        console.log('No game settings document exists, using defaults');
        setCommonDistance(DEFAULT_COMMON_DISTANCE);
        setCommonPoint(DEFAULT_COMMON_POINT);
        // 기본적으로 버튼은 모두 비활성화
        setShowBaitButton(false);
        setShowCatchButton(false);
        setShowDistanceButton(false);
        setShowBombButton(false);
        setShowPointButton(false);
        setFirebaseBaitButton(false);
        setFirebaseCatchButton(false);
        setFirebaseDistanceButton(false);
        setFirebaseBombButton(false);
        setFirebasePointButton(false);
      }
    } catch (error) {
      console.error('게임 설정 가져오기 오류:', error);
      // 오류 발생 시 기본값 사용
      setCommonDistance(DEFAULT_COMMON_DISTANCE);
      setCommonPoint(DEFAULT_COMMON_POINT);
      // 기본적으로 버튼은 모두 비활성화
      setShowBaitButton(false);
      setShowCatchButton(false);
      setShowDistanceButton(false);
      setShowBombButton(false);
      setShowPointButton(false);
      setFirebaseBaitButton(false);
      setFirebaseCatchButton(false);
      setFirebaseDistanceButton(false);
      setFirebaseBombButton(false);
      setFirebasePointButton(false);
    }
  };

  // 이벤트 기간 포맷팅 함수
  const formatTournamentPeriod = () => {
    if (!tournament) return '';

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    };

    return `${formatDate(tournament.startDate)} ~ ${formatDate(tournament.endDate)}`;
  };

  // 물고기 레벨에 따른 파라미터 계산 함수
  const calculateFishParameters = (fishLevel: number = 1) => {
    // 레벨 범위 확인 (1-5)
    const level = Math.max(1, Math.min(5, fishLevel));

    // 거리 계산: 레벨이 높을수록 거리가 길어짐 (더 어려움)
    // 레벨 1: 거리는 commonDistance의 0-20% 사이에서 랜덤
    // 레벨 2: 거리는 commonDistance의 20-40% 사이에서 랜덤
    // 레벨 3: 거리는 commonDistance의 40-60% 사이에서 랜덤
    // 레벨 4: 거리는 commonDistance의 60-80% 사이에서 랜덤
    // 레벨 5: 거리는 commonDistance의 80-100% 사이에서 랜덤
    const minDistancePercent = (level - 1) * 0.2; // 0.0, 0.2, 0.4, 0.6, 0.8
    const maxDistancePercent = level * 0.2; // 0.2, 0.4, 0.6, 0.8, 1.0
    const distancePercent = minDistancePercent + (Math.random() * (maxDistancePercent - minDistancePercent));
    const distance = Math.round(commonDistance * distancePercent);

    // 시간 계산: 거리의 80% 수준으로 결정
    const limitTime = Math.round(distance * 0.8) * 1000; // 초 단위로 변환 (ms)

    // 포인트 계산: 레벨이 높을수록 포인트가 높아짐
    // 레벨 5: 포인트는 commonPoint의 80-100% 사이에서 랜덤
    // 레벨 1: 포인트는 commonPoint의 40-60% 사이에서 랜덤
    const minPointPercent = (level - 1) * 0.2; // 0.0, 0.2, 0.4, 0.6, 0.8
    const maxPointPercent = level * 0.2; // 0.2, 0.4, 0.6, 0.8, 1.0
    const pointPercent = minPointPercent + (Math.random() * (maxPointPercent - minPointPercent));
    // 포인트를 10단위로 반올림 (5 이상은 올림, 5 미만은 내림)
    const rawPoint = Math.round(commonPoint * pointPercent);
    const lastDigit = rawPoint % 10;
    let point = lastDigit >= 5 ? rawPoint + (10 - lastDigit) : rawPoint - lastDigit;
    // 최소 1포인트 보장
    point = Math.max(1, point);

    return { distance, limitTime, point };
  };

  // 캐시 버전 확인
  const checkCacheVersion = async () => {
    try {
      const currentVersion = await AsyncStorage.getItem(FISH_CACHE_VERSION_KEY);

      // 버전이 다르면 캐시 초기화
      if (currentVersion !== FISH_CACHE_VERSION) {
        console.log('캐시 버전이 변경되었습니다. 캐시를 초기화합니다.');
        await AsyncStorage.removeItem(FISH_DATA_CACHE_KEY);
        await AsyncStorage.removeItem(FISH_IMAGES_LOADED_KEY);
        await AsyncStorage.setItem(FISH_CACHE_VERSION_KEY, FISH_CACHE_VERSION);
        return false;
      }
      return true;
    } catch (error) {
      console.error('캐시 버전 확인 오류:', error);
      return false;
    }
  };

  // 캐시에서 물고기 데이터 가져오기
  const getFishDataFromCache = async (): Promise<Fish[] | null> => {
    try {
      // 캐시 버전 확인
      const isValidVersion = await checkCacheVersion();
      if (!isValidVersion) {
        return null;
      }

      const cachedData = await AsyncStorage.getItem(FISH_DATA_CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = new Date().getTime();

        // 캐시가 유효한지 확인 (24시간 이내)
        if (now - timestamp < FISH_CACHE_EXPIRY) {
          console.log('물고기 데이터를 캐시에서 불러왔습니다.');
          return data;
        } else {
          console.log('캐시된 물고기 데이터가 만료되었습니다.');
        }
      }
    } catch (error) {
      console.error('캐시에서 물고기 데이터 불러오기 오류:', error);
    }
    return null;
  };

  // 물고기 데이터를 캐시에 저장
  const cacheFishData = async (fishData: Fish[]) => {
    try {
      // 캐시 버전 설정
      await AsyncStorage.setItem(FISH_CACHE_VERSION_KEY, FISH_CACHE_VERSION);

      const cacheData = {
        data: fishData,
        timestamp: new Date().getTime()
      };
      await AsyncStorage.setItem(FISH_DATA_CACHE_KEY, JSON.stringify(cacheData));
      console.log('물고기 데이터가 캐시에 저장되었습니다.');
    } catch (error) {
      console.error('물고기 데이터 캐싱 오류:', error);
    }
  };

  // uuid 방어
  useEffect(() => {
    if (!uuid) return;
    (async () => {
      console.log('미니게임 화면 접속: 물고기 데이터 로딩 시작');

      // 이벤트 정보 가져오기
      await fetchTournamentData();

      // 게임 설정 가져오기
      await fetchGameSettings();

      const baitSnap = await getDoc(doc(db, 'config', 'bait'));
      if (baitSnap.exists()) {
        const baitData = baitSnap.data();
        setDailyBaitLimit(baitData.dailyLimit ?? 5);
        setBaitPerCoupon(baitData.baitPerCoupon ?? 5);
      }

      try {
        setFishLoading(true);

        // 먼저 캐시에서 데이터 확인
        console.log('캐시에서 물고기 데이터 확인 중...');
        const cachedFishData = await getFishDataFromCache();

        if (cachedFishData && cachedFishData.length > 0) {
          // 캐시된 데이터가 있으면 사용
          console.log(`캐시된 물고기 데이터 ${cachedFishData.length}개 사용`);
          setFishes(cachedFishData);
          setFishLoading(false);

          // 백그라운드에서 최신 데이터 가져오기
          console.log('백그라운드에서 최신 데이터 확인 중...');
          fetchLatestFishData();
        } else {
          // 캐시된 데이터가 없으면 Firebase에서 가져오기
          console.log('캐시된 데이터 없음, Firebase에서 데이터 가져오기');
          await fetchLatestFishData();
        }
      } catch (e) {
        console.error('Fish fetch error', e);
        setFishes([]);
        setFishLoading(false);
      }

      // 오늘 사용 미끼
      const usageSnap = await getDoc(doc(db, `users/${uuid}/baitUsage`, todayStr()));
      setTodayBaitUsed(usageSnap.exists() ? (usageSnap.data().used || 0) : 0);
      
      // 미끼 교환권 개수 가져오기
      const userSnap = await getDoc(doc(db, 'users', String(uuid)));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setBaitCoupons(userData.baitCoupons || 0);
      }
    })();
  }, [uuid]);

  // 물고기 이미지 미리 로드
  const preloadFishImages = async (fishData: Fish[]) => {
    try {
      // 캐시 버전 확인
      const isValidVersion = await checkCacheVersion();
      if (!isValidVersion) {
        // 버전이 변경되었으면 이미지 다시 로드
        console.log('캐시 버전이 변경되어 이미지를 다시 로드합니다.');
      } else {
        // 이미 이미지가 로드되었는지 확인
        const imagesLoaded = await AsyncStorage.getItem(FISH_IMAGES_LOADED_KEY);
        if (imagesLoaded === 'true') {
          console.log('물고기 이미지가 이미 로드되어 있습니다.');
          return;
        }
      }

      console.log('물고기 이미지 미리 로드 시작...');
      const imagePromises = fishData
        .filter((fish: Fish) => fish.img) // img 속성이 있는 물고기만 필터링
        .map((fish: Fish) => {
          // React Native의 Image.prefetch 사용
          return Image.prefetch(fish.img as string)
            .then(() => {
              console.log(`이미지 로드 완료: ${fish.name}`);
            })
            .catch(error => {
              console.error(`이미지 로드 실패: ${fish.name}`, error);
              // 실패해도 계속 진행
            });
        });

      // 모든 이미지 로드 대기
      await Promise.all(imagePromises);

      // 이미지 로드 완료 표시
      await AsyncStorage.setItem(FISH_IMAGES_LOADED_KEY, 'true');
      console.log('모든 물고기 이미지 미리 로드 완료');
    } catch (error) {
      console.error('물고기 이미지 미리 로드 오류:', error);
    }
  };

  // 최신 물고기 데이터 가져오기
  const fetchLatestFishData = async (): Promise<void> => {
    try {
      const snap = await getDocs(collection(db, 'fishes'));
      const arr: Fish[] = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          ...data,
          point: Number(data.point),
        };
      });

      // 데이터 설정 및 캐싱
      setFishes(arr);
      cacheFishData(arr);
      setFishLoading(false);

      // 백그라운드에서 이미지 미리 로드
      preloadFishImages(arr);
    } catch (e) {
      console.error('Latest fish data fetch error', e);
    }
  };

  // 입질을 기다리는 중 상태를 제거하여 관련 haptic 피드백 useEffect도 제거

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
      // 애니메이션 정리
      Animated.timing(touchBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();
      Animated.timing(reelingMsgBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();

      // 특별 버튼 애니메이션 정리
      stopSpecialButtonAnimation();

      // 배경 애니메이션 관련 메모리 누수 방지
      // 입질을 기다리는 중 상태를 제거하여 관련 cleanup 코드도 제거
      if (reelInterval.current) {
        clearInterval(reelInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state === 'result') {
      setShowResult(true);

      // Reset and start result animations
      resultOpacityAnim.setValue(0);
      resultScaleAnim.setValue(0.9);

      // Sequence of animations for result screen
      Animated.parallel([
        Animated.timing(resultOpacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad)
        }),
        Animated.sequence([
          Animated.timing(resultScaleAnim, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.5))
          }),
          Animated.timing(resultScaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          })
        ])
      ]).start();
    }
  }, [state]);

  async function savePointToUser() {
    if (!uuid || !fish || isSaving) return;
    // 릴게임 성공 기준: resultText === '' (즉, 실패 메시지가 없다면 성공)
    if (!fish.point || resultText !== '') return;

    setIsSaving(true);
    try {
      // 총 포인트 계산 (물고기 포인트 + 추가 포인트)
      const totalPoints = fish.point + extraPoint;

      // 1. 포인트 이력 기록
      await addDoc(collection(db, `users/${uuid}/points`), {
        fishName: fish.name,
        point: totalPoints, // 물고기 포인트 + 추가 포인트
        fishLevel: fish.level || 1, // 물고기 레벨 기록
        extraPoint: extraPoint, // Always include extraPoint (will be 0 if no extra points)
        at: new Date(),
      });

      // 2. totalPoint 음수 방지 트랜잭션
      const userRef = doc(db, 'users', uuid);
      let userName = '';
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        let current = (userSnap.data()?.totalPoint ?? 0) as number;
        let next = current + totalPoints;
        if (next < 0) next = 0;
        transaction.update(userRef, { totalPoint: next });
        userName = userSnap.data()?.name || '사용자';
      });
      
      // 3. 관리자에게 포인트 획득 알림 전송
      // try {
      //   await notifyAllAdmins(
      //     `${userName}님이 ${totalPoints}포인트를 획득했습니다!`,
      //     '포인트 획득 알림',
      //     'admin-main'
      //   );
      //   console.log('✅ 관리자에게 포인트 획득 알림 전송 완료');
      // } catch (notifyError) {
      //   console.error('❗ 관리자 푸시 전송 실패:', notifyError);
      // }
    } catch (e) {
      console.error('savePointToUser error:', e);
    }
    setIsSaving(false);
  }


  // 미끼 교환권 사용 함수
  async function handleUseBaitCoupon() {
    if (baitCount > 0) {
      Alert.alert('미끼 있음', '미끼가 남아있을 때는 교환권을 사용할 수 없습니다.');
      return;
    }
    
    // 이벤트 기간 체크
    if (tournament) {
      const now = new Date();
      if (now < tournament.startDate || now > tournament.endDate) {
        Alert.alert('이벤트 기간이 아닙니다', `이벤트 기간(${formatTournamentPeriod()}) 내에만 미끼 교환권을 사용할 수 있습니다.`);
        return;
      }
    }
    
    try {
      // 미끼 교환권 1개 차감
      const userRef = doc(db, 'users', String(uuid));
      await updateDoc(userRef, {
        baitCoupons: increment(-1)
      });
      
      // 미끼 추가
      const usageRef = doc(db, `users/${uuid}/baitUsage`, todayStr());
      const usageSnap = await getDoc(usageRef);
      const currentUsed = usageSnap.exists() ? (usageSnap.data().used || 0) : 0;
      
      // 미끼 사용량 감소 (= 미끼 추가)
      await setDoc(usageRef, {
        used: Math.max(0, currentUsed - baitPerCoupon)
      }, { merge: true });
      
      // 상태 업데이트
      setBaitCoupons(prev => prev - 1);
      setTodayBaitUsed(prev => Math.max(0, prev - baitPerCoupon));
      setBaitCount(baitPerCoupon);
      
      Alert.alert('미끼 교환 완료', `교환권을 사용하여 미끼 ${baitPerCoupon}개를 받았습니다.`);
    } catch (error) {
      console.error('미끼 교환권 사용 오류:', error);
      Alert.alert('오류', '미끼 교환권 사용 중 오류가 발생했습니다.');
    }
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
    // 이벤트 기간 체크
    if (tournament) {
      const now = new Date();
      if (now < tournament.startDate || now > tournament.endDate) {
        Alert.alert('이벤트 기간이 아닙니다', `이벤트 기간(${formatTournamentPeriod()}) 내에만 게임에 참여할 수 있습니다.`);
        return;
      }
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
    setComboCount(0); // 콤보 카운터 리셋
    setExtraPoint(0); // 추가 포인트 리셋
    Animated.timing(castAnim, {
      toValue: 1,
      duration: 800, // Increased from 800ms to 2000ms to give more time for the water ripple effect
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start(() => {
      castAnim.setValue(0);
      // 입질을 기다리는 중 상태를 제거하고 바로 bite 상태로 전환
      setState('bite');
    });
    const randomFish = fishes[Math.floor(Math.random() * fishes.length)];
    setFish(randomFish);

    // 물고기 레벨에 따라 거리, 시간, 포인트 계산
    const fishLevel = randomFish.level || 1; // 레벨이 없으면 기본값 1
    const { distance, limitTime, point } = calculateFishParameters(fishLevel);

    // 계산된 값으로 설정
    setDistance(distance);
    setReelLimit(limitTime);
    setFishDistance(distance);

    // 물고기 포인트 업데이트 (원본 객체는 변경하지 않고 새 객체 생성)
    setFish({
      ...randomFish,
      point: point, // 계산된 포인트로 업데이트
      calculatedDistance: distance, // 계산된 거리 저장 (디버깅용)
      calculatedTime: limitTime // 계산된 시간 저장 (디버깅용)
    });

    setShowResult(false);
  }

  // 입질을 기다리는 중 상태를 제거하여 onWaitingTouch 함수도 제거

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
    let isComboZone = false;

    if (gaugeValue >= greenZone[0] && gaugeValue <= greenZone[1]) {
      // 그린존 (좋아요 구간)
      decrease = 0.04;
      isComboZone = true;
    } else if (gaugeValue >= dangerZone[0] && gaugeValue <= dangerZone[1]) {
      // 위험존
      decrease = 0.12;
      isComboZone = true;
    } else if (gaugeValue >= normalZone[0] && gaugeValue < normalZone[1]) {
      // 노말존 (주의 구간)
      decrease = 0.01;
      isComboZone = true;
    } else {
      // 좋아요, 주의, 위험 구간이 아닌경우, 터치하지 않고 진입만 해도 콤보는 0이 됨 (콤보 초기화)
      setComboCount(0);
    }
    // 0~0.5 구간은 감소 없음

    if (decrease > 0) {
      // 콤보 기능 추가
      if (isComboZone && isPress) {
        // 콤보 증가
        setComboCount(prevCombo => {
          const newCombo = prevCombo + 1;

          // 10콤보마다 거리를 2씩 줄임
          if (newCombo % 10 === 0) {
            setDistance(d => Math.max(0, d - 2));
            // 콤보 달성 시 햅틱 피드백
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }

          return newCombo;
        });
      }

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
    setTimeBarValue(1);

    // Add listener to track animation value
    const listenerId = timeBarAnim.addListener(({ value }) => {
      setTimeBarValue(value);
    });

    Animated.timing(timeBarAnim, {
      toValue: 0,
      duration: reelLimit,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start(() => {
      // Clean up listener when animation completes
      timeBarAnim.removeListener(listenerId);
    });

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

    // 6. 특별 버튼 랜덤 등장 (80% 확률로 등장 - 확률 높임)
    if (Math.random() < 0.8) {
      // 버튼이 나타날 랜덤 시간 설정 (1~5초 사이)
      setTimeout(() => {
        // 화면 내 랜덤 위치 계산 (화면 가장자리 피하기)
        const buttonSize = 80; // 버튼 크기 (업데이트됨)
        const padding = 20; // 화면 가장자리 여백
        const randomX = padding + Math.random() * (width - buttonSize - padding * 2);
        const randomY = padding + Math.random() * (height / 2 - buttonSize - padding * 2);

        setSpecialButtonPosition({ x: randomX, y: randomY });

        // 애니메이션 시작
        specialButtonAnim.setValue(1);
        startSpecialButtonAnimation();

        // 활성화된 버튼들을 배열로 모음 (Firebase 설정 사용)
        const enabledButtons = [];
        if (firebaseBaitButton) enabledButtons.push('bait');
        if (firebaseCatchButton) enabledButtons.push('catch');
        if (firebaseDistanceButton) enabledButtons.push('distance');
        if (firebaseBombButton) enabledButtons.push('bomb');
        if (firebasePointButton) enabledButtons.push('point');
        
        // 활성화된 버튼이 없으면 함수 종료
        if (enabledButtons.length === 0) {
          stopSpecialButtonAnimation();
          return;
        }
        
        // 활성화된 버튼 중 하나를 랜덤하게 선택
        const randomButtonIndex = Math.floor(Math.random() * enabledButtons.length);
        const selectedButton = enabledButtons[randomButtonIndex];

        // 선택된 버튼만 표시
        if (selectedButton === 'bait') {
          setShowBaitButton(true);
          // 3초 후 버튼 사라짐
          setTimeout(() => {
            setShowBaitButton(false);
            stopSpecialButtonAnimation();
          }, 3000);
        } else if (selectedButton === 'catch') {
          setShowCatchButton(true);
          // 1초 후 버튼 사라짐 (빨리 사라지도록 변경)
          setTimeout(() => {
            setShowCatchButton(false);
            stopSpecialButtonAnimation();
          }, 1000);
        } else if (selectedButton === 'distance') {
          setShowDistanceButton(true);
          // 3초 후 버튼 사라짐
          setTimeout(() => {
            setShowDistanceButton(false);
            stopSpecialButtonAnimation();
          }, 3000);
        } else if (selectedButton === 'bomb') {
          setShowBombButton(true);
          // 3초 후 버튼 사라짐
          setTimeout(() => {
            setShowBombButton(false);
            stopSpecialButtonAnimation();
          }, 3000);
        } else if (selectedButton === 'point') {
          setShowPointButton(true);
          // 3초 후 버튼 사라짐
          setTimeout(() => {
            setShowPointButton(false);
            stopSpecialButtonAnimation();
          }, 3000);
        }
      }, 1000 + Math.random() * 4000);
    }

    // 한 게임에 한 번만 버튼이 나타나도록 수정
    // 두 번째 버튼 생성 로직 제거
  }


  // reel 진입할 때 단 한 번만 distance, 게이지 등 초기화
  useEffect(() => {
    if (state === 'reel') {
      if (!fish) return;
      if (reelInterval.current) clearInterval(reelInterval.current); // 혹시 몰라 추가
      if (reelTimeout.current) clearTimeout(reelTimeout.current);
      setDistance(fish.calculatedDistance || fish.distance || INITIAL_DISTANCE);
      setReelGauge(0.7); // 예시값
      setResultText('');
      setComboCount(0); // 콤보 카운터 리셋
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

      // 특별 버튼 애니메이션 정리 및 버튼 숨기기
      stopSpecialButtonAnimation();
      setShowBaitButton(false);
      setShowCatchButton(false);
      setShowDistanceButton(false);
      setShowBombButton(false);
      setShowPointButton(false);
    }
  }, [state]);

  // 터치 텍스트 깜박임 애니메이션 함수
  const startTouchBlink = () => {
    Animated.loop(
        Animated.sequence([
          Animated.timing(touchBlinkAnim, {
            toValue: 1,
            duration: 50,
            useNativeDriver: true,
            easing: Easing.linear,
          }),
          Animated.timing(touchBlinkAnim, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
            easing: Easing.linear,
          }),
        ])
    ).start();
  };

  // 릴링 메시지 깜박임 애니메이션 함수
  const startReelingMsgBlink = () => {
    // 깜박임 효과 대신 항상 표시되도록 수정
    Animated.timing(reelingMsgBlinkAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.linear,
    }).start();
  };

  useEffect(() => {
    if (state === 'bite') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onBiteEnter();
      startTouchBlink(); // 터치 깜박임 시작
    }
    else if (state === 'reel') {
      startReelingMsgBlink(); // 릴링 메시지 깜박임 시작
    }
    else if (state === 'result' || state === 'idle') {
      if (biteTimeout.current) clearTimeout(biteTimeout.current);
      biteTimeoutAnim.setValue(1);
      // 애니메이션 중지 (stopAnimation은 Animated.Value에 직접 사용할 수 없음)
      Animated.timing(touchBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();
      touchBlinkAnim.setValue(0); // 초기값으로 리셋

      // 릴링 메시지 애니메이션 중지 (더 이상 깜박이지 않지만 일관성을 위해 유지)
      Animated.timing(reelingMsgBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();
      reelingMsgBlinkAnim.setValue(0); // 초기값으로 리셋
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
    setComboCount(0); // 콤보 카운터 리셋
    setShowResetButton(false); // 다시하기 버튼 숨기기

    // 특별 버튼 숨기기 및 애니메이션 중지
    setShowBaitButton(false);
    setShowCatchButton(false);
    setShowDistanceButton(false);
    setShowBombButton(false);
    setShowPointButton(false);
    setExtraPoint(0); // 추가 포인트 리셋
    stopSpecialButtonAnimation();

    // 애니메이션 중지
    Animated.timing(touchBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();
    touchBlinkAnim.setValue(0);
    // 릴링 메시지 애니메이션 중지 (더 이상 깜박이지 않지만 일관성을 위해 유지)
    Animated.timing(reelingMsgBlinkAnim, { toValue: 0, duration: 0, useNativeDriver: true }).stop();
    reelingMsgBlinkAnim.setValue(0);
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
        {/* 배경 애니메이션 추가 */}
        <AnimatedBackground gameState={state} />

        {(fishLoading || fishes.length === 0) && (
            <View style={{alignItems:'center', justifyContent:'center', flex:1}}>
              <Text style={{fontSize:22, color:'#888', fontFamily: 'GiantRegular'}}>데이터를 불러오는 중...</Text>
            </View>
        )}

        {/* 이벤트 정보 배너 - 상단에 배치 (게임 시작하면 안보이게 처리) */}
        {(!fishLoading && fishes.length > 0 && tournament && state === 'idle') && (
          <TouchableOpacity
            style={styles.tournamentBanner}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.tournamentTitleContainer}>
              <Ionicons name="trophy" size={20} color="#FFD700" style={styles.trophyIcon} />
              <Text style={styles.tournamentTitle}>{tournament.title}</Text>
            </View>
            <Text style={styles.tournamentPeriod}>{formatTournamentPeriod()}</Text>
          </TouchableOpacity>
        )}

        {/* 이벤트 정보 모달 */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>

              <View style={styles.modalTitleContainer}>
                <Ionicons name="trophy" size={24} color="#FFD700" style={styles.trophyIcon} />
                <Text style={styles.modalTitle}>{tournament?.title}</Text>
              </View>

              <Text style={styles.modalPeriod}>{formatTournamentPeriod()}</Text>

              {tournament?.description ? (
                <Text style={styles.modalDescription}>{tournament.description}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </Modal>

        {(!fishLoading && fishes.length > 0) && (
            <>
              {/* 상단 정보 컨테이너 - 포인트 정보 제거, 미끼 정보 제거 */}
              <View style={styles.topInfoContainer}>
                {/* 상단 정보 제거됨 */}
              </View>

              {state === 'idle' && (
                  <View style={styles.startButtonContainer}>
                    {/* 이벤트 기간 체크 함수 */}
                    {(() => {
                      // 이벤트 기간인지 확인
                      const isWithinTournamentPeriod = () => {
                        if (!tournament) return true; // 이벤트 정보가 없으면 항상 활성화
                        const now = new Date();
                        return now >= tournament.startDate && now <= tournament.endDate;
                      };

                      const isTournamentActive = isWithinTournamentPeriod();
                      const buttonDisabled = baitCount <= 0 || !isTournamentActive;

                      return (
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            buttonDisabled && { backgroundColor: '#888' }
                          ]}
                          disabled={buttonDisabled}
                          onPress={startFishing}
                        >
                          <Text style={styles.buttonText}>시작!</Text>
                          <Text style={styles.baitCountText}>
                            {isTournamentActive
                              ? `남은 미끼: ${baitCount}개`
                              : "이벤트 기간이 아닙니다."}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* 랭킹 버튼 추가 */}
                    <TouchableOpacity
                        style={styles.rankingButton}
                        onPress={() => {
                          router.push({
                            pathname: '/mini-games/ranking',
                            params: {
                              uuid,
                              name,
                            },
                          });
                        }}
                    >
                      <Ionicons name="ribbon" size={24} color="#fff" style={styles.rankingIcon} />
                      <Text style={styles.rankingButtonText}>랭킹 보기</Text>
                    </TouchableOpacity>
                    
                    {/* 미끼 교환 버튼 추가 */}
                    {baitCoupons > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.rankingButton, 
                          { marginTop: 20, backgroundColor: baitCount > 0 ? '#888' : '#4CAF50' }
                        ]}
                        onPress={handleUseBaitCoupon}
                      >
                        <Ionicons name="fish" size={24} color="#fff" style={styles.rankingIcon} />
                        <Text style={styles.rankingButtonText}>미끼 교환권({baitCoupons}장)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
              )}

              {state === 'casting' && (
                  <View style={styles.cleanLayout}>
                    <Text style={styles.gameInfo}>캐스팅 중...</Text>
                    <View style={styles.castingContainer}>
                      {/* Water surface line */}
                      <View style={styles.waterSurfaceLine} />

                      {/* Water ripple effect - appears when bait hits water */}
                      <Animated.View
                          style={[
                            styles.waterRipple,
                            {
                              opacity: castAnim.interpolate({
                                inputRange: [0, 0.5, 0.6, 1],
                                outputRange: [0, 0, 0.8, 0],
                              }),
                              transform: [
                                {
                                  scale: castAnim.interpolate({
                                    inputRange: [0, 0.5, 0.7, 1],
                                    outputRange: [0.5, 0.5, 2, 3],
                                  }),
                                },
                              ],
                              left: '50%',           // 화면 중앙에 위치하도록 추가
                              marginLeft: -30,       // 요소 너비의 절반만큼 왼쪽으로 이동
                            },
                          ]}
                      />

                      {/* Second ripple with delay */}
                      <Animated.View
                          style={[
                            styles.waterRipple,
                            {
                              opacity: castAnim.interpolate({
                                inputRange: [0, 0.6, 0.7, 1],
                                outputRange: [0, 0, 0.6, 0],
                              }),
                              transform: [
                                {
                                  scale: castAnim.interpolate({
                                    inputRange: [0, 0.6, 0.8, 1],
                                    outputRange: [0.5, 0.5, 1.5, 2.5],
                                  }),
                                },
                              ],
                              left: '50%',           // 화면 중앙에 위치하도록 추가
                              marginLeft: -30,       // 요소 너비의 절반만큼 왼쪽으로 이동
                            },
                          ]}
                      />

                      {/* Bait */}
                      <Animated.View
                          style={[
                            styles.baitShape,
                            {
                              transform: [
                                {
                                  translateY: castAnim.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [0, 80, 150],
                                  }),
                                },
                              ],
                              // Bait partially submerges when entering water
                              opacity: castAnim.interpolate({
                                inputRange: [0, 0.5, 0.6, 1],
                                outputRange: [1, 1, 0.8, 0.8],
                              }),
                              left: '50%',           // 화면 중앙에 위치하도록 추가
                              marginLeft: -10,       // 미끼 너비의 절반만큼 왼쪽으로 이동
                            },
                          ]}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fa8', borderWidth: 2, borderColor: '#fff' }} />
                      </Animated.View>

                      {/* Small splash effect when bait hits water */}
                      <Animated.View
                          style={[
                            styles.waterSplash,
                            {
                              opacity: castAnim.interpolate({
                                inputRange: [0, 0.45, 0.55, 0.7],
                                outputRange: [0, 0, 0.8, 0],
                              }),
                              top: 80, // Position where bait hits water
                              left: '50%',           // 화면 중앙에 위치하도록 추가
                              marginLeft: -40,       // 요소 너비의 절반만큼 왼쪽으로 이동
                            },
                          ]}
                      />
                    </View>

                    {/* Information moved to circular components at the top */}
                  </View>
              )}

              {/* 입질을 기다리는 중 상태를 제거하여 관련 UI도 제거 */}

              {state === 'bite' && (
                  <Pressable style={styles.cleanLayout} onPress={onTimingGaugePress}>
                    <Text style={styles.gameInfo}>타이밍에 맞춰 터치하세요!</Text>
                    <View style={styles.gaugeTrack}>
                      <View style={[
                        styles.gaugeSuccessZone,
                        {
                          left: `${gaugeZone[0] * 100}%`,
                          width: `${(gaugeZone[1] - gaugeZone[0]) * 100}%`
                        }
                      ]} />
                      {/* 그린존 위에 깜박이는 터치 텍스트 */}
                      <Animated.View
                          style={[
                            styles.touchIndicator,
                            {
                              left: `${((gaugeZone[0] + gaugeZone[1]) / 2) * 100}%`,
                              opacity: touchBlinkAnim,
                              transform: [{ translateX: -40 }]
                            }
                          ]}
                      >
                        <Text style={styles.touchText}>터치</Text>
                        <Text style={styles.touchTriangle}>▼</Text>
                      </Animated.View>
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
                    {/* Information moved to circular components at the top */}
                  </Pressable>
              )}

              {state === 'reel' && fish && (
                  (() => {
                    const { dangerZone, greenZone, normalZone } = reelZones;

                    return (
                        <Pressable
                            style={styles.cleanLayoutFlexStart}
                            onPress={() => {
                              setReelGauge(prev => {
                                let next = Math.min(1, prev + 0.045);
                                updateDistanceByGauge(next, true);
                                if (next <= 0) {
                                  setResultText('게이지가 0이 되어 놓쳤습니다!');
                                  setState('result');
                                }
                                return next;
                              });
                            }}
                        >
                          <Text style={styles.gameInfo}>무언가를 끌어 올리는 중!</Text>

                          {/* 콤보 카운터 표시 */}
                          <View style={styles.comboContainer}>
                            <Text style={styles.comboText}>
                              콤보: {comboCount} {comboCount > 0 && comboCount % 10 === 0 ? '🔥' : ''}
                            </Text>
                            <Text style={styles.comboInfo}>
                              10콤보마다 거리 -2
                            </Text>
                          </View>

                          {/* 게이지 상단에 각 존 위에 동적으로 문구 표시 */}
                          <View style={styles.gaugeTrackContainer}>
                            {/* 고정 텍스트 제거됨 - 따라다니는 문구만 사용 */}

                            {/* 현재 게이지 위치에 따른 텍스트 표시 (선택적) */}
                            <Animated.View style={[
                              styles.zoneTextIndicator,
                              {
                                left: `${reelGauge * 100}%`,
                                opacity: reelingMsgBlinkAnim,
                                zIndex: 10
                              }
                            ]}>
                              <Text style={[
                                styles.zoneText,
                                {
                                  color: reelGauge < normalZone[0] ? '#333' :
                                         reelGauge < greenZone[0] ? '#00CC00' :
                                         reelGauge < dangerZone[0] ? '#FFD700' : '#FF0000'
                                }
                              ]}>
                                {reelGauge < normalZone[0] ? '터치!' :
                                 reelGauge < greenZone[0] ? '좋아요!' :
                                 reelGauge < dangerZone[0] ? '주의!' : '위험!'}
                              </Text>
                              <Text style={[
                                styles.touchTriangle,
                                {
                                  color: reelGauge < normalZone[0] ? '#333' :
                                         reelGauge < greenZone[0] ? '#00CC00' :
                                         reelGauge < dangerZone[0] ? '#FFD700' : '#FF0000'
                                }
                              ]}>▼</Text>
                            </Animated.View>
                          </View>

                          <View style={styles.gaugeTrack}>
                            <View
                                style={[
                                  styles.gaugeNormalZone,
                                  {
                                    left: `${normalZone[0] * 100}%`,
                                    width: `${(normalZone[1] - normalZone[0]) * 100}%`
                                  },
                                ]}
                            />
                            <View
                                style={[
                                  styles.gaugeGreenZone,
                                  {
                                    left: `${greenZone[0] * 100}%`,
                                    width: `${(greenZone[1] - greenZone[0]) * 100}%`
                                  },
                                ]}
                            />
                            <View
                                style={[
                                  styles.gaugeDangerZone,
                                  {
                                    left: `${dangerZone[0] * 100}%`,
                                    width: `${(dangerZone[1] - dangerZone[0]) * 100}%`
                                  },
                                ]}
                            />
                            <View
                                style={[
                                  styles.gaugePointer,
                                  { width: `${reelGauge * 100}%` }
                                ]}
                            />
                          </View>

                          {/* 특별 버튼 - 미끼 추가 */}
                          {showBaitButton && (
                            <Animated.View
                              style={{
                                position: 'absolute',
                                left: specialButtonPosition.x,
                                top: specialButtonPosition.y,
                                zIndex: 100,
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.specialButton, {
                                  backgroundColor: '#4CAF50',
                                }]}
                                onPress={async () => {
                                  // 5~10개 사이 랜덤으로 미끼 추가
                                  const extraBait = 5 + Math.floor(Math.random() * 6);
                                  setBaitCount(prev => prev + extraBait);

                                  // 버튼 숨기기
                                  setShowBaitButton(false);

                                  // 애니메이션 중지
                                  stopSpecialButtonAnimation();

                                  // 진동 피드백
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                                  // 파이어베이스 baitUsage 컬렉션의 오늘 날짜 used 값 업데이트
                                  try {
                                    if (uuid) {
                                      const usageRef = doc(db, `users/${uuid}/baitUsage`, todayStr());
                                      const usageSnap = await getDoc(usageRef);

                                      if (usageSnap.exists()) {
                                        const currentUsed = usageSnap.data().used || 0;
                                        // used 값에서 획득한 미끼 수만큼 빼기
                                        await updateDoc(usageRef, {
                                          used: Math.max(0, currentUsed - extraBait)
                                        });
                                        // 로컬 상태 업데이트
                                        setTodayBaitUsed(prev => Math.max(0, prev - extraBait));
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error updating baitUsage:', error);
                                  }
                                }}
                              >
                                <View style={{
                                  width: '100%',
                                  height: '100%',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  borderRadius: 37, // Slightly smaller than parent to create a nice border effect
                                }}>
                                  <Animated.Text style={{
                                    fontSize: 24,
                                    marginBottom: 4,
                                    transform: [{ scale: specialButtonAnim }]
                                  }}>🐟</Animated.Text>
                                  <Text style={styles.specialButtonText}>+미끼</Text>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          )}

                          {/* 특별 버튼 - 필살기 */}
                          {showCatchButton && (
                            <Animated.View
                              style={{
                                position: 'absolute',
                                left: specialButtonPosition.x,
                                top: specialButtonPosition.y,
                                zIndex: 100,
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.specialButton, {
                                  backgroundColor: '#FF5722',
                                }]}
                                onPress={() => {
                                  // 물고기 즉시 잡기 (거리를 0으로 설정)
                                  setDistance(0);

                                  // 버튼 숨기기
                                  setShowCatchButton(false);

                                  // 애니메이션 중지
                                  stopSpecialButtonAnimation();

                                  // 진동 피드백
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }}
                              >
                                <View style={{
                                  width: '100%',
                                  height: '100%',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  borderRadius: 37, // Slightly smaller than parent to create a nice border effect
                                }}>
                                  <Animated.Text style={{
                                    fontSize: 24,
                                    marginBottom: 4,
                                    transform: [{ scale: specialButtonAnim }]
                                  }}>⚡</Animated.Text>
                                  <Text style={styles.specialButtonText}>필살기</Text>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          )}

                          {/* 특별 버튼 - 거리 감소 */}
                          {showDistanceButton && (
                            <Animated.View
                              style={{
                                position: 'absolute',
                                left: specialButtonPosition.x,
                                top: specialButtonPosition.y,
                                zIndex: 100,
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.specialButton, {
                                  backgroundColor: '#2196F3',
                                }]}
                                onPress={() => {
                                  // 남아있는 거리의 50%를 감소시킴
                                  setDistance(prev => Math.max(0, prev * 0.5));

                                  // 버튼 숨기기
                                  setShowDistanceButton(false);

                                  // 애니메이션 중지
                                  stopSpecialButtonAnimation();

                                  // 진동 피드백
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }}
                              >
                                <View style={{
                                  width: '100%',
                                  height: '100%',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  borderRadius: 37, // Slightly smaller than parent to create a nice border effect
                                }}>
                                  <Animated.Text style={{
                                    fontSize: 24,
                                    marginBottom: 4,
                                    transform: [{ scale: specialButtonAnim }]
                                  }}>📏</Animated.Text>
                                  <Text style={styles.specialButtonText}>-거리</Text>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          )}

                          {/* 특별 버튼 - 꽝 (실패) */}
                          {showBombButton && (
                            <Animated.View
                              style={{
                                position: 'absolute',
                                left: specialButtonPosition.x,
                                top: specialButtonPosition.y,
                                zIndex: 100,
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.specialButton, {
                                  backgroundColor: '#F44336',
                                }]}
                                onPress={() => {
                                  // 게임 실패 처리
                                  setResultText('앗! 꽝버튼.. 게임 실패!');
                                  setState('result');

                                  // 버튼 숨기기
                                  setShowBombButton(false);

                                  // 애니메이션 중지
                                  stopSpecialButtonAnimation();

                                  // 진동 피드백 (실패)
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                }}
                              >
                                <View style={{
                                  width: '100%',
                                  height: '100%',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  borderRadius: 37, // Slightly smaller than parent to create a nice border effect
                                }}>
                                  <Animated.Text style={{
                                    fontSize: 24,
                                    marginBottom: 4,
                                    transform: [{ scale: specialButtonAnim }]
                                  }}>👿</Animated.Text>
                                  <Text style={styles.specialButtonText}>??</Text>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          )}

                          {/* 특별 버튼 - 포인트 추가 */}
                          {showPointButton && (
                            <Animated.View
                              style={{
                                position: 'absolute',
                                left: specialButtonPosition.x,
                                top: specialButtonPosition.y,
                                zIndex: 100,
                              }}
                            >
                              <TouchableOpacity
                                style={[styles.specialButton, {
                                  backgroundColor: '#9C27B0',
                                }]}
                                onPress={() => {
                                  // 포인트 1~10 랜덤으로 추가
                                  const extraPoints = 1 + Math.floor(Math.random() * 10);
                                  setExtraPoint(prev => prev + extraPoints);

                                  // 버튼 숨기기
                                  setShowPointButton(false);

                                  // 애니메이션 중지
                                  stopSpecialButtonAnimation();

                                  // 진동 피드백
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }}
                              >
                                <View style={{
                                  width: '100%',
                                  height: '100%',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  borderRadius: 37, // Slightly smaller than parent to create a nice border effect
                                }}>
                                  <Animated.Text style={{
                                    fontSize: 24,
                                    marginBottom: 4,
                                    transform: [{ scale: specialButtonAnim }]
                                  }}>💰</Animated.Text>
                                  <Text style={styles.specialButtonText}>+포인트</Text>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          )}

                          <View style={styles.gaugeContainer}>
                            <View style={styles.labelContainer}>
                              <Text style={styles.gaugeLabel}>남은 시간</Text>
                              <Text style={styles.gaugeValue}>{Math.round(timeBarValue * reelLimit / 1000)}초</Text>
                            </View>
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
                          </View>

                          <View style={styles.gaugeContainer}>
                            <View style={styles.labelContainer}>
                              <Text style={styles.gaugeLabel}>남은 거리</Text>
                              <Text style={styles.gaugeValue}>{Math.round(distance)}m / {Math.round(fishDistance)}m</Text>
                            </View>
                            <View style={styles.distanceBarTrack}>
                              <View
                                  style={[
                                    styles.distanceBar,
                                    { width: `${Math.max(0, Math.min(1, distance / fishDistance)) * 100}%` }
                                  ]}
                              />
                            </View>
                          </View>

                          {/* Information moved to circular components at the top */}
                        </Pressable>
                    );
                  })()
              )}



              {state === 'result' && fish && showResult && (
                  <View style={styles.cleanLayout}>
                    <Animated.View
                      style={{
                        transform: [{ scale: resultScaleAnim }],
                        opacity: resultOpacityAnim
                      }}
                    >
                      {resultText ? (
                          <Text style={styles.resultText}>{resultText}</Text>
                      ) : (
                          <>
                            {reelGauge > 0.5 ? (
                              <View style={styles.unifiedResultContainer}>
                                <Text style={[styles.resultTitle, {
                                  color: '#ffff00',
                                }]}>
                                  성공!
                                </Text>
                                <TouchableOpacity 
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    // 진동 효과 추가
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    
                                    // 파닥거리는 애니메이션 시작 - 탭할 때는 파닥파닥 패턴 사용
                                    startFishFlutterAnimation(FlutterType.PADAK_PADAK);
                                  }}
                                >
                                  <View style={{ position: 'relative' }}>
                                    <Animated.Image 
                                      source={fish.img ? { uri: fish.img } : require('../../assets/fishing/fish-shadow.png')}
                                      style={[
                                        styles.fishImage,
                                        {
                                          transform: [
                                            { rotate: fishFlutterAnim.interpolate({
                                                inputRange: [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1],
                                                outputRange: ['0deg', '-10deg', '0deg', '10deg', '0deg', '-5deg', '0deg']
                                              })
                                            },
                                            { scale: fishFlutterAnim.interpolate({
                                                inputRange: [0, 0.3, 0.5, 0.7, 1],
                                                outputRange: [1, 1.08, 1.15, 1.08, 1]
                                              })
                                            },
                                            { translateX: fishFlutterAnim.interpolate({
                                                inputRange: [0, 0.25, 0.5, 0.75, 1],
                                                outputRange: [0, -3, 0, 3, 0]
                                              })
                                            }
                                          ]
                                        }
                                      ]}
                                      resizeMode="contain"
                                    />
                                    {fish.level === 5 && (
                                      <View style={{
                                        position: 'absolute',
                                        top: 5,
                                        right: 5,
                                        padding: 2,
                                        backgroundColor: '#FFD700',
                                        borderRadius: 8,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: '#FFF',
                                        elevation: 5,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 3,
                                      }}>
                                        <Text style={{
                                          fontSize: 16,
                                          fontFamily: 'GiantRegular',
                                          color: '#8B0000',
                                        }}>레어</Text>
                                      </View>
                                    )}
                                  </View>
                                </TouchableOpacity>
                                <Text style={styles.resultMessage}>
                                  {fish.name}을(를) 잡았다!{'\n'}
                                  <Text style={{ color: '#ffff00' }}>
                                    {extraPoint > 0 
                                      ? `${fish.point}P + ${extraPoint}P = ${fish.point + extraPoint}P` 
                                      : `${fish.point}P`}
                                  </Text> 획득!
                                </Text>
                              </View>
                            ) : (
                              <Text style={[styles.resultText, {
                                fontSize: 36,
                                color: '#ffffff',
                                backgroundColor: 'rgba(200,50,50,0.85)'
                              }]}>
                                실패...
                              </Text>
                            )}
                          </>
                      )}
                    </Animated.View>

                    {/* 성공시 폭죽 애니메이션 표시 */}
                    {reelGauge > 0.5 && !resultText && <SuccessFireworks />}

                    {/* 다시하기 버튼 - 지연 후 표시 */}
                    {showResetButton && (
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={resetGame}
                        activeOpacity={0.7} // Add feedback when pressed
                      >
                        <Text style={styles.buttonText}>다시하기</Text>
                      </TouchableOpacity>
                    )}

                    {/* Information moved to circular components at the top */}
                  </View>
              )}
            </>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'GiantRegular',
    color: '#1565C0',
    flex: 1,
  },
  modalDescription: {
    fontSize: 16,
    fontFamily: 'GiantRegular',
    color: '#333',
    marginBottom: 15,
    lineHeight: 22,
  },
  modalPeriod: {
    fontSize: 15,
    fontFamily: 'GiantRegular',
    color: '#666',
    marginTop: 0,
    marginBottom: 15,
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  container: {
    flex: 1,
    backgroundColor: '#2a8dc0', // 더 밝은 바다색으로 변경
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    position: 'relative',
    overflow: 'hidden', // 배경 애니메이션이 컨테이너를 넘어가지 않도록
  },
  rankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 101, 192, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: 200, // Fixed width for consistent button sizes
  },
  rankingButtonText: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  rankingIcon: {
    marginRight: 8,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0, // 배경이 다른 요소들 뒤에 위치하도록
  },
  oceanFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: '#5d4037', // 갈색 바닥
    borderTopWidth: 3,
    borderTopColor: '#8d6e63', // 약간 밝은 갈색 테두리
    zIndex: 1, // 해초보다 높은 z-index (해초가 바닥 뒤에 배치)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  waterSurface: {
    position: 'absolute',
    top: height * 0.15, // 화면 상단에서 15% 위치에 수면 배치
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'rgba(120, 220, 255, 0.2)', // 옅은 푸른색 수면
    zIndex: 1,
  },
  waterReflection: {
    position: 'absolute',
    top: 20, // 수면 바로 아래
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // 단순한 반투명 흰색으로 대체
    opacity: 0.5,
  },
  topInfoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 100,
  },
  tournamentBanner: {
    backgroundColor: 'rgba(21, 101, 192, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  tournamentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trophyIcon: {
    marginRight: 6,
  },
  tournamentTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tournamentDescription: {
    fontSize: 14,
    color: '#E3F2FD',
    fontFamily: 'GiantRegular',
    marginBottom: 4,
  },
  tournamentPeriod: {
    fontSize: 14,
    color: '#E3F2FD',
    fontFamily: 'GiantRegular',
  },
  // Removed unused style definitions for topLeftCircle, topRightCircle, circleMainText, and circleSubText
  comboContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(0,80,150,0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  comboText: {
    fontSize: 18,
    fontFamily: 'GiantRegular',
    color: '#ffffff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  comboInfo: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    color: '#f0f0f0',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  touchIndicator: {
    position: 'absolute',
    top: -45, // Positioned slightly higher to accommodate larger text
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    width: 80, // Increased width to ensure proper centering with larger text
  },
  touchTriangle: {
    fontSize: 16,
    color: '#ff621f',
    fontFamily: 'GiantRegular',
  },
  touchText: {
    fontSize: 14,
    color: '#ff621f',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 1,
  },
  cleanLayout: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  cleanLayoutFlexStart: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
    // padding: 0,
  },
  startButtonContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    padding: 20,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 15,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'GiantRegular',
    marginVertical: 3,
  },
  primaryButton: {
    backgroundColor: '#ff7e00',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: '#ffcc00',
    marginVertical: 16,
    transform: [{ scale: 1.1 }],
    minWidth: width * 0.6,
    maxWidth: width * 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  baitCountText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
    marginTop: 4,
  },
  castingContainer: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden', // Ensure ripple effects stay within container
  },
  waterSurfaceLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    top: 80, // Position where water surface is
    zIndex: 5,
  },
  waterRipple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'transparent',
    top: 80, // Position where water surface is
    left: width / 2 - 30,
    zIndex: 6,
  },
  waterSplash: {
    position: 'absolute',
    width: 30,
    height: 10,
    left: width / 2 - 15,
    zIndex: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 5,
  },
  baitShape: { position: 'absolute', left: width / 2 - 12, top: 20, zIndex: 10 },
  gameInfo: {
    fontSize: 20,
    color: '#ffffff',
    marginVertical: 4,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3
  },
  biteText: { fontSize: 28, color: '#ff621f', fontFamily: 'GiantRegular' },
  fullScreenCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  gaugeBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingTop: 60,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  gaugeTitle: { fontSize: 26, fontFamily: 'GiantRegular', marginBottom: 16, color: '#008cff' },
  gaugeTrack: {
    width: width * 0.8,
    height: 30,
    backgroundColor: '#eee',
    borderRadius: 12,
    overflow: 'visible', // Changed from 'hidden' to 'visible' to show the touch indicator
    marginBottom: 20,
    marginTop: 40, // Reduced to accommodate the zone text container
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  gaugeTrackContainer: {
    width: width * 0.8,
    position: 'relative',
    marginBottom: 0,
  },
  zoneTextIndicator: {
    position: 'absolute',
    top: -5,
    transform: [{ translateX: -30 }],
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    zIndex: 5,
  },
  zoneText: {
    fontSize: 14,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
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
  trialInfo: { fontSize: 17, color: '#666', marginTop: 4, fontFamily: 'GiantRegular' },
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
  resultText: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    marginBottom: 30,
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    backgroundColor: 'rgba(0,100,180,0.85)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    minWidth: width * 0.8,
    maxWidth: width * 0.9,
    lineHeight: 30,
  },

  timeBarTrack: {
    width: width * 0.8,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  timeBarFill: {
    height: 6,
    backgroundColor: '#ffa930',
    borderRadius: 3,
  },
  distanceBarTrack: {
    width: width * 0.8,
    height: 6,
    backgroundColor: '#b5e8fc',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  distanceBar: {
    height: 6,
    backgroundColor: '#11b364',
    borderRadius: 3,
  },
  gaugeContainer: {
    marginBottom: 10,
    width: width * 0.8,
  },
  gaugeLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(0,60,120,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  gaugeValue: {
    fontSize: 16,
    color: '#ffff00',
    fontFamily: 'GiantRegular',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  title: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'GiantRegular',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
    backgroundColor: 'rgba(0,60,120,0.8)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fishImageContainer: {
    marginTop: 20,
    marginBottom: 10,
    width: width * 0.7,
    height: width * 0.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fishImage: {
    width: width * 0.6,
    height: width * 0.4,
    borderRadius: 8,
  },
  unifiedResultContainer: {
    backgroundColor: 'rgba(0,100,180,0.85)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    minWidth: width * 0.8,
    maxWidth: width * 0.9,
  },
  resultTitle: {
    fontSize: 30,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
  },
  resultMessage: {
    fontSize: 24,
    fontFamily: 'GiantRegular',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 4,
    lineHeight: 30,
    marginTop: 10,
  },
  specialButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 100,
    padding: 3,
    borderRadius: 40, // Make it circular (half of width/height)
    backgroundColor: 'rgba(0, 120, 255, 0.8)', // Add a nice blue background
  },
  specialButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'GiantRegular',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
    paddingHorizontal: 5,
    marginTop: 2,
  },
});